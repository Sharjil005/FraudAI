"""Dashboard and admin analytics aggregation."""

from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ml.model_store import registry
from app.models.scan import RiskAssessment, RiskLevel, Scan, ScanType
from app.models.user import User, UserRole
from app.services.scan_service import recent_scans, scan_to_list_item, trend_series

_THREAT_LEVELS = (RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL)
_HIGH_LEVELS = (RiskLevel.HIGH, RiskLevel.CRITICAL)


def _percentage(part: int, whole: int) -> float:
    return round((part / whole) * 100, 2) if whole else 0.0


def _risk_counts(db: Session, user: User | None = None) -> dict[RiskLevel, int]:
    statement = select(RiskAssessment.risk_level, func.count(RiskAssessment.id)).join(
        Scan, Scan.id == RiskAssessment.scan_id
    )
    if user is not None:
        statement = statement.where(Scan.user_id == user.id)
    rows = db.execute(statement.group_by(RiskAssessment.risk_level)).all()

    counts = {level: 0 for level in RiskLevel}
    for level, count in rows:
        # SQLAlchemy returns the Enum member for non-native enums.
        key = level if isinstance(level, RiskLevel) else RiskLevel(str(level))
        counts[key] = int(count)
    return counts


def _type_counts(db: Session, user: User | None = None) -> dict[ScanType, int]:
    statement = select(Scan.scan_type, func.count(Scan.id))
    if user is not None:
        statement = statement.where(Scan.user_id == user.id)
    rows = db.execute(statement.group_by(Scan.scan_type)).all()

    counts = {scan_type: 0 for scan_type in ScanType}
    for scan_type, count in rows:
        key = scan_type if isinstance(scan_type, ScanType) else ScanType(str(scan_type))
        counts[key] = int(count)
    return counts


def _average_score(db: Session, user: User | None = None) -> float:
    statement = select(func.avg(RiskAssessment.overall_score)).join(
        Scan, Scan.id == RiskAssessment.scan_id
    )
    if user is not None:
        statement = statement.where(Scan.user_id == user.id)
    value = db.execute(statement).scalar()
    return round(float(value), 2) if value is not None else 0.0


def _scans_since(db: Session, since: datetime, user: User | None = None) -> int:
    statement = select(func.count(Scan.id)).where(Scan.created_at >= since)
    if user is not None:
        statement = statement.where(Scan.user_id == user.id)
    return int(db.execute(statement).scalar() or 0)


def _period_delta(db: Session, user: User | None = None, days: int = 7) -> float | None:
    """Percentage change in scan volume versus the preceding equal window."""
    now = datetime.now(UTC)
    current = _scans_since(db, now - timedelta(days=days), user)
    statement = select(func.count(Scan.id)).where(
        Scan.created_at >= now - timedelta(days=days * 2),
        Scan.created_at < now - timedelta(days=days),
    )
    if user is not None:
        statement = statement.where(Scan.user_id == user.id)
    previous = int(db.execute(statement).scalar() or 0)

    if previous == 0:
        return 100.0 if current else None
    return round(((current - previous) / previous) * 100, 1)


def _sla_summary(db: Session, user: User) -> dict[str, Any]:
    """Summarise queue age and SLA pressure for the analyst dashboard."""
    rows = db.execute(
        select(Scan).where(Scan.user_id == user.id).order_by(Scan.created_at.desc())
    ).scalars().all()

    pending_review = 0
    escalated_cases = 0
    overdue_cases = 0
    queued_hours: list[float] = []

    now = datetime.now(UTC)
    thresholds = [
        {"label": "0-12h", "threshold_hours": 12, "count": 0},
        {"label": "12-24h", "threshold_hours": 24, "count": 0},
        {"label": "24-48h", "threshold_hours": 48, "count": 0},
        {"label": ">48h", "threshold_hours": 9999, "count": 0},
    ]

    for scan in rows:
        created_at = scan.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=UTC)

        age_hours = (now - created_at).total_seconds() / 3600.0
        queued_hours.append(max(0.0, age_hours))

        if scan.status in {"PENDING", "COMPLETED"}:
            pending_review += 1
        if scan.status == "ESCALATED":
            escalated_cases += 1
        if age_hours > 24 and scan.status in {"PENDING", "COMPLETED", "REVIEWED"}:
            overdue_cases += 1

        for bucket in thresholds:
            limit = bucket["threshold_hours"]
            if age_hours <= limit:
                bucket["count"] += 1
                break

    average_hours = sum(queued_hours) / len(queued_hours) if queued_hours else 0.0

    return {
        "overdue_cases": overdue_cases,
        "aging_buckets": [
            {"label": bucket["label"], "count": bucket["count"], "threshold_hours": bucket["threshold_hours"]}
            for bucket in thresholds
        ],
        "average_hours_in_queue": round(average_hours, 1),
        "escalated_cases": escalated_cases,
        "pending_review": pending_review,
    }


