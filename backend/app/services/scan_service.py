"""Scan orchestration: run a detector, score it, persist it, shape the response."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.logging_config import get_logger
from app.ml.document_analyzer import DISCLAIMER, analyse_document
from app.ml.message_detector import analyse_message
from app.ml.qr_detector import analyse_qr, decode_qr_image
from app.ml.url_detector import analyse_url
from app.models.scan import (
    DocumentScan,
    MessageScan,
    QrScan,
    RiskAssessment,
    RiskLevel,
    Scan,
    ScanStatus,
    ScanType,
    UrlScan,
)
from app.models.user import User
from app.services.risk_engine import RiskAssessmentResult, assess_single

logger = get_logger(__name__)

_LABEL_MAX = 180


def _truncate(text: str, limit: int = _LABEL_MAX) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _envelope(scan: Scan) -> dict[str, Any]:
    return {
        "scan_id": scan.id,
        "scan_type": scan.scan_type,
        "status": scan.status,
        "created_at": scan.created_at,
        "target_label": scan.target_label,
    }


def _persist(
    db: Session,
    *,
    user: User,
    scan_type: ScanType,
    target_label: str,
    detail_row_factory,
    assessment: RiskAssessmentResult,
) -> Scan:
    """Create the scan envelope, its modality detail row and its risk assessment."""
    scan = Scan(
        user_id=user.id,
        scan_type=scan_type,
        status=ScanStatus.PENDING,
        target_label=_truncate(target_label),
    )
    db.add(scan)
    db.flush()  # assign scan.id

    db.add(detail_row_factory(scan.id))
    db.add(
        RiskAssessment(
            scan_id=scan.id,
            overall_score=assessment.overall_score,
            risk_level=assessment.risk_level,
            prediction=assessment.prediction,
            confidence=assessment.confidence,
            recommendation=assessment.recommendation,
            explanation=assessment.explanation,
        )
    )
    scan.status = ScanStatus.COMPLETED
    db.commit()
    db.refresh(scan)
    return scan


# --- URL ----------------------------------------------------------------------


def run_url_scan(db: Session, user: User, url: str) -> dict[str, Any]:
    """Analyse a URL, persist the result and return the API payload."""
    result = analyse_url(url)
    assessment = assess_single(ScanType.URL, result)

    scan = _persist(
        db,
        user=user,
        scan_type=ScanType.URL,
        target_label=result["input"],
        detail_row_factory=lambda scan_id: UrlScan(
            scan_id=scan_id,
            url=result["input"],
            domain=result["analysis_details"]["features"].get("registered_domain", ""),
            prediction=result["prediction"],
            risk_score=result["risk_score"],
            confidence=result["confidence"],
            indicators=result["indicators"],
            analysis_details={
                **result["analysis_details"],
                "explanation": result["explanation"],
                "recommendation": result["recommendation"],
                "normalised_url": result["normalised_url"],
            },
        ),
        assessment=assessment,
    )
    logger.info(
        "URL scan #%s by user %s -> %s (%.1f)",
        scan.id,
        user.id,
        result["prediction"],
        result["risk_score"],
    )
    return {
        "scan": _envelope(scan),
        "url": result["input"],
        "normalised_url": result["normalised_url"],
        "prediction": result["prediction"],
        "risk_score": result["risk_score"],
        "risk_level": result["risk_level"],
        "confidence": result["confidence"],
        "indicators": result["indicators"],
        "explanation": result["explanation"],
        "recommendation": result["recommendation"],
        "risk_assessment": assessment.to_dict(),
        "analysis_details": result["analysis_details"],
    }


# --- Message ------------------------------------------------------------------


def run_message_scan(db: Session, user: User, message: str) -> dict[str, Any]:
    """Analyse a message, persist the result and return the API payload."""
    result = analyse_message(message)
    assessment = assess_single(ScanType.MESSAGE, result)

    scan = _persist(
        db,
        user=user,
        scan_type=ScanType.MESSAGE,
        target_label=result["input"],
        detail_row_factory=lambda scan_id: MessageScan(
            scan_id=scan_id,
            message_text=result["input"],
            prediction=result["prediction"],
            risk_score=result["risk_score"],
            confidence=result["confidence"],
            detected_categories=result["detected_categories"],
            suspicious_phrases=result["suspicious_phrases"],
            indicators=result["indicators"],
            analysis_details={
                **result["analysis_details"],
                "explanation": result["explanation"],
                "recommendation": result["recommendation"],
            },
        ),
        assessment=assessment,
    )
    logger.info(
        "Message scan #%s by user %s -> %s (%.1f)",
        scan.id,
        user.id,
        result["prediction"],
        result["risk_score"],
    )
    return {
        "scan": _envelope(scan),
        "message": result["input"],
        "prediction": result["prediction"],
        "risk_score": result["risk_score"],
        "risk_level": result["risk_level"],
        "confidence": result["confidence"],
        "detected_categories": result["detected_categories"],
        "suspicious_phrases": result["suspicious_phrases"],
        "indicators": result["indicators"],
        "explanation": result["explanation"],
        "recommendation": result["recommendation"],
        "risk_assessment": assessment.to_dict(),
        "analysis_details": result["analysis_details"],
    }


# --- Document -----------------------------------------------------------------


def run_document_scan(
    db: Session, user: User, filename: str, content: bytes
) -> dict[str, Any]:
    """Analyse an uploaded document, persist the result and return the payload."""
    result = analyse_document(filename, content)
    assessment = assess_single(ScanType.DOCUMENT, result)

    scan = _persist(
        db,
        user=user,
        scan_type=ScanType.DOCUMENT,
        target_label=result["filename"],
        detail_row_factory=lambda scan_id: DocumentScan(
            scan_id=scan_id,
            filename=result["filename"],
            file_type=result["file_type"],
            file_size=result["file_size"],
            prediction=result["prediction"],
            risk_score=result["risk_score"],
            confidence=result["confidence"],
            extracted_text=result["extracted_text"],
            ocr_available=result["ocr_available"],
            doc_metadata=result["metadata"],
            indicators=result["indicators"],
            analysis_details={
                **result["analysis_details"],
                "explanation": result["explanation"],
                "recommendation": result["recommendation"],
                "disclaimer": result["disclaimer"],
                "extracted_text_truncated": result["extracted_text_truncated"],
                "ocr_used": result["ocr_used"],
            },
        ),
        assessment=assessment,
    )
    logger.info(
        "Document scan #%s by user %s -> %s (%.1f)",
        scan.id,
        user.id,
        result["prediction"],
        result["risk_score"],
    )
    return {
        "scan": _envelope(scan),
        **{k: v for k, v in result.items() if k != "analysis_details"},
        "risk_assessment": assessment.to_dict(),
        "analysis_details": result["analysis_details"],
    }


# --- QR & UPI -----------------------------------------------------------------


def run_qr_scan(
    db: Session,
    user: User,
    *,
    payload: str | None = None,
    file_bytes: bytes | None = None,
    filename: str | None = None,
    claimed_intent: str = "GENERAL_SCAN",
) -> dict[str, Any]:
    """Decode and analyze a QR code / UPI payment link, persist and return the API payload."""
    raw_text = (payload or "").strip()
    target_label = "QR / UPI Scan"

    if file_bytes:
        decoded = decode_qr_image(file_bytes)
        if not decoded:
            raise ValueError(
                "Could not detect or decode a valid QR code from the uploaded image. "
                "Ensure the QR code is clear, well-lit, and uncropped, or paste the UPI link directly."
            )
        raw_text = decoded
        target_label = filename or "Uploaded QR Code"
    elif raw_text:
        target_label = raw_text[:80]
    else:
        raise ValueError("Either an image file or a text payload (UPI link / VPA) is required.")

    result = analyse_qr(raw_text, claimed_intent=claimed_intent)
    assessment = assess_single(ScanType.QR, result)

    if result.get("vpa"):
        target_label = f"UPI: {result['vpa']}"
    elif result.get("qr_type") == "URL":
        target_label = f"QR URL: {result.get('raw_payload', '')[:60]}"

    scan = _persist(
        db,
        user=user,
        scan_type=ScanType.QR,
        target_label=target_label,
        detail_row_factory=lambda scan_id: QrScan(
            scan_id=scan_id,
            raw_payload=result["raw_payload"],
            qr_type=result["qr_type"],
            vpa=result.get("vpa", ""),
            payee_name=result.get("payee_name", ""),
            amount=result.get("amount"),
            currency=result.get("currency", "INR"),
            transaction_note=result.get("transaction_note", ""),
            merchant_code=result.get("merchant_code", ""),
            is_collect_request=result.get("is_collect_request", False),
            prediction=result["prediction"],
            risk_score=result["risk_score"],
            confidence=result["confidence"],
            indicators=result["indicators"],
            analysis_details={
                "explanation": result["explanation"],
                "recommendation": result["recommendation"],
                "embedded_url_analysis": result.get("embedded_url_analysis"),
                "claimed_intent": claimed_intent,
            },
        ),
        assessment=assessment,
    )
    logger.info(
        "QR scan #%s by user %s -> %s (%.1f)",
        scan.id,
        user.id,
        result["prediction"],
        result["risk_score"],
    )
    return {
        "scan": _envelope(scan),
        **result,
        "risk_assessment": assessment.to_dict(),
        "analysis_details": {
            "explanation": result["explanation"],
            "recommendation": result["recommendation"],
            "embedded_url_analysis": result.get("embedded_url_analysis"),
            "claimed_intent": claimed_intent,
        },
    }


# --- Read models --------------------------------------------------------------


def _detail_of(scan: Scan) -> tuple[str, float, float, list[dict], dict]:
    """Return ``(prediction, risk_score, confidence, indicators, analysis_details)``."""
    detail = scan.detail
    if detail is None:
        return "Unknown", 0.0, 0.0, [], {}
    return (
        detail.prediction,
        float(detail.risk_score),
        float(detail.confidence or 0.0),
        list(detail.indicators or []),
        dict(detail.analysis_details or {}),
    )


def scan_to_list_item(scan: Scan) -> dict[str, Any]:
    prediction, risk_score, _, indicators, _ = _detail_of(scan)
    assessment = scan.risk_assessment
    return {
        "scan_id": scan.id,
        "scan_type": scan.scan_type,
        "status": scan.status,
        "reviewer_name": scan.reviewer_name,
        "assigned_to": scan.assigned_to,
        "analyst_notes": scan.analyst_notes,
        "escalation_reason": scan.escalation_reason,
        "status_history": list(scan.status_history or []),
        "feedback": dict(scan.feedback or {}),
        "created_at": scan.created_at,
        "target_label": scan.target_label,
        "prediction": assessment.prediction if assessment else prediction,
        "risk_score": float(assessment.overall_score) if assessment else risk_score,
        "risk_level": assessment.risk_level if assessment else RiskLevel.LOW,
        "indicator_count": len(indicators),
    }


def scan_to_detail(scan: Scan, *, include_user: bool = False) -> dict[str, Any]:
    prediction, risk_score, confidence, indicators, analysis_details = _detail_of(scan)
    assessment = scan.risk_assessment

    payload: dict[str, Any] = {
        "scan_id": scan.id,
        "scan_type": scan.scan_type,
        "status": scan.status,
        "reviewer_name": scan.reviewer_name,
        "assigned_to": scan.assigned_to,
        "analyst_notes": scan.analyst_notes,
        "escalation_reason": scan.escalation_reason,
        "status_history": list(scan.status_history or []),
        "feedback": dict(scan.feedback or {}),
        "created_at": scan.created_at,
        "target_label": scan.target_label,
        "prediction": assessment.prediction if assessment else prediction,
        "risk_score": float(assessment.overall_score) if assessment else risk_score,
        "risk_level": assessment.risk_level if assessment else RiskLevel.LOW,
        "confidence": float(assessment.confidence) if assessment else confidence,
        "explanation": (assessment.explanation if assessment else "")
        or analysis_details.get("explanation", ""),
        "recommendation": (assessment.recommendation if assessment else "")
        or analysis_details.get("recommendation", ""),
        "indicators": indicators,
        "analysis_details": analysis_details,
    }

    if scan.url_scan:
        payload["url"] = scan.url_scan.url
    if scan.message_scan:
        payload["message"] = scan.message_scan.message_text
        payload["detected_categories"] = list(scan.message_scan.detected_categories or [])
        payload["suspicious_phrases"] = list(scan.message_scan.suspicious_phrases or [])
    if scan.document_scan:
        doc = scan.document_scan
        payload.update(
            {
                "filename": doc.filename,
                "file_type": doc.file_type,
                "file_size": doc.file_size,
                "extracted_text": doc.extracted_text,
                "ocr_available": doc.ocr_available,
                "document_metadata": dict(doc.doc_metadata or {}),
                "disclaimer": analysis_details.get("disclaimer", DISCLAIMER),
            }
        )
    if scan.qr_scan:
        qr = scan.qr_scan
        payload.update(
            {
                "raw_payload": qr.raw_payload,
                "qr_type": qr.qr_type,
                "vpa": qr.vpa,
                "payee_name": qr.payee_name,
                "amount": qr.amount,
                "currency": qr.currency,
                "transaction_note": qr.transaction_note,
                "merchant_code": qr.merchant_code,
                "is_collect_request": qr.is_collect_request,
                "embedded_url_analysis": analysis_details.get("embedded_url_analysis"),
            }
        )

    if include_user and scan.user:
        payload["user"] = {
            "id": scan.user.id,
            "name": scan.user.name,
            "email": scan.user.email,
            "role": scan.user.role.value,
        }
    return payload


def list_scans(
    db: Session,
    *,
    user: User | None = None,
    scan_type: ScanType | None = None,
    risk_level: RiskLevel | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 10,
) -> tuple[list[Scan], int]:
    """Paginated, filtered scan history. ``user=None`` returns all users' scans."""
    statement = select(Scan)
    count_statement = select(func.count(Scan.id))

    conditions = []
    if user is not None:
        conditions.append(Scan.user_id == user.id)
    if scan_type is not None:
        conditions.append(Scan.scan_type == scan_type)
    if search:
        conditions.append(Scan.target_label.ilike(f"%{search.strip()}%"))
    if risk_level is not None:
        statement = statement.join(RiskAssessment, RiskAssessment.scan_id == Scan.id)
        count_statement = count_statement.join(
            RiskAssessment, RiskAssessment.scan_id == Scan.id
        )
        conditions.append(RiskAssessment.risk_level == risk_level)

    for condition in conditions:
        statement = statement.where(condition)
        count_statement = count_statement.where(condition)

    total = int(db.execute(count_statement).scalar() or 0)
    page = max(1, page)
    page_size = min(max(1, page_size), 100)

    rows = (
        db.execute(
            statement.order_by(Scan.created_at.desc(), Scan.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        .scalars()
        .unique()
        .all()
    )
    return list(rows), total


def recent_scans(db: Session, *, user: User | None = None, limit: int = 5) -> list[Scan]:
    statement = select(Scan).order_by(Scan.created_at.desc(), Scan.id.desc()).limit(limit)
    if user is not None:
        statement = statement.where(Scan.user_id == user.id)
    return list(db.execute(statement).scalars().unique().all())


def trend_series(db: Session, *, user: User | None = None, days: int = 14) -> list[dict[str, Any]]:
    """Daily scan counts for the last ``days`` days, including empty days."""
    since = datetime.now(UTC) - timedelta(days=days - 1)
    statement = select(Scan).where(Scan.created_at >= since)
    if user is not None:
        statement = statement.where(Scan.user_id == user.id)
    scans = list(db.execute(statement).scalars().unique().all())

    buckets: dict[str, dict[str, int]] = {}
    for offset in range(days):
        key = (since + timedelta(days=offset)).date().isoformat()
        buckets[key] = {"total": 0, "safe": 0, "suspicious": 0, "high_risk": 0}

    for scan in scans:
        created = scan.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=UTC)
        key = created.date().isoformat()
        bucket = buckets.get(key)
        if bucket is None:
            continue
        bucket["total"] += 1
        level = scan.risk_assessment.risk_level if scan.risk_assessment else RiskLevel.LOW
        if level == RiskLevel.LOW:
            bucket["safe"] += 1
        elif level == RiskLevel.MEDIUM:
            bucket["suspicious"] += 1
        else:
            bucket["high_risk"] += 1

    return [{"date": key, **values} for key, values in buckets.items()]
