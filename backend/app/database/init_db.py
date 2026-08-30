"""Database initialisation and bootstrap accounts."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging_config import get_logger
from app.core.security import hash_password
from app.database.session import Base, DATABASE_FLAVOUR, SessionLocal, engine
from app.models import user as _user_model  # noqa: F401 - register mappers
from app.models import scan as _scan_model  # noqa: F401 - register mappers
from app.models.user import User, UserRole

logger = get_logger(__name__)


def create_tables() -> None:
    """Create any missing tables. Safe to call on every startup."""
    Base.metadata.create_all(bind=engine)
    logger.info("Database schema ready (%s).", DATABASE_FLAVOUR)


def ensure_user(
    db: Session, *, name: str, email: str, password: str, role: UserRole
) -> tuple[User, bool]:
    """Get-or-create a user. Returns ``(user, created)``."""
    existing = db.execute(select(User).where(User.email == email.lower())).scalar_one_or_none()
    if existing:
        return existing, False

    user = User(
        name=name,
        email=email.lower(),
        password_hash=hash_password(password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("Created %s account %s", role.value, user.email)
    return user, True


def create_bootstrap_users() -> None:
    """Create the development admin and demo accounts if they are missing."""
    if not settings.CREATE_BOOTSTRAP_USERS:
        return
    with SessionLocal() as db:
        ensure_user(
            db,
            name=settings.ADMIN_NAME,
            email=settings.ADMIN_EMAIL,
            password=settings.ADMIN_PASSWORD,
            role=UserRole.ADMIN,
        )
        ensure_user(
            db,
            name=settings.DEMO_NAME,
            email=settings.DEMO_EMAIL,
            password=settings.DEMO_PASSWORD,
            role=UserRole.USER,
        )


def init_db() -> None:
    create_tables()
    create_bootstrap_users()
