"""Pydantic request/response schemas."""

from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
)
from app.schemas.common import ErrorResponse, MessageResponse, PaginatedMeta
from app.schemas.dashboard import (
    AdminAnalytics,
    DashboardSummary,
    RiskDistributionItem,
    ScanTrendPoint,
    ScanTypeCount,
    StatCard,
)
from app.schemas.scan import (
    DocumentScanResult,
    IndicatorOut,
    MessageScanRequest,
    MessageScanResult,
    ScanDetail,
    ScanListItem,
    ScanListResponse,
    UrlScanRequest,
    UrlScanResult,
)

__all__ = [
    "AdminAnalytics",
    "DashboardSummary",
    "DocumentScanResult",
    "ErrorResponse",
    "IndicatorOut",
    "LoginRequest",
    "MessageResponse",
    "MessageScanRequest",
    "MessageScanResult",
    "PaginatedMeta",
    "RegisterRequest",
    "RiskDistributionItem",
    "ScanDetail",
    "ScanListItem",
    "ScanListResponse",
    "ScanTrendPoint",
    "ScanTypeCount",
    "StatCard",
    "TokenResponse",
    "UrlScanRequest",
    "UrlScanResult",
    "UserOut",
]
