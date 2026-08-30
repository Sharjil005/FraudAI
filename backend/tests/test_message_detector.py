"""Message scam detection."""

from __future__ import annotations

import pytest

from app.ml.message_detector import analyse_message

DEMO_BANK_SCAM = (
    "URGENT: Your bank account has been blocked. "
    "Click http://secure-bank-verify.com to verify your details immediately. "
    "Share the OTP received on your phone to complete verification."
)
DEMO_LOTTERY_SCAM = "Congratulations! You have won Rs.50,000 in our lucky draw. Claim now!"

LEGITIMATE_MESSAGES = [
    "Your OTP for login is 442819. Valid for 10 minutes. Do not share it with anyone.",
    "Hi, are we still meeting at 4pm today to review the project report?",
    "Your electricity bill of Rs.1,240 for August is due on 05-09. Pay via the official app.",
    "Your password was changed successfully. Contact support if this wasn't you.",
    "Your Amazon order #402-8871 has been shipped and arrives tomorrow.",
]


def test_demo_bank_scam_is_high_risk() -> None:
    result = analyse_message(DEMO_BANK_SCAM)
    assert result["risk_score"] >= 60
    assert result["risk_level"] in {"HIGH", "CRITICAL"}
    assert result["prediction"] == "Scam"


def test_demo_lottery_scam_is_high_risk() -> None:
    result = analyse_message(DEMO_LOTTERY_SCAM)
    assert result["risk_score"] >= 60
    assert result["prediction"] == "Scam"


def test_scam_categories_are_reported() -> None:
    result = analyse_message(DEMO_BANK_SCAM)
    categories = result["detected_categories"]
    codes = {indicator["code"] for indicator in result["indicators"]}
    assert "OTP / verification code request" in categories
    assert "OTP_REQUEST" in codes
    assert codes & {"BANKING_IMPERSONATION", "URGENCY_PRESSURE"}


def test_lottery_message_reports_prize_category() -> None:
    result = analyse_message(DEMO_LOTTERY_SCAM)
    codes = {indicator["code"] for indicator in result["indicators"]}
    assert "LOTTERY_PRIZE" in codes
    assert result["detected_categories"]


@pytest.mark.parametrize("message", LEGITIMATE_MESSAGES)
def test_legitimate_messages_stay_low_risk(message: str) -> None:
    result = analyse_message(message)
    assert result["risk_score"] < 30, message
    assert result["prediction"] == "Safe", message


def test_genuine_otp_notification_is_not_a_scam() -> None:
    """A message that *delivers* an OTP must not be confused with one that requests it."""
    result = analyse_message(LEGITIMATE_MESSAGES[0])
    codes = {indicator["code"] for indicator in result["indicators"]}
    assert "OTP_REQUEST" not in codes


def test_embedded_phishing_link_raises_the_score() -> None:
    plain = analyse_message("Please review the attached invoice when you get a moment.")
    with_link = analyse_message(
        "Please review the attached invoice: "
        "http://secure-login-verify-account.example.com/login?account=12345"
    )
    assert with_link["risk_score"] > plain["risk_score"]


def test_empty_message_is_rejected() -> None:
    with pytest.raises(ValueError):
        analyse_message("   ")


def test_result_is_explainable() -> None:
    result = analyse_message(DEMO_BANK_SCAM)
    assert result["explanation"]
    assert result["recommendation"]
    assert result["indicators"]
    assert result["suspicious_phrases"]
    for indicator in result["indicators"]:
        assert {"code", "label", "detail", "severity", "weight"} <= indicator.keys()
