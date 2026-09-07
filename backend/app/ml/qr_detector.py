"""QR and UPI fraud detection engine.

Analyzes payment QR codes and UPI payment links (upi://pay?...) to detect:
1. "Scan to receive money" collect/debit traps.
2. Brand and financial institution impersonation in VPAs (e.g. sbi-refund-desk@okaxis).
3. Deceptive transaction notes requesting authorization for fake refunds or prizes.
4. Unofficial or typosquatted PSP handle suffixes.
5. Embedded malicious URLs inside QR codes.
"""

from __future__ import annotations

import io
import re
import urllib.parse
from dataclasses import dataclass
from typing import Any

from app.ml.url_detector import Indicator, analyse_url

# Optional OpenCV probe
try:
    import cv2
    import numpy as np

    CV2_AVAILABLE = True
except Exception:  # pragma: no cover
    CV2_AVAILABLE = False

try:
    from PIL import Image

    PIL_AVAILABLE = True
except Exception:  # pragma: no cover
    PIL_AVAILABLE = False


# Recognised NPCI-approved standard PSP handle suffixes (with leading @)
APPROVED_PSP_HANDLES: frozenset[str] = frozenset(
    {
        "@okhdfcbank",
        "@okaxis",
        "@oksbi",
        "@okicici",
        "@paytm",
        "@ybl",
        "@ibl",
        "@axl",
        "@icici",
        "@sbi",
        "@hdfcbank",
        "@barodampay",
        "@idfcbank",
        "@kotak",
        "@indus",
        "@aubank",
        "@federal",
        "@airtel",
        "@fbl",
        "@postbank",
        "@rbl",
        "@upi",
        "@apl",
        "@waaxis",
        "@wahdfc",
        "@waicici",
        "@wasbi",
        "@jupiteraxis",
        "@sliceaxis",
        "@naviaxis",
        "@freecharge",
        "@pnb",
        "@cnrb",
        "@unionbank",
        "@uco",
        "@cboi",
        "@boi",
        "@sib",
        "@kvb",
        "@dbs",
        "@equitas",
        "@yesbank",
    }
)

# Brands and sensitive service keywords commonly targeted for impersonation
FINANCIAL_BRAND_KEYWORDS: tuple[str, ...] = (
    "sbi",
    "hdfc",
    "icici",
    "axis",
    "pnb",
    "bob",
    "canara",
    "paytm",
    "phonepe",
    "gpay",
    "googlepay",
    "amazon",
    "cred",
    "mobikwik",
    "airtel",
    "bhim",
    "olx",
    "quikr",
    "irctc",
    "tataneu",
)

DECEPTIVE_VPA_TOKENS: tuple[str, ...] = (
    "refund",
    "cashback",
    "kyc",
    "verification",
    "verify",
    "unblock",
    "support",
    "helpline",
    "customercare",
    "helpdesk",
    "care",
    "service",
    "official",
    "security",
    "activation",
    "department",
    "desk",
    "tollfree",
    "claims",
    "rewards",
    "bonus",
)

DECEPTIVE_NOTE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\b(refund|cashback|reward|prize|lottery|bonus)\b", re.IGNORECASE),
    re.compile(r"\b(kyc|verification|verify|unblock|activate|reactivate)\b", re.IGNORECASE),
    re.compile(r"\b(security\s+deposit|processing\s+fee|release\s+code)\b", re.IGNORECASE),
    re.compile(r"\b(scan\s+to\s+receive|receive\s+money|receive\s+payment)\b", re.IGNORECASE),
    re.compile(r"\b(claim\s+now|approval\s+code|tax\s+refund)\b", re.IGNORECASE),
)

_VPA_PATTERN = re.compile(r"^[a-zA-Z0-9.\-_]{2,100}@[a-zA-Z0-9.\-_]{2,50}$")
_URL_PATTERN = re.compile(r"^https?://[^\s<>\"')\]]+", re.IGNORECASE)


