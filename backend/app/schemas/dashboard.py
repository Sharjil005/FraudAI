"""Dashboard and analytics schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.scan import RiskLevel, ScanType
from app.schemas.scan import ScanListItem


class StatCard(BaseModel):
    key: str
    label: str
    value: float
    unit: str | None = None
    delta: float | None = Field(
        default=None, description="Change versus the previous equivalent period, in percent."
    )
    hint: str | None = None


class RiskDistributionItem(BaseModel):
    risk_level: RiskLevel
    count: int
    percentage: float


class ScanTypeCount(BaseModel):
    scan_type: ScanType
    count: int
    percentage: float


class ScanTrendPoint(BaseModel):
    date: str
    total: int
    safe: int
    suspicious: int
    high_risk: int


class AgingBucket(BaseModel):
    label: str
    count: int
    threshold_hours: int


class SlaSummary(BaseModel):
    overdue_cases: int
    aging_buckets: list[AgingBucket]
    average_hours_in_queue: float
    escalated_cases: int
    pending_review: int


class WorkloadSummary(BaseModel):
    my_assigned_cases: int
    unassigned_cases: int
    escalated_workload: int
    reviewed_today: int
    active_analysts: int


class ConfidenceSummary(BaseModel):
    low: int
    medium: int
    high: int
    review_required: int


class DashboardSummary(BaseModel):
    generated_at: datetime
    total_scans: int
    threats_detected: int
    high_risk_scans: int
    safe_scans: int
    average_risk_score: float
    detection_rate: float
    stats: list[StatCard]
    risk_distribution: list[RiskDistributionItem]
    scan_type_distribution: list[ScanTypeCount]
    trend: list[ScanTrendPoint]
    top_indicators: list[dict[str, object]]
    recent_scans: list[ScanListItem]
    sla_summary: SlaSummary
    workload_summary: WorkloadSummary
    confidence_summary: ConfidenceSummary


class AdminUserRow(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool = True
    created_at: datetime
    scan_count: int
    high_risk_count: int


class AdminAnalytics(BaseModel):
    generated_at: datetime
    total_users: int
    total_admins: int
    new_users_last_7_days: int
    total_scans: int
    fraud_detections: int
    high_risk_percentage: float
    average_risk_score: float
    stats: list[StatCard]
    risk_distribution: list[RiskDistributionItem]
    scan_type_distribution: list[ScanTypeCount]
    trend: list[ScanTrendPoint]
    top_indicators: list[dict[str, object]]
    recent_suspicious_scans: list[ScanListItem]
    users: list[AdminUserRow]
    model_status: dict[str, object]
