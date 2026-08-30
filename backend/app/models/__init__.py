"""ORM models for FraudShield AI."""

from app.models.scan import (
    DocumentScan,
    MessageScan,
    RiskAssessment,
    RiskLevel,
    Scan,
    ScanStatus,
    ScanType,
    UrlScan,
)
from app.models.user import User, UserRole

__all__ = [
    "DocumentScan",
    "MessageScan",
    "RiskAssessment",
    "RiskLevel",
    "Scan",
    "ScanStatus",
    "ScanType",
    "UrlScan",
    "User",
    "UserRole",
]
