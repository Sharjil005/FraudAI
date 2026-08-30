"""Scan history routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import CurrentUser, DbSession, Pagination
from app.models.scan import RiskLevel, Scan, ScanType
from app.models.user import UserRole
from app.schemas.scan import ScanDetail, ScanListResponse, ScanStatusUpdateRequest
from app.services.scan_service import list_scans, scan_to_detail, scan_to_list_item

router = APIRouter(prefix="/scans", tags=["Scan History"])


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

    scan.status = payload.status
    db.commit()
    db.refresh(scan)
    return scan_to_detail(scan, include_user=current_user.role == UserRole.ADMIN)


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
