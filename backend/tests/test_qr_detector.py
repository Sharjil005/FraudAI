"""Tests for QR and UPI payment fraud detection engine and API."""

from __future__ import annotations

import pytest

from app.ml.qr_detector import analyse_qr, parse_qr_payload


def test_parse_upi_uri_standard() -> None:
    uri = "upi://pay?pa=store@okaxis&pn=General+Store&am=250.50&cu=INR&tn=Invoice123&mc=5411"
    parsed = parse_qr_payload(uri)
    assert parsed.qr_type == "UPI"
    assert parsed.vpa == "store@okaxis"
    assert parsed.payee_name == "General Store"
    assert parsed.amount == 250.50
    assert parsed.currency == "INR"
    assert parsed.transaction_note == "Invoice123"
    assert parsed.merchant_code == "5411"
    assert parsed.is_collect is True


def test_parse_standalone_vpa() -> None:
    parsed = parse_qr_payload("merchant.bills@okhdfcbank")
    assert parsed.qr_type == "UPI"
    assert parsed.vpa == "merchant.bills@okhdfcbank"


def test_parse_web_url() -> None:
    parsed = parse_qr_payload("https://secure-login-verify.xyz/login")
    assert parsed.qr_type == "URL"
    assert parsed.url == "https://secure-login-verify.xyz/login"


def test_safe_merchant_upi_qr() -> None:
    uri = "upi://pay?pa=supermarket@okaxis&pn=City+Supermarket&am=450.00&cu=INR&tn=Bill+456&mc=5411"
    res = analyse_qr(uri, claimed_intent="GENERAL_SCAN")
    assert res["risk_level"] in ("LOW", "MEDIUM")
    assert res["prediction"] in ("Safe", "Suspicious")
    assert res["risk_score"] < 40.0


def test_collect_request_inversion_scan_to_receive_trap() -> None:
    uri = "upi://pay?pa=buyer9921@okhdfcbank&pn=OLX+Buyer&am=3500.00&cu=INR&tn=Advance+Payment"
    res = analyse_qr(uri, claimed_intent="RECEIVE_MONEY")
    assert res["risk_level"] == "CRITICAL"
    assert res["prediction"] == "Scam"
    assert res["risk_score"] >= 85.0
    codes = {ind["code"] for ind in res["indicators"]}
    assert "COLLECT_REQUEST_INVERSION" in codes


def test_brand_impersonation_in_vpa() -> None:
    uri = "upi://pay?pa=sbi-refund-desk@okaxis&pn=SBI+Helpline&am=4999.00&cu=INR"
    res = analyse_qr(uri)
    assert res["risk_level"] in ("HIGH", "CRITICAL")
    assert res["risk_score"] >= 75.0
    codes = {ind["code"] for ind in res["indicators"]}
    assert "BRAND_IMPERSONATION_VPA" in codes


def test_cross_brand_vpa_mismatch() -> None:
    uri = "upi://pay?pa=sbicustomer@okhdfcbank&pn=Support&am=100.00&cu=INR"
    res = analyse_qr(uri)
    codes = {ind["code"] for ind in res["indicators"]}
    assert "CROSS_BRAND_VPA" in codes or "BRAND_IMPERSONATION_VPA" in codes


def test_deceptive_transaction_note() -> None:
    uri = "upi://pay?pa=user123@okaxis&pn=User&am=1000.00&cu=INR&tn=Lottery+Cashback+Approval"
    res = analyse_qr(uri)
    codes = {ind["code"] for ind in res["indicators"]}
    assert "DECEPTIVE_TRANSACTION_NOTE" in codes


def test_embedded_url_in_qr() -> None:
    qr_url = "http://192.168.1.50/sbi/netbanking/login.php"
    res = analyse_qr(qr_url)
    assert res["qr_type"] == "URL"
    assert res["risk_level"] in ("HIGH", "CRITICAL")
    assert any("IP_HOST" in ind["code"] or "QR_URL" in ind["code"] for ind in res["indicators"])


def test_api_scan_qr_endpoint(auth_client) -> None:
    payload = {
        "payload": "upi://pay?pa=paytm-refund-support@ybl&pn=Paytm+Care&am=1999.00&cu=INR&tn=Refund+Reversal",
        "claimed_intent": "RECEIVE_MONEY",
    }
    response = auth_client.post(
        "/api/scan/qr",
        json=payload,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["scan"]["scan_type"] == "QR"
    assert data["risk_level"] == "CRITICAL"
    assert data["vpa"] == "paytm-refund-support@ybl"
    assert len(data["indicators"]) >= 2