def dashboard_summary(db: Session, user: User) -> dict[str, Any]:
    """Per-user dashboard payload."""
    risk_counts = _risk_counts(db, user)
    type_counts = _type_counts(db, user)
    total = sum(risk_counts.values())
    total_scans = int(
        db.execute(select(func.count(Scan.id)).where(Scan.user_id == user.id)).scalar() or 0
    )

    threats = sum(risk_counts[level] for level in _THREAT_LEVELS)
    high_risk = sum(risk_counts[level] for level in _HIGH_LEVELS)
    safe = risk_counts[RiskLevel.LOW]
    average = _average_score(db, user)
    delta = _period_delta(db, user)

    return {
        "generated_at": datetime.now(UTC),
        "total_scans": total_scans,
        "threats_detected": threats,
        "high_risk_scans": high_risk,
        "safe_scans": safe,
        "average_risk_score": average,
        "detection_rate": _percentage(threats, total),
        "stats": [
            {
                "key": "total_scans",
                "label": "Total Scans",
                "value": total_scans,
                "delta": delta,
                "hint": "All URL, message and document analyses you have run.",
            },
            {
                "key": "threats_detected",
                "label": "Threats Detected",
                "value": threats,
                "hint": "Scans rated medium risk or above.",
            },
            {
                "key": "high_risk_scans",
                "label": "High Risk Scans",
                "value": high_risk,
                "hint": "Scans rated high or critical risk.",
            },
            {
                "key": "safe_scans",
                "label": "Safe Scans",
                "value": safe,
                "hint": "Scans with no meaningful fraud indicators.",
            },
        ],
        "risk_distribution": [
            {
                "risk_level": level,
                "count": risk_counts[level],
                "percentage": _percentage(risk_counts[level], total),
            }
            for level in RiskLevel
        ],
        "scan_type_distribution": [
            {
                "scan_type": scan_type,
                "count": type_counts[scan_type],
                "percentage": _percentage(type_counts[scan_type], total_scans),
            }
            for scan_type in ScanType
        ],
        "trend": trend_series(db, user=user, days=14),
        "top_indicators": _top_indicators(db, user=user, limit=6),
        "recent_scans": [scan_to_list_item(scan) for scan in recent_scans(db, user=user, limit=6)],
        "sla_summary": _sla_summary(db, user),
    }


def _top_indicators(db: Session, user: User | None = None, limit: int = 8) -> list[dict[str, Any]]:
    """Most frequently triggered indicator codes across relevant scans."""
    counter: Counter[str] = Counter()
    labels: dict[str, str] = {}

    statement = select(Scan).order_by(Scan.id.desc()).limit(500)
    if user is not None:
        statement = statement.where(Scan.user_id == user.id)

    for scan in db.execute(statement).scalars().unique():
        detail = scan.detail
        if detail is None:
            continue
        for indicator in detail.indicators or []:
            code = str(indicator.get("code", "UNKNOWN"))
            if float(indicator.get("weight", 0) or 0) <= 0:
                continue
            counter[code] += 1
            labels.setdefault(code, str(indicator.get("label", code)))

    return [
        {"code": code, "label": labels.get(code, code), "count": count}
        for code, count in counter.most_common(limit)
    ]


