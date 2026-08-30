"""URL feature extraction and phishing classification."""

from __future__ import annotations

import pytest

from app.ml.features import FEATURE_NAMES, extract_url_features, is_valid_url, split_host
from app.ml.url_detector import analyse_url


def test_feature_vector_matches_declared_names() -> None:
    features = extract_url_features("https://example.com/path")
    assert len(features.to_vector()) == len(FEATURE_NAMES)


def test_split_host_handles_multipart_suffix() -> None:
    registered_domain, tld, subdomains = split_host("login.hdfcbank.co.in")
    assert registered_domain == "hdfcbank.co.in"
    assert tld == "co.in"
    assert subdomains == ["login"]


def test_split_host_drops_www() -> None:
    registered_domain, _, subdomains = split_host("www.google.com")
    assert registered_domain == "google.com"
    assert subdomains == []


def test_scheme_less_input_is_normalised_not_invented() -> None:
    """A missing scheme must not be silently upgraded to HTTPS."""
    features = extract_url_features("example.com/login")
    assert features.has_https == 0


def test_ip_host_is_detected() -> None:
    features = extract_url_features("http://192.168.10.4/login.php")
    assert features.has_ip_host == 1


@pytest.mark.parametrize(
    "raw",
    ["", "   ", "not a url at all", "http://", "javascript:alert(1)"],
)
def test_invalid_urls_are_rejected(raw: str) -> None:
    ok, error = is_valid_url(raw)
    assert ok is False
    assert error


def test_valid_url_is_accepted() -> None:
    ok, error = is_valid_url("https://example.com")
    assert ok is True
    assert error == ""


def test_analyse_url_rejects_invalid_input() -> None:
    with pytest.raises(ValueError):
        analyse_url("nonsense input")


# --- Required demo scenario ---------------------------------------------------


def test_demo_phishing_url_is_high_risk() -> None:
    result = analyse_url("http://secure-login-verify-account.example.com/login?account=12345")
    assert result["risk_score"] >= 60
    assert result["risk_level"] in {"HIGH", "CRITICAL"}
    assert result["prediction"] == "Phishing"


def test_raw_ip_credential_page_is_critical() -> None:
    result = analyse_url("http://192.168.44.19/hdfc-netbanking/login.php")
    assert result["risk_score"] >= 60
    assert result["prediction"] == "Phishing"


def test_legitimate_urls_are_low_risk() -> None:
    for url in ("https://www.google.com", "https://github.com", "https://www.wikipedia.org"):
        result = analyse_url(url)
        assert result["risk_score"] < 30, url
        assert result["prediction"] == "Safe", url


def test_legitimate_login_page_is_not_flagged() -> None:
    result = analyse_url("https://accounts.google.com/signin")
    assert result["risk_level"] == "LOW"


def test_brand_impersonation_is_flagged() -> None:
    result = analyse_url("http://paypal.secure-login-update.xyz/verify")
    codes = {indicator["code"] for indicator in result["indicators"]}
    assert "BRAND_IMPERSONATION" in codes


# --- Explainability contract --------------------------------------------------


def test_result_is_explainable() -> None:
    result = analyse_url("http://secure-login-verify-account.example.com/login?account=12345")
    assert result["explanation"]
    assert result["recommendation"]
    assert result["indicators"], "a risky URL must expose contributing indicators"
    for indicator in result["indicators"]:
        assert {"code", "label", "detail", "severity", "weight"} <= indicator.keys()
    assert 0 <= result["risk_score"] <= 100
    assert 0 <= result["confidence"] <= 100
