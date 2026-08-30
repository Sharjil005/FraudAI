"""Scan history routes."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.core.deps import CurrentUser, DbSession, Pagination
from app.models.scan import RiskLevel, Scan, ScanType
from app.models.user import UserRole
from app.ml.model_store import registry
from app.schemas.scan import (
    BulkScanStatusUpdateRequest,
    ScanDetail,
    ScanFeedbackRequest,
    ScanListResponse,
    ScanStatusUpdateRequest,
)
from app.services.scan_service import list_scans, scan_to_detail, scan_to_list_item

router = APIRouter(prefix="/scans", tags=["Scan History"])


def _apply_status_update(scan: Scan, payload: ScanStatusUpdateRequest | BulkScanStatusUpdateRequest) -> None:
    if payload.reviewer_name is not None:
        scan.reviewer_name = payload.reviewer_name.strip()
    if payload.assigned_to is not None:
        scan.assigned_to = payload.assigned_to.strip()
    if payload.analyst_notes is not None:
        scan.analyst_notes = payload.analyst_notes.strip()
    if payload.escalation_reason is not None:
        scan.escalation_reason = payload.escalation_reason.strip()

    scan.status = payload.status
    history = list(scan.status_history or [])
    history.append(
        {
            "status": payload.status.value,
            "reviewer_name": scan.reviewer_name,
            "assigned_to": scan.assigned_to,
            "analyst_notes": scan.analyst_notes,
            "escalation_reason": scan.escalation_reason,
            "changed_at": datetime.now(UTC).isoformat(),
        }
    )
    scan.status_history = history


@router.get("", response_model=ScanListResponse, summary="List the current user's scans")
def get_scans(
    db: DbSession,
    current_user: CurrentUser,
    pagination: Pagination,
    scan_type: Annotated[ScanType | None, Query(description="Filter by scan type")] = None,
    risk_level: Annotated[RiskLevel | None, Query(description="Filter by risk level")] = None,
    search: Annotated[str | None, Query(max_length=200, description="Search the target")] = None,
    all_users: Annotated[
        bool, Query(description="Admins only: include scans from every user")
    ] = False,
) -> dict:
    include_all = all_users and current_user.role == UserRole.ADMIN
    rows, total = list_scans(
        db,
        user=None if include_all else current_user,
        scan_type=scan_type,
        risk_level=risk_level,
        search=search,
        page=pagination.page,
        page_size=pagination.page_size,
    )
    total_pages = (total + pagination.page_size - 1) // pagination.page_size
    return {
        "items": [scan_to_list_item(scan) for scan in rows],
        "meta": {
            "total": total,
            "page": pagination.page,
            "page_size": pagination.page_size,
            "total_pages": total_pages,
        },
    }


@router.get("/{scan_id}", response_model=ScanDetail, summary="Get one scan in full detail")
def get_scan(scan_id: int, db: DbSession, current_user: CurrentUser) -> dict:
    scan = db.get(Scan, scan_id)
    if scan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found.")

    is_admin = current_user.role == UserRole.ADMIN
    if scan.user_id != current_user.id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this scan.",
        )
    return scan_to_detail(scan, include_user=is_admin)


@router.post(
    "/{scan_id}/feedback",
    response_model=ScanDetail,
    summary="Record analyst feedback for active-learning and review triage",
)
def record_scan_feedback(
    scan_id: int,
    payload: ScanFeedbackRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> dict:
    scan = db.get(Scan, scan_id)
    if scan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found.")
    if scan.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this scan.",
        )

    scan.feedback = {
        "label": payload.label,
        "confidence": float(payload.confidence),
        "notes": payload.notes.strip() if payload.notes else "",
        "reviewed_by": current_user.name or current_user.email,
        "reviewed_at": datetime.now(UTC).isoformat(),
    }
    db.commit()
    retraining = registry.retrain_from_feedback(db, user=current_user, min_examples=1)
    db.refresh(scan)
    result = scan_to_detail(scan, include_user=current_user.role == UserRole.ADMIN)
    result["feedback_training_status"] = retraining
    return result


@router.patch(
    "/{scan_id}/status",
    response_model=ScanDetail,
    summary="Update a scan's analyst triage status",
)
def update_scan_status(
    scan_id: int,
    payload: ScanStatusUpdateRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> dict:
    scan = db.get(Scan, scan_id)
    if scan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found.")
    if scan.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this scan.",
        )

    _apply_status_update(scan, payload)
    db.commit()
    db.refresh(scan)
    return scan_to_detail(scan, include_user=current_user.role == UserRole.ADMIN)


@router.patch(
    "/bulk-status",
    response_model=dict,
    summary="Apply one triage status update across multiple scans",
)
def bulk_update_scan_status(
    payload: BulkScanStatusUpdateRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> dict:
    updated_items: list[dict] = []
    for scan_id in dict.fromkeys(payload.scan_ids):
        scan = db.get(Scan, scan_id)
        if scan is None:
            continue
        if scan.user_id != current_user.id and current_user.role != UserRole.ADMIN:
            continue

        _apply_status_update(scan, payload)
        updated_items.append(scan_to_detail(scan, include_user=current_user.role == UserRole.ADMIN))

    if not updated_items:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No accessible scans found.")

    db.commit()
    refreshed = db.execute(
        select(Scan).where(Scan.id.in_([item["scan_id"] for item in updated_items]))
    ).scalars().all()
    return {
        "updated": len(updated_items),
        "items": [scan_to_detail(scan, include_user=current_user.role == UserRole.ADMIN) for scan in refreshed],
    }


@router.delete(
    "/{scan_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete one of your scans"
)
def delete_scan(scan_id: int, db: DbSession, current_user: CurrentUser) -> None:
    scan = db.get(Scan, scan_id)
    if scan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found.")
    if scan.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this scan.",
        )
    db.delete(scan)
    db.commit()