def admin_analytics(db: Session) -> dict[str, Any]:
    """Platform-wide analytics for the admin dashboard."""
    risk_counts = _risk_counts(db)
    type_counts = _type_counts(db)
    total_assessed = sum(risk_counts.values())
    total_scans = int(db.execute(select(func.count(Scan.id))).scalar() or 0)
    total_users = int(db.execute(select(func.count(User.id))).scalar() or 0)
    total_admins = int(
        db.execute(select(func.count(User.id)).where(User.role == UserRole.ADMIN)).scalar() or 0
    )
    new_users = int(
        db.execute(
            select(func.count(User.id)).where(
                User.created_at >= datetime.now(UTC) - timedelta(days=7)
            )
        ).scalar()
        or 0
    )

    fraud = sum(risk_counts[level] for level in _THREAT_LEVELS)
    high_risk = sum(risk_counts[level] for level in _HIGH_LEVELS)
    average = _average_score(db)

    per_user_scans = dict(
        db.execute(select(Scan.user_id, func.count(Scan.id)).group_by(Scan.user_id)).all()
    )
    per_user_high = dict(
        db.execute(
            select(Scan.user_id, func.count(Scan.id))
            .join(RiskAssessment, RiskAssessment.scan_id == Scan.id)
            .where(RiskAssessment.risk_level.in_(_HIGH_LEVELS))
            .group_by(Scan.user_id)
        ).all()
    )

    users = [
        {
            "id": row.id,
            "name": row.name,
            "email": row.email,
            "role": row.role.value,
            "is_active": bool(row.is_active),
            "created_at": row.created_at,
            "scan_count": int(per_user_scans.get(row.id, 0)),
            "high_risk_count": int(per_user_high.get(row.id, 0)),
        }
        for row in db.execute(select(User).order_by(User.created_at.desc()).limit(50))
        .scalars()
        .all()
    ]

    suspicious = (
        db.execute(
            select(Scan)
            .join(RiskAssessment, RiskAssessment.scan_id == Scan.id)
            .where(RiskAssessment.risk_level.in_(_THREAT_LEVELS))
            .order_by(Scan.created_at.desc(), Scan.id.desc())
            .limit(10)
        )
        .scalars()
        .unique()
        .all()
    )

    return {
        "generated_at": datetime.now(UTC),
        "total_users": total_users,
        "total_admins": total_admins,
        "new_users_last_7_days": new_users,
        "total_scans": total_scans,
        "fraud_detections": fraud,
        "high_risk_percentage": _percentage(high_risk, total_assessed),
        "average_risk_score": average,
        "stats": [
            {
                "key": "total_users",
                "label": "Total Users",
                "value": total_users,
                "hint": f"{new_users} registered in the last 7 days.",
            },
            {
                "key": "total_scans",
                "label": "Total Scans",
                "value": total_scans,
                "delta": _period_delta(db),
                "hint": "Analyses across all users.",
            },
            {
                "key": "fraud_detections",
                "label": "Fraud Detections",
                "value": fraud,
                "hint": "Scans rated medium risk or above.",
            },
            {
                "key": "high_risk_percentage",
                "label": "High Risk Rate",
                "value": _percentage(high_risk, total_assessed),
                "unit": "%",
                "hint": "Share of scans rated high or critical.",
            },
        ],
        "risk_distribution": [
            {
                "risk_level": level,
                "count": risk_counts[level],
                "percentage": _percentage(risk_counts[level], total_assessed),
            }
            for level in RiskLevel
        ],
        "scan_type_distribution": [
            {
                "scan_type": scan_type,
                "count": type_counts[scan_type],
                "percentage": _percentage(type_counts[scan_type], total_scans),
            }
            for scan_type in ScanType
        ],
        "trend": trend_series(db, days=14),
        "top_indicators": _top_indicators(db),
        "recent_suspicious_scans": [scan_to_list_item(scan) for scan in suspicious],
        "users": users,
        "model_status": registry.status(),
    }
