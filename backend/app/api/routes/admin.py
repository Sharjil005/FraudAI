"""Admin-only routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.deps import AdminUser, DbSession
from app.ml.model_store import registry
from app.models.user import User
from app.schemas.auth import UserOut
from app.schemas.dashboard import AdminAnalytics
from app.services.analytics_service import admin_analytics

router = APIRouter(prefix="/admin", tags=["Administration"])


@router.get(
    "/analytics",
    response_model=AdminAnalytics,
    summary="Platform-wide fraud analytics (admin only)",
)
def analytics(db: DbSession, admin: AdminUser) -> dict:
    return admin_analytics(db)


@router.get("/users", response_model=list[UserOut], summary="List all platform users (admin only)")
def list_users(db: DbSession, admin: AdminUser) -> list[User]:
    return list(db.execute(select(User).order_by(User.created_at.desc())).scalars().all())


@router.post(
    "/model/retrain",
    summary="Retrain the ML models from analyst feedback (admin only)",
)
def retrain_models(db: DbSession, admin: AdminUser) -> dict:
    return registry.retrain_from_feedback(db, min_examples=1)


@router.patch(
    "/users/{user_id}/status",
    response_model=UserOut,
    summary="Activate or deactivate a user account (admin only)",
)
def set_user_status(user_id: int, is_active: bool, db: DbSession, admin: AdminUser) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot change the status of your own account.",
        )
    user.is_active = is_active
    db.commit()
    db.refresh(user)
    return user
