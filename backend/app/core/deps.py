"""Reusable FastAPI dependencies: current user, role guards, pagination."""

from __future__ import annotations

from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.database.session import get_db
from app.models.user import User, UserRole

bearer_scheme = HTTPBearer(auto_error=False, description="JWT access token")

_CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials. Please sign in again.",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None,
    db: Annotated[Session, Depends(get_db)] = None,  # type: ignore[assignment]
) -> User:
    """Resolve the authenticated user from the ``Authorization: Bearer`` header."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. An access token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    except jwt.PyJWTError:
        raise _CREDENTIALS_ERROR from None

    subject = payload.get("sub")
    if not subject:
        raise _CREDENTIALS_ERROR

    try:
        user_id = int(subject)
    except (TypeError, ValueError):
        raise _CREDENTIALS_ERROR from None

    user = db.get(User, user_id)
    if user is None:
        raise _CREDENTIALS_ERROR
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated.",
        )
    return user


def require_admin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Guard for admin-only endpoints."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator privileges are required for this resource.",
        )
    return current_user


class PaginationParams:
    """Standard page/page_size query parameters."""

    def __init__(
        self,
        page: Annotated[int, Query(ge=1, le=10_000, description="1-based page number")] = 1,
        page_size: Annotated[int, Query(ge=1, le=100, description="Items per page")] = 10,
    ) -> None:
        self.page = page
        self.page_size = page_size

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_admin)]
DbSession = Annotated[Session, Depends(get_db)]
Pagination = Annotated[PaginationParams, Depends(PaginationParams)]
