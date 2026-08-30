"""User dashboard routes."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.deps import CurrentUser, DbSession
from app.schemas.dashboard import DashboardSummary
from app.services.analytics_service import dashboard_summary

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get(
    "/summary",
    response_model=DashboardSummary,
    summary="Aggregated statistics for the signed-in user's dashboard",
)
def summary(db: DbSession, current_user: CurrentUser) -> dict:
    return dashboard_summary(db, current_user)
