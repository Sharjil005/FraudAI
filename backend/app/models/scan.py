"""Scan models: the generic scan envelope plus per-modality detail tables."""

from __future__ import annotations

import enum
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base

if TYPE_CHECKING:  # pragma: no cover
    from app.models.user import User


class ScanType(str, enum.Enum):
    URL = "URL"
    MESSAGE = "MESSAGE"
    DOCUMENT = "DOCUMENT"


class ScanStatus(str, enum.Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    REVIEWED = "REVIEWED"
    ESCALATED = "ESCALATED"
    DISMISSED = "DISMISSED"


class RiskLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Scan(Base):
    """One analysis request performed by a user."""

    __tablename__ = "scans"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    scan_type: Mapped[ScanType] = mapped_column(
        Enum(ScanType, native_enum=False, length=16), index=True, nullable=False
    )
    status: Mapped[ScanStatus] = mapped_column(
        Enum(ScanStatus, native_enum=False, length=16),
        default=ScanStatus.PENDING,
        nullable=False,
    )
    target_label: Mapped[str] = mapped_column(String(512), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True, nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="scans")
    url_scan: Mapped["UrlScan | None"] = relationship(
        back_populates="scan", cascade="all, delete-orphan", uselist=False, lazy="selectin"
    )
    message_scan: Mapped["MessageScan | None"] = relationship(
        back_populates="scan", cascade="all, delete-orphan", uselist=False, lazy="selectin"
    )
    document_scan: Mapped["DocumentScan | None"] = relationship(
        back_populates="scan", cascade="all, delete-orphan", uselist=False, lazy="selectin"
    )
    risk_assessment: Mapped["RiskAssessment | None"] = relationship(
        back_populates="scan", cascade="all, delete-orphan", uselist=False, lazy="selectin"
    )

    @property
    def detail(self) -> "UrlScan | MessageScan | DocumentScan | None":
        return self.url_scan or self.message_scan or self.document_scan

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Scan id={self.id} type={self.scan_type.value} status={self.status.value}>"


class UrlScan(Base):
    __tablename__ = "url_scans"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    scan_id: Mapped[int] = mapped_column(
        ForeignKey("scans.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    url: Mapped[str] = mapped_column(Text, nullable=False)
    domain: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    prediction: Mapped[str] = mapped_column(String(32), nullable=False)
    risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    indicators: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    analysis_details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    scan: Mapped["Scan"] = relationship(back_populates="url_scan")


class MessageScan(Base):
    __tablename__ = "message_scans"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    scan_id: Mapped[int] = mapped_column(
        ForeignKey("scans.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    message_text: Mapped[str] = mapped_column(Text, nullable=False)
    prediction: Mapped[str] = mapped_column(String(32), nullable=False)
    risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    detected_categories: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    suspicious_phrases: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    indicators: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    analysis_details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    scan: Mapped["Scan"] = relationship(back_populates="message_scan")


class DocumentScan(Base):
    __tablename__ = "document_scans"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    scan_id: Mapped[int] = mapped_column(
        ForeignKey("scans.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    file_type: Mapped[str] = mapped_column(String(32), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    prediction: Mapped[str] = mapped_column(String(48), nullable=False)
    risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    extracted_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    ocr_available: Mapped[bool] = mapped_column(default=False, nullable=False)
    # ``metadata`` is reserved on the declarative base, so the attribute is
    # renamed while the physical column keeps the required name.
    doc_metadata: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, default=dict, nullable=False
    )
    indicators: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    analysis_details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    scan: Mapped["Scan"] = relationship(back_populates="document_scan")


class RiskAssessment(Base):
    """Normalised output of the fraud risk scoring engine."""

    __tablename__ = "risk_assessments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    scan_id: Mapped[int] = mapped_column(
        ForeignKey("scans.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    overall_score: Mapped[float] = mapped_column(Float, nullable=False)
    risk_level: Mapped[RiskLevel] = mapped_column(
        Enum(RiskLevel, native_enum=False, length=16), index=True, nullable=False
    )
    prediction: Mapped[str] = mapped_column(String(48), default="", nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    recommendation: Mapped[str] = mapped_column(Text, default="", nullable=False)
    explanation: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    scan: Mapped["Scan"] = relationship(back_populates="risk_assessment")
