"""Fraud risk scoring engine.

Single source of truth for turning a detector's raw output into the platform's
canonical risk vocabulary: a 0-100 score, one of four risk levels, a plain
language explanation and an actionable recommendation.

Supports weighted fusion so that a future multi-input investigation (a URL, the
message it arrived in, and the attached document) can be scored as one case.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.models.scan import RiskLevel, ScanType

# Default fusion weights for multi-modal assessment.
DEFAULT_WEIGHTS: dict[ScanType, float] = {
    ScanType.URL: 0.35,
    ScanType.MESSAGE: 0.30,
    ScanType.DOCUMENT: 0.35,
}

RISK_BANDS: tuple[tuple[float, float, RiskLevel], ...] = (
    (0.0, 29.999, RiskLevel.LOW),
    (30.0, 59.999, RiskLevel.MEDIUM),
    (60.0, 79.999, RiskLevel.HIGH),
    (80.0, 100.0, RiskLevel.CRITICAL),
)

RECOMMENDATIONS: dict[RiskLevel, str] = {
    RiskLevel.LOW: (
        "No major suspicious indicators detected. Continue following standard security "
        "practices."
    ),
    RiskLevel.MEDIUM: (
        "Some suspicious characteristics were identified. Verify the source before interacting."
    ),
    RiskLevel.HIGH: (
        "Multiple suspicious indicators were detected. Avoid sharing sensitive information."
    ),
    RiskLevel.CRITICAL: (
        "High probability of fraudulent activity. Do not interact, enter credentials, send "
        "money, or share OTPs."
    ),
}

LEVEL_DESCRIPTIONS: dict[RiskLevel, str] = {
    RiskLevel.LOW: "Low risk — no meaningful fraud indicators found.",
    RiskLevel.MEDIUM: "Medium risk — some characteristics associated with fraud are present.",
    RiskLevel.HIGH: "High risk — several strong fraud indicators are present together.",
    RiskLevel.CRITICAL: "Critical risk — the pattern closely matches known fraud campaigns.",
}


@dataclass(slots=True)
class ModuleResult:
    """A normalised detector result, ready for fusion."""

    scan_type: ScanType
    risk_score: float
    prediction: str
    confidence: float = 0.0
    indicators: list[dict[str, Any]] = field(default_factory=list)
    explanation: str = ""
    recommendation: str = ""


@dataclass(slots=True)
class RiskAssessmentResult:
    """The engine's canonical output."""

    overall_score: float
    risk_level: RiskLevel
    prediction: str
    confidence: float
    recommendation: str
    explanation: str
    contributions: list[dict[str, Any]] = field(default_factory=list)
    top_indicators: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "overall_score": self.overall_score,
            "risk_level": self.risk_level.value,
            "risk_level_description": LEVEL_DESCRIPTIONS[self.risk_level],
            "prediction": self.prediction,
            "confidence": self.confidence,
            "recommendation": self.recommendation,
            "explanation": self.explanation,
            "contributions": self.contributions,
            "top_indicators": self.top_indicators,
        }


def clamp_score(score: float) -> float:
    """Clamp any numeric score into the 0-100 range."""
    try:
        value = float(score)
    except (TypeError, ValueError):
        return 0.0
    return round(min(100.0, max(0.0, value)), 2)


def classify_risk(score: float) -> RiskLevel:
    """Map a 0-100 score onto a :class:`RiskLevel`."""
    value = clamp_score(score)
    for lower, upper, level in RISK_BANDS:
        if lower <= value <= upper:
            return level
    return RiskLevel.CRITICAL


def recommendation_for(level: RiskLevel) -> str:
    return RECOMMENDATIONS[level]


