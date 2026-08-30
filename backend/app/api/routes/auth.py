"""Authentication routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession
from app.core.logging_config import get_logger
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User, UserRole
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut

logger = get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])


def _token_response(user: User) -> dict:
    return {
        "access_token": create_access_token(user.id, role=user.role.value),
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": user,
    }


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new account",
)
def register(payload: RegisterRequest, db: DbSession) -> dict:
    email = payload.email.lower()
    existing = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    user = User(
        name=payload.name,
        email=email,
        password_hash=hash_password(payload.password),
        role=UserRole.USER,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("Registered new user %s (id=%s)", user.email, user.id)
    return _token_response(user)


@router.post("/login", response_model=TokenResponse, summary="Sign in and receive a JWT")
def login(payload: LoginRequest, db: DbSession) -> dict:
    user = db.execute(
        select(User).where(User.email == payload.email.lower())
    ).scalar_one_or_none()

    # Constant-ish response regardless of which half failed.
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated.",
        )

    logger.info("User %s signed in", user.email)
    return _token_response(user)


@router.get("/me", response_model=UserOut, summary="Get the current authenticated user")
def me(current_user: CurrentUser) -> User:
    return current_user
