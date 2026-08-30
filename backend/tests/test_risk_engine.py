"""Risk scoring, banding and fusion."""

from __future__ import annotations

import pytest

from app.models.scan import RiskLevel, ScanType
from app.services.risk_engine import (
    DEFAULT_WEIGHTS,
    ModuleResult,
    assess,
    assess_single,
    classify_risk,
    clamp_score,
    recommendation_for,
)


@pytest.mark.parametrize(
    ("score", "expected"),
    [
        (0, RiskLevel.LOW),
        (29, RiskLevel.LOW),
        (29.9, RiskLevel.LOW),
        (30, RiskLevel.MEDIUM),
        (59.9, RiskLevel.MEDIUM),
        (60, RiskLevel.HIGH),
        (79.9, RiskLevel.HIGH),
        (80, RiskLevel.CRITICAL),
        (100, RiskLevel.CRITICAL),
    ],
)
def test_risk_bands_match_specification(score: float, expected: RiskLevel) -> None:
    assert classify_risk(score) is expected


@pytest.mark.parametrize(("raw", "expected"), [(-15, 0.0), (0, 0.0), (142, 100.0), (55.567, 55.57)])
def test_scores_are_clamped_and_rounded(raw: float, expected: float) -> None:
    assert clamp_score(raw) == expected


def test_every_band_has_a_recommendation() -> None:
    for level in RiskLevel:
        assert recommendation_for(level)


def test_fusion_weights_match_specification() -> None:
    assert DEFAULT_WEIGHTS[ScanType.URL] == 0.35
    assert DEFAULT_WEIGHTS[ScanType.MESSAGE] == 0.30
    assert DEFAULT_WEIGHTS[ScanType.DOCUMENT] == 0.35
    assert round(sum(DEFAULT_WEIGHTS.values()), 6) == 1.0


def test_single_module_assessment_passes_through() -> None:
    result = assess_single(
        ScanType.URL,
        {
            "risk_score": 72.0,
            "prediction": "Phishing",
            "confidence": 88.0,
            "explanation": "Credential harvesting pattern detected.",
            "indicators": [{"code": "NO_HTTPS", "label": "No HTTPS", "weight": 14, "severity": "medium", "detail": "x"}],
        },
    )
    assert result.risk_level is RiskLevel.HIGH
    assert result.overall_score == 72.0
    assert result.recommendation
    assert result.explanation


def test_multi_module_fusion_is_weighted() -> None:
    result = assess(
        [
            ModuleResult(
                scan_type=ScanType.URL, risk_score=80.0, prediction="Phishing", confidence=90.0
            ),
            ModuleResult(
                scan_type=ScanType.MESSAGE,
                risk_score=40.0,
                prediction="Suspicious",
                confidence=70.0,
            ),
        ]
    )
    # Renormalised weights: URL 0.538, MESSAGE 0.462 -> ~61.5, floored at peak * 0.85 = 68.
    assert 60 <= result.overall_score <= 80
    assert result.risk_level is RiskLevel.HIGH


def test_a_single_critical_signal_is_not_averaged_away() -> None:
    result = assess(
        [
            ModuleResult(
                scan_type=ScanType.URL, risk_score=95.0, prediction="Phishing", confidence=95.0
            ),
            ModuleResult(
                scan_type=ScanType.MESSAGE, risk_score=5.0, prediction="Safe", confidence=80.0
            ),
        ]
    )
    assert result.overall_score >= 80
    assert result.risk_level is RiskLevel.CRITICAL


def test_assessment_serialises_for_the_api() -> None:
    result = assess_single(
        ScanType.MESSAGE,
        {"risk_score": 12.0, "prediction": "Safe", "confidence": 91.0, "indicators": []},
    )
    payload = result.to_dict()
    assert {"overall_score", "risk_level", "prediction", "confidence", "recommendation", "explanation"} <= payload.keys()
    assert payload["risk_level"] == RiskLevel.LOW.value


def test_empty_input_is_rejected() -> None:
    with pytest.raises(ValueError):
        assess([])