def module_result_from_detector(scan_type: ScanType, payload: dict[str, Any]) -> ModuleResult:
    """Adapt any detector's dict output into a :class:`ModuleResult`."""
    return ModuleResult(
        scan_type=scan_type,
        risk_score=clamp_score(payload.get("risk_score", 0.0)),
        prediction=str(payload.get("prediction", "Unknown")),
        confidence=float(payload.get("confidence", 0.0) or 0.0),
        indicators=list(payload.get("indicators", []) or []),
        explanation=str(payload.get("explanation", "") or ""),
        recommendation=str(payload.get("recommendation", "") or ""),
    )


def _fuse_explanation(
    results: list[ModuleResult], score: float, level: RiskLevel
) -> str:
    """Compose a combined explanation for a multi-module assessment."""
    parts = [
        f"{result.scan_type.value.lower()} analysis scored "
        f"{result.risk_score:.0f}/100 ({result.prediction})"
        for result in results
    ]
    joined = "; ".join(parts)
    return (
        f"Combined assessment across {len(results)} input(s) produced an overall risk of "
        f"{score:.0f}/100 ({level.value}). Breakdown: {joined}. "
        + LEVEL_DESCRIPTIONS[level]
    )


def assess(
    results: list[ModuleResult] | ModuleResult,
    weights: dict[ScanType, float] | None = None,
) -> RiskAssessmentResult:
    """Score one or more module results.

    A single module passes through its own score and narrative unchanged; several
    modules are fused with the configured weights (renormalised over whichever
    modalities are actually present).
    """
    if isinstance(results, ModuleResult):
        results = [results]
    if not results:
        raise ValueError("At least one module result is required for risk assessment.")

    active_weights = {**DEFAULT_WEIGHTS, **(weights or {})}

    if len(results) == 1:
        only = results[0]
        score = clamp_score(only.risk_score)
        level = classify_risk(score)
        return RiskAssessmentResult(
            overall_score=score,
            risk_level=level,
            prediction=only.prediction,
            confidence=round(float(only.confidence), 3),
            # Prefer the detector's specific, modality-aware advice; fall back to
            # the engine's generic guidance for the band.
            recommendation=only.recommendation or recommendation_for(level),
            explanation=only.explanation or LEVEL_DESCRIPTIONS[level],
            contributions=[
                {
                    "scan_type": only.scan_type.value,
                    "risk_score": score,
                    "prediction": only.prediction,
                    "weight": 1.0,
                    "weighted_score": score,
                }
            ],
            top_indicators=only.indicators[:5],
        )

    total_weight = sum(active_weights.get(r.scan_type, 0.0) for r in results) or 1.0
    contributions: list[dict[str, Any]] = []
    weighted_total = 0.0

    for result in results:
        weight = active_weights.get(result.scan_type, 0.0) / total_weight
        weighted = result.risk_score * weight
        weighted_total += weighted
        contributions.append(
            {
                "scan_type": result.scan_type.value,
                "risk_score": result.risk_score,
                "prediction": result.prediction,
                "weight": round(weight, 4),
                "weighted_score": round(weighted, 2),
            }
        )

    # A single critical modality must not be averaged into safety.
    peak = max(result.risk_score for result in results)
    score = clamp_score(max(weighted_total, peak * 0.85))
    level = classify_risk(score)

    all_indicators: list[dict[str, Any]] = []
    for result in results:
        all_indicators.extend(result.indicators)
    all_indicators.sort(key=lambda ind: float(ind.get("weight", 0) or 0), reverse=True)

    confidences = [float(r.confidence) for r in results if r.confidence]
    confidence = round(sum(confidences) / len(confidences), 3) if confidences else 0.6

    return RiskAssessmentResult(
        overall_score=score,
        risk_level=level,
        prediction=f"{level.value} risk across {len(results)} inputs",
        confidence=confidence,
        recommendation=recommendation_for(level),
        explanation=_fuse_explanation(results, score, level),
        contributions=contributions,
        top_indicators=all_indicators[:6],
    )


def assess_single(scan_type: ScanType, payload: dict[str, Any]) -> RiskAssessmentResult:
    """Convenience wrapper: adapt a detector payload and assess it."""
    return assess(module_result_from_detector(scan_type, payload))
