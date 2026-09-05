"""Social safety circle models: friendships, groups, and shared alerts."""

from __future__ import annotations

import enum
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base

if TYPE_CHECKING:  # pragma: no cover
    from app.models.user import User
    from app.models.scan import Scan


class FriendshipStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"


class Friendship(Base):
    """Stores connections and pending invitations between two users."""

    __tablename__ = "friendships"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    friend_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    status: Mapped[FriendshipStatus] = mapped_column(
        Enum(FriendshipStatus, native_enum=False, length=16),
        default=FriendshipStatus.PENDING,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    # Relationships
    sender: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    receiver: Mapped["User"] = relationship("User", foreign_keys=[friend_id])

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Friendship id={self.id} user_id={self.user_id} friend_id={self.friend_id} status={self.status.value}>"


class SafetyGroup(Base):
    """A safety circle containing multiple friends to share alerts with."""

    __tablename__ = "safety_groups"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    creator_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    # Relationships
    creator: Mapped["User"] = relationship("User", foreign_keys=[creator_id])
    members: Mapped[list["GroupMember"]] = relationship(
        "GroupMember", back_populates="group", cascade="all, delete-orphan", lazy="selectin"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<SafetyGroup id={self.id} name={self.name!r} creator_id={self.creator_id}>"


class GroupMember(Base):
    """Association table connecting users to a SafetyGroup."""

    __tablename__ = "group_members"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    group_id: Mapped[int] = mapped_column(
        ForeignKey("safety_groups.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    # Relationships
    group: Mapped["SafetyGroup"] = relationship("SafetyGroup", back_populates="members")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:  # pragma: no cover
        return f"<GroupMember id={self.id} group_id={self.group_id} user_id={self.user_id}>"


class ThreatAlert(Base):
    """An alert notification dispatched to either a specific friend or a safety group."""

    __tablename__ = "threat_alerts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    sender_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    scan_id: Mapped[int] = mapped_column(
        ForeignKey("scans.id", ondelete="CASCADE"), index=True, nullable=False
    )
    receiver_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True
    )
    group_id: Mapped[int | None] = mapped_column(
        ForeignKey("safety_groups.id", ondelete="CASCADE"), index=True, nullable=True
    )
    note: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    sender: Mapped["User"] = relationship("User", foreign_keys=[sender_id])
    scan: Mapped["Scan"] = relationship("Scan", lazy="selectin")
    receiver: Mapped["User | None"] = relationship("User", foreign_keys=[receiver_id])
    group: Mapped["SafetyGroup | None"] = relationship("SafetyGroup")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ThreatAlert id={self.id} sender_id={self.sender_id} scan_id={self.scan_id}>"
