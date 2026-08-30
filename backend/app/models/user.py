"""User model."""

from __future__ import annotations

import enum
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base

if TYPE_CHECKING:  # pragma: no cover
    from app.models.scan import Scan


class UserRole(str, enum.Enum):
    USER = "USER"
    ADMIN = "ADMIN"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, native_enum=False, length=16), default=UserRole.USER, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    scans: Mapped[list["Scan"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", lazy="selectin"
    )

    @property
    def is_admin(self) -> bool:
        return self.role == UserRole.ADMIN

    def __repr__(self) -> str:  # pragma: no cover
        return f"<User id={self.id} email={self.email!r} role={self.role.value}>"
