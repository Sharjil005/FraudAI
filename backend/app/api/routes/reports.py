"""Downloadable report routes."""

from __future__ import annotations

from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.core.deps import CurrentUser, DbSession
from app.core.logging_config import get_logger
from app.models.scan import Scan
from app.models.user import UserRole
from app.services.report_service import build_report
from app.services.scan_service import scan_to_detail

logger = get_logger(__name__)
router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get(
    "/{scan_id}",
    summary="Download a scan report as PDF (or HTML)",
    response_class=Response,
    responses={
        200: {
            "content": {"application/pdf": {}, "text/html": {}},
            "description": "Binary report ready to download.",
        }
    },
)
def download_report(
    scan_id: int,
    db: DbSession,
    current_user: CurrentUser,
    fmt: Annotated[str, Query(pattern="^(pdf|html)$", description="Report format")] = "pdf",
    format_alias: Annotated[
        str | None,
        Query(
            alias="format",
            pattern="^(pdf|html)$",
            description="Alias for `fmt`, so ?format=html also works.",
        ),
    ] = None,
) -> Response:
    fmt = format_alias or fmt

    scan = db.get(Scan, scan_id)
    if scan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found.")
    if scan.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this scan.",
        )

    payload = scan_to_detail(scan, include_user=current_user.role == UserRole.ADMIN)

    try:
        content, media_type, filename = build_report(payload, fmt=fmt)
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Report generation failed for scan %s", scan_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The report could not be generated. Please try again.",
        ) from exc

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"; '
                f"filename*=UTF-8''{quote(filename)}"
            ),
            "Content-Length": str(len(content)),
            "Cache-Control": "no-store",
            "X-Report-Format": media_type,
        },
    )
