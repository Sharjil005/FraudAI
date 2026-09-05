"""Scan request/response schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.models.scan import RiskLevel, ScanStatus, ScanType
from app.schemas.common import PaginatedMeta


# --- Requests -----------------------------------------------------------------


class UrlScanRequest(BaseModel):
    url: str = Field(
        ...,
        min_length=4,
        max_length=2048,
        examples=["http://secure-login-verify-account.example.com/login?account=12345"],
    )

    @field_validator("url")
    @classmethod
    def _strip(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("URL is required.")
        return cleaned


class MessageScanRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=3,
        max_length=20000,
        examples=[
            "URGENT! Your bank account will be blocked today. Verify your account "
            "immediately and share your OTP to avoid suspension."
        ],
    )

    @field_validator("message")
    @classmethod
    def _strip(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Message text is required.")
        return cleaned


class QrScanRequest(BaseModel):
    payload: str | None = Field(
        default=None,
        min_length=1,
        max_length=4096,
        examples=["upi://pay?pa=merchant@okaxis&pn=Merchant&am=150.00&cu=INR"],
    )
    claimed_intent: Literal["GENERAL_SCAN", "RECEIVE_MONEY", "SEND_MONEY"] = Field(
        default="GENERAL_SCAN",
        description="Whether the user expects to send money, receive money, or just scan",
    )


# --- Shared result parts ------------------------------------------------------


class IndicatorOut(BaseModel):
    code: str
    label: str
    detail: str
    severity: Literal["info", "low", "medium", "high", "critical"]
    weight: float


class RiskAssessmentOut(BaseModel):
    overall_score: float = Field(..., ge=0, le=100)
    risk_level: RiskLevel
    risk_level_description: str
    prediction: str
    confidence: float
    recommendation: str
    explanation: str
    contributions: list[dict[str, Any]] = Field(default_factory=list)
    top_indicators: list[dict[str, Any]] = Field(default_factory=list)


class ScanEnvelope(BaseModel):
    """The persisted scan record that every result is attached to."""

    scan_id: int
    scan_type: ScanType
    status: ScanStatus
    created_at: datetime
    target_label: str


class ScanStatusUpdateRequest(BaseModel):
    status: ScanStatus
    reviewer_name: str | None = None
    assigned_to: str | None = None
    analyst_notes: str | None = None
    escalation_reason: str | None = None


class ScanFeedbackRequest(BaseModel):
    label: str = Field(..., min_length=1, max_length=64)
    confidence: float = Field(..., ge=0.0, le=1.0)
    notes: str | None = Field(default=None, max_length=2000)


class BulkScanStatusUpdateRequest(BaseModel):
    scan_ids: list[int] = Field(..., min_length=1)
    status: ScanStatus
    reviewer_name: str | None = None
    assigned_to: str | None = None
    analyst_notes: str | None = None
    escalation_reason: str | None = None


# --- Modality results ---------------------------------------------------------


class UrlScanResult(BaseModel):
    scan: ScanEnvelope
    url: str
    normalised_url: str
    prediction: str = Field(..., examples=["Phishing"])
    risk_score: float = Field(..., ge=0, le=100)
    risk_level: RiskLevel
    confidence: float
    indicators: list[IndicatorOut]
    explanation: str
    recommendation: str
    risk_assessment: RiskAssessmentOut
    analysis_details: dict[str, Any]


class MessageScanResult(BaseModel):
    scan: ScanEnvelope
    message: str
    prediction: str = Field(..., examples=["Scam"])
    risk_score: float = Field(..., ge=0, le=100)
    risk_level: RiskLevel
    confidence: float
    detected_categories: list[str]
    suspicious_phrases: list[str]
    indicators: list[IndicatorOut]
    explanation: str
    recommendation: str
    risk_assessment: RiskAssessmentOut
    analysis_details: dict[str, Any]


class DocumentScanResult(BaseModel):
    scan: ScanEnvelope
    filename: str
    file_type: str
    file_size: int
    prediction: str = Field(..., examples=["Potential Anomalies Detected"])
    risk_score: float = Field(..., ge=0, le=100)
    risk_level: RiskLevel
    confidence: float
    extracted_text: str
    extracted_text_truncated: bool
    ocr_available: bool
    ocr_used: bool
    metadata: dict[str, Any]
    indicators: list[IndicatorOut]
    explanation: str
    recommendation: str
    disclaimer: str
    risk_assessment: RiskAssessmentOut
    analysis_details: dict[str, Any]


class QrScanResult(BaseModel):
    scan: ScanEnvelope
    raw_payload: str
    qr_type: str
    vpa: str = ""
    payee_name: str = ""
    amount: float | None = None
    currency: str = "INR"
    transaction_note: str = ""
    merchant_code: str = ""
    is_collect_request: bool = False
    prediction: str = Field(..., examples=["Scam", "Suspicious", "Safe"])
    risk_score: float = Field(..., ge=0, le=100)
    risk_level: RiskLevel
    confidence: float
    indicators: list[IndicatorOut]
    explanation: str
    recommendation: str
    risk_assessment: RiskAssessmentOut
    analysis_details: dict[str, Any] = Field(default_factory=dict)
    embedded_url_analysis: dict[str, Any] | None = None


# --- History ------------------------------------------------------------------


class ScanListItem(BaseModel):
    scan_id: int
    scan_type: ScanType
    status: ScanStatus
    reviewer_name: str = ""
    assigned_to: str = ""
    analyst_notes: str = ""
    escalation_reason: str = ""
    status_history: list[dict[str, Any]] = Field(default_factory=list)
    feedback: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    target_label: str
    prediction: str
    risk_score: float
    risk_level: RiskLevel
    indicator_count: int


class ScanListResponse(BaseModel):
    items: list[ScanListItem]
    meta: PaginatedMeta


class ScanDetail(BaseModel):
    scan_id: int
    scan_type: ScanType
    status: ScanStatus
    reviewer_name: str = ""
    assigned_to: str = ""
    analyst_notes: str = ""
    escalation_reason: str = ""
    status_history: list[dict[str, Any]] = Field(default_factory=list)
    feedback: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    target_label: str
    prediction: str
    risk_score: float
    risk_level: RiskLevel
    confidence: float
    explanation: str
    recommendation: str
    indicators: list[IndicatorOut]
    analysis_details: dict[str, Any]
    # Modality-specific extras, present only where relevant.
    url: str | None = None
    message: str | None = None
    filename: str | None = None
    file_type: str | None = None
    file_size: int | None = None
    extracted_text: str | None = None
    ocr_available: bool | None = None
    document_metadata: dict[str, Any] | None = None
    detected_categories: list[str] | None = None
    suspicious_phrases: list[str] | None = None
    disclaimer: str | None = None
    # QR specific extras
    raw_payload: str | None = None
    qr_type: str | None = None
    vpa: str | None = None
    payee_name: str | None = None
    amount: float | None = None
    currency: str | None = None
    transaction_note: str | None = None
    merchant_code: str | None = None
    is_collect_request: bool | None = None
    embedded_url_analysis: dict[str, Any] | None = None
    user: dict[str, Any] | None = None