def decode_qr_image(file_bytes: bytes) -> str | None:
    """Decode a QR code from image bytes using OpenCV."""
    if not file_bytes:
        return None

    if CV2_AVAILABLE:
        try:
            nparr = np.frombuffer(file_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is not None:
                detector = cv2.QRCodeDetector()
                data, _, _ = detector.detectAndDecode(img)
                if data and data.strip():
                    return data.strip()
        except Exception:
            pass

    # Fallback to PIL if OpenCV fails or is not available
    if PIL_AVAILABLE:
        try:
            with Image.open(io.BytesIO(file_bytes)) as img:
                img.verify()
        except Exception:
            pass

    return None


@dataclass(slots=True)
class ParsedUpiData:
    raw_payload: str
    qr_type: str  # "UPI", "URL", or "TEXT"
    vpa: str = ""
    payee_name: str = ""
    amount: float | None = None
    currency: str = "INR"
    transaction_note: str = ""
    merchant_code: str = ""
    transaction_ref: str = ""
    url: str = ""
    is_collect: bool = False


def parse_qr_payload(raw: str) -> ParsedUpiData:
    """Parse raw QR payload into a structured UPI or URL representation."""
    cleaned = (raw or "").strip()

    # 1. UPI URI scheme: upi://pay?... or upi://mandate?...
    if cleaned.lower().startswith("upi://"):
        parsed = urllib.parse.urlparse(cleaned)
        params = urllib.parse.parse_qs(parsed.query)

        vpa = params.get("pa", [""])[0].strip()
        payee_name = params.get("pn", [""])[0].strip()
        amount_str = params.get("am", [""])[0].strip()
        currency = params.get("cu", ["INR"])[0].strip() or "INR"
        note = params.get("tn", [""])[0].strip()
        merchant_code = params.get("mc", [""])[0].strip()
        ref = params.get("tr", [""])[0].strip()
        url = params.get("url", [""])[0].strip()

        amount = None
        if amount_str:
            try:
                amount = float(amount_str)
            except ValueError:
                amount = None

        return ParsedUpiData(
            raw_payload=cleaned,
            qr_type="UPI",
            vpa=vpa,
            payee_name=payee_name,
            amount=amount,
            currency=currency,
            transaction_note=note,
            merchant_code=merchant_code,
            transaction_ref=ref,
            url=url,
            is_collect=True,
        )

    # 2. Standalone VPA (e.g. store@okaxis or 9876543210@paytm)
    if _VPA_PATTERN.match(cleaned):
        return ParsedUpiData(
            raw_payload=cleaned,
            qr_type="UPI",
            vpa=cleaned,
            is_collect=True,
        )

    # 3. Standard web URL
    if _URL_PATTERN.match(cleaned):
        return ParsedUpiData(
            raw_payload=cleaned,
            qr_type="URL",
            url=cleaned,
        )

    # 4. Generic text
    return ParsedUpiData(
        raw_payload=cleaned,
        qr_type="TEXT",
    )


def _evaluate_vpa(vpa: str) -> list[Indicator]:
    """Inspect the VPA handle for impersonation and handle anomalies."""
    indicators: list[Indicator] = []
    if not vpa or "@" not in vpa:
        return indicators

    handle_user, handle_suffix = vpa.rsplit("@", 1)
    handle_suffix_full = f"@{handle_suffix.lower()}"
    user_lower = handle_user.lower()

    # 1. Impersonation: brand name + deceptive token (e.g. sbi-refund-desk@okaxis)
    matched_brands = [b for b in FINANCIAL_BRAND_KEYWORDS if b in user_lower]
    matched_tokens = [t for t in DECEPTIVE_VPA_TOKENS if t in user_lower]

    if matched_brands and matched_tokens:
        indicators.append(
            Indicator(
                code="BRAND_IMPERSONATION_VPA",
                label=f"Probable '{matched_brands[0].upper()}' impersonation in UPI handle",
                detail=(
                    f"The UPI ID '{vpa}' combines the brand '{matched_brands[0].upper()}' "
                    f"with support/refund terms ('{matched_tokens[0]}') on an individual account."
                ),
                severity="critical",
                weight=32.0,
            )
        )
    elif matched_brands:
        # Check if the suffix is the official bank handle
        if (
            "sbi" in matched_brands and handle_suffix_full not in ("@sbi", "@oksbi")
        ) or (
            "hdfc" in matched_brands and handle_suffix_full not in ("@hdfcbank", "@okhdfcbank")
        ) or (
            "paytm" in matched_brands and handle_suffix_full != "@paytm"
        ):
            indicators.append(
                Indicator(
                    code="CROSS_BRAND_VPA",
                    label=f"Suspicious '{matched_brands[0].upper()}' handle mismatch",
                    detail=(
                        f"The handle mentions '{matched_brands[0].upper()}' but routes to '{handle_suffix_full}'. "
                        "Legitimate institutions do not collect payments through competitor PSP handles."
                    ),
                    severity="high",
                    weight=24.0,
                )
            )

    # 2. Deceptive keywords alone without brand (e.g., support-refund@okaxis)
    elif matched_tokens:
        indicators.append(
            Indicator(
                code="DECEPTIVE_VPA_KEYWORDS",
                label="Support/Refund terminology in personal handle",
                detail=(
                    f"The handle contains '{matched_tokens[0]}', commonly used by fraudsters to "
                    "convince victims that a personal account is an official payment desk."
                ),
                severity="medium",
                weight=15.0,
            )
        )

    # 3. Unofficial or unusual PSP handle
    if handle_suffix_full not in APPROVED_PSP_HANDLES:
        indicators.append(
            Indicator(
                code="UNRECOGNIZED_PSP_HANDLE",
                label="Unrecognized PSP bank suffix",
                detail=(
                    f"The suffix '{handle_suffix_full}' is not a standard NPCI-approved bank PSP handle. "
                    "Verify the merchant identity carefully before proceeding."
                ),
                severity="medium",
                weight=12.0,
            )
        )

    # 4. Excessive digits or hyphen stuffing in username
    digits = sum(c.isdigit() for c in user_lower)
    special = sum(c in ".-_" for c in user_lower)
    if digits > 6 and special >= 2:
        indicators.append(
            Indicator(
                code="DISPOSABLE_VPA_STRUCTURE",
                label="Disposable / Algorithmic UPI ID structure",
                detail="The UPI handle has heavy digit and separator stuffing typical of disposable scam accounts.",
                severity="low",
                weight=8.0,
            )
        )

    return indicators


def _evaluate_note(note: str) -> list[Indicator]:
    """Inspect transaction note (tn) for deceptive cues."""
    indicators: list[Indicator] = []
    if not note:
        return indicators

    for pattern in DECEPTIVE_NOTE_PATTERNS:
        match = pattern.search(note)
        if match:
            matched_phrase = match.group(0)
            indicators.append(
                Indicator(
                    code="DECEPTIVE_TRANSACTION_NOTE",
                    label=f"Suspicious note: '{matched_phrase}'",
                    detail=(
                        f"The payment description contains '{matched_phrase}'. Fraudsters use false refund, "
                        "KYC, or prize notes to trick victims into entering their UPI PIN."
                    ),
                    severity="high",
                    weight=22.0,
                )
            )
            break

    return indicators


def analyse_qr(
    payload: str, claimed_intent: str = "GENERAL_SCAN"
) -> dict[str, Any]:
    """Analyze a QR code payload or UPI string and return a full risk assessment."""
    parsed = parse_qr_payload(payload)
    indicators: list[Indicator] = []

    # 1. URL payload inside QR code
    embedded_url_analysis: dict[str, Any] | None = None
    if parsed.qr_type == "URL":
        url_analysis = analyse_url(parsed.url)
        embedded_url_analysis = url_analysis
        for ind in url_analysis.get("indicators", []):
            indicators.append(
                Indicator(
                    code=f"QR_URL_{ind.get('code', 'RISK')}",
                    label=f"Link Risk: {ind.get('label', '')}",
                    detail=ind.get("detail", ""),
                    severity=ind.get("severity", "medium"),
                    weight=float(ind.get("weight", 10.0)),
                )
            )

    # 2. UPI specific checks
    if parsed.qr_type == "UPI":
        # Check VPA
        if parsed.vpa:
            indicators.extend(_evaluate_vpa(parsed.vpa))
        else:
            indicators.append(
                Indicator(
                    code="MISSING_VPA",
                    label="Missing Payee Address (pa)",
                    detail="The payment URI does not specify a destination VPA.",
                    severity="high",
                    weight=20.0,
                )
            )

        # Check Transaction Note
        if parsed.transaction_note:
            indicators.extend(_evaluate_note(parsed.transaction_note))

        # Check Claimed Intent: "Scan to Receive Money" Trap
        if claimed_intent == "RECEIVE_MONEY":
            indicators.append(
                Indicator(
                    code="COLLECT_REQUEST_INVERSION",
                    label="CRITICAL: 'Scan to Receive Money' Fraud Trap",
                    detail=(
                        "You indicated that you expect to RECEIVE funds. However, scanning a QR code or "
                        "approving this UPI link will DEBIT money from your bank account. "
                        "You NEVER need to enter a UPI PIN or scan a QR code to receive money."
                    ),
                    severity="critical",
                    weight=38.0,
                )
            )

        # Check amount patterns
        if parsed.amount is not None:
            if parsed.amount >= 2000 and not parsed.merchant_code:
                indicators.append(
                    Indicator(
                        code="UNVERIFIED_HIGH_AMOUNT",
                        label="High amount on personal (non-merchant) handle",
                        detail=(
                            f"The transaction is for ₹{parsed.amount:,.2f} to an unverified individual handle "
                            "without a registered merchant category code (mc)."
                        ),
                        severity="medium",
                        weight=10.0,
                    )
                )

    # 3. Calculate weighted score with diminishing returns
    indicators.sort(key=lambda i: i.weight, reverse=True)
    raw_score = 0.0
    decay = 0.85
    for i, ind in enumerate(indicators):
        raw_score += ind.weight * (decay**i)

    # Hard floors for severe conditions
    codes = {ind.code for ind in indicators}
    floor = 0.0
    if "COLLECT_REQUEST_INVERSION" in codes:
        floor = max(floor, 88.0)
    if "BRAND_IMPERSONATION_VPA" in codes:
        floor = max(floor, 78.0)
    if "CROSS_BRAND_VPA" in codes:
        floor = max(floor, 65.0)

    score = round(min(100.0, max(floor, raw_score)), 2)

    # Determine risk level
    if score >= 80.0:
        level = "CRITICAL"
        prediction = "Scam"
    elif score >= 60.0:
        level = "HIGH"
        prediction = "Suspicious"
    elif score >= 30.0:
        level = "MEDIUM"
        prediction = "Suspicious"
    else:
        level = "LOW"
        prediction = "Safe"

    # Explanation and recommendation
    if "COLLECT_REQUEST_INVERSION" in codes:
        explanation = (
            "CRITICAL ALERT: This payment request is configured to DEBIT your account. "
            "A scammer is attempting to reverse the payment flow so you authorize a transfer to them."
        )
        recommendation = (
            "DO NOT SCAN OR APPROVE. Entering your UPI PIN will immediately transfer money out of your account. "
            "Remember: Receiving money NEVER requires entering a UPI PIN or scanning a QR code."
        )
    elif "BRAND_IMPERSONATION_VPA" in codes:
        explanation = (
            f"The destination address '{parsed.vpa}' appears to impersonate an official brand or support team "
            "using a personal banking handle."
        )
        recommendation = (
            "Do not send money. Official organizations never request payments through individual consumer UPI handles."
        )
    elif indicators:
        explanation = f"Detected {len(indicators)} risk factor(s) in this payment request: {indicators[0].label}."
        recommendation = (
            "Carefully verify the payee identity and registered merchant name before proceeding."
        )
    else:
        explanation = "The QR code / UPI payment link shows standard format with no brand impersonation or deceptive notes."
        recommendation = "Always double-check the recipient name on your payment app before entering your UPI PIN."

    return {
        "raw_payload": parsed.raw_payload,
        "qr_type": parsed.qr_type,
        "vpa": parsed.vpa,
        "payee_name": parsed.payee_name,
        "amount": parsed.amount,
        "currency": parsed.currency,
        "transaction_note": parsed.transaction_note,
        "merchant_code": parsed.merchant_code,
        "is_collect_request": parsed.is_collect,
        "risk_score": score,
        "risk_level": level,
        "prediction": prediction,
        "confidence": 0.92 if indicators else 0.85,
        "explanation": explanation,
        "recommendation": recommendation,
        "indicators": [ind.to_dict() for ind in indicators],
        "embedded_url_analysis": embedded_url_analysis,
    }
