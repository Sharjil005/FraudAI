"""Scam message detection engine.

Hybrid NLP: a weighted rule/pattern engine across 15 fraud categories provides
the explanation, a TF-IDF + LogisticRegression model provides a learned second
opinion, and any URL embedded in the message is scored by the URL detector and
folded back into the message risk.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Any

from app.ml.model_store import registry
from app.ml.url_detector import Indicator, analyse_url

HEURISTIC_WEIGHT = 0.62
MODEL_WEIGHT = 0.38

SAFE = "Safe"
SUSPICIOUS = "Suspicious"
SCAM = "Scam"

_URL_PATTERN = re.compile(
    r"(?:https?://|www\.)[^\s<>\"')\]]+|(?<![\w.])[a-z0-9-]+\.(?:com|net|org|in|co|io|xyz|top|tk|ml|ga|cf|gq|info|online|site|click|buzz|link|icu|sbs)(?:/[^\s<>\"')\]]*)?",
    re.IGNORECASE,
)
_MONEY_PATTERN = re.compile(
    r"(?:₹|rs\.?|inr|usd|\$|€|£)\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:lakh|lac|crore|k|million|mn))?"
    r"|\d[\d,]{3,}\s?(?:rupees|dollars|lakh|lac|crore)",
    re.IGNORECASE,
)
_PHONE_PATTERN = re.compile(r"(?:\+?\d[\d\s\-()]{8,15}\d)")
_ZERO_WIDTH = re.compile(r"[​-‏‪-‮﻿]")


@dataclass(frozen=True, slots=True)
class Pattern:
    """A regex signal belonging to a fraud category."""

    regex: re.Pattern[str]
    weight: float
    note: str


@dataclass(frozen=True, slots=True)
class Category:
    """A named fraud family with its own patterns and base weight."""

    code: str
    label: str
    description: str
    patterns: tuple[Pattern, ...]


def _p(expression: str, weight: float, note: str) -> Pattern:
    return Pattern(re.compile(expression, re.IGNORECASE), weight, note)


# --- Category definitions -----------------------------------------------------

CATEGORIES: tuple[Category, ...] = (
    Category(
        "OTP_REQUEST",
        "OTP / verification code request",
        "The message asks you to share a one-time password or verification code.",
        (
            _p(r"\b(share|send|provide|forward|give|tell|confirm|enter)\b[^.]{0,30}\bo[\W_]?t[\W_]?p\b", 26, "explicit request to share an OTP"),
            _p(r"\bo[\W_]?t[\W_]?p\b[^.]{0,25}\b(to (complete|verify|confirm|process|receive)|with (our|the) (agent|executive|officer))", 24, "OTP tied to completing a transaction"),
            _p(r"\b(share|send|provide|enter)\b[^.]{0,30}\b(verification|security|one[\s-]?time)\s+code\b", 22, "request for a verification code"),
            _p(r"\b(6|four|six)\s?digit\s+(code|otp|pin)\b[^.]{0,40}\b(share|send|reply|enter|verify)", 20, "six-digit code requested"),
            _p(r"\b(share|send|confirm|enter)\b[^.]{0,25}\b(upi\s?pin|atm\s?pin|card\s?pin)\b", 26, "PIN requested"),
        ),
    ),
    Category(
        "BANKING_IMPERSONATION",
        "Bank / financial impersonation",
        "The message pretends to come from a bank or payment provider.",
        (
            _p(r"\b(bank|banking|net\s?banking|account)\b[^.]{0,40}\b(blocked|block(ed|ing)?|suspend(ed)?|frozen|freeze|deactivat(ed|e)|locked|on hold|closed)\b", 22, "account blocked/suspended claim"),
            _p(r"\b(debit|credit|atm)\s?card\b[^.]{0,40}\b(block(ed)?|suspend(ed)?|expired|deactivat(ed|e)|hold)\b", 20, "card blocked claim"),
            _p(r"\b(re[\s-]?register|re[\s-]?verify|revalidate)\b[^.]{0,30}\b(account|net\s?banking|bank)\b", 20, "asked to re-register bank account"),
            _p(r"\b(confirm|share|verify|submit|update)\b[^.]{0,30}\b(cvv|card\s?number|card\s?details|ifsc|account\s?number|passbook)\b", 24, "bank credential harvesting"),
            _p(r"\bbank\s+server\b[^.]{0,40}\b(upgrad|maintenanc|migrat)", 18, "fake bank server upgrade"),
            _p(r"\b(unauthoris?ed|suspicious|unusual)\s+(transaction|login|activity|debit)\b", 14, "fake fraud alert"),
        ),
    ),
    Category(
        "LOTTERY_PRIZE",
        "Lottery / prize scam",
        "The message claims you have won money, a prize or a gift.",
        (
            _p(r"\byou('ve| have)?\s+(been\s+)?(won|win|selected as (the )?winner)\b", 24, "claim that you have won"),
            _p(r"\b(lucky\s+(draw|winner)|lottery|jackpot|kbc|prize\s+money)\b", 22, "lottery/prize wording"),
            _p(r"\bclaim\b[^.]{0,25}\b(prize|reward|gift|winning|voucher|amount)\b", 20, "asked to claim a prize"),
            _p(r"\b(free|complimentary)\s+(iphone|gift|voucher|recharge|laptop|car|holiday|coupon)\b", 18, "free high-value item"),
            _p(r"\b(congratulations|congrats)\b", 10, "congratulatory opening"),
            _p(r"\b(reward|cashback|bonus)\s+points?\b[^.]{0,30}\b(expir|redeem|withdraw)", 14, "expiring reward points"),
        ),
    ),
    Category(
        "KYC_SCAM",
        "KYC / document verification scam",
        "The message demands urgent KYC or identity re-verification.",
        (
            _p(r"\b(kyc|e[\s-]?kyc)\b[^.]{0,40}\b(update|pending|incomplete|expir|complet|verif|submit)", 24, "KYC update demand"),
            _p(r"\b(update|complete|submit)\b[^.]{0,20}\b(kyc|aadhaar|aadhar|pan\s?card)\b", 22, "identity document demand"),
            _p(r"\b(aadhaar|aadhar|pan)\b[^.]{0,40}\b(link|not linked|penalty|fraudulent|misuse|freeze)", 18, "Aadhaar/PAN pressure"),
            _p(r"\bsim\s?card\b[^.]{0,30}\b(deactivat|block|disconnect)", 20, "SIM deactivation threat"),
        ),
    ),
    Category(
        "URGENCY_PRESSURE",
        "Urgency and time pressure",
        "The message manufactures a deadline to stop you from thinking it through.",
        (
            _p(r"\b(urgent(ly)?|immediate(ly)?|right now|at once|asap)\b", 12, "urgent wording"),
            _p(r"\b(act|apply|click|call|pay|verify|respond)\s+(now|today|immediately)\b", 14, "immediate call to action"),
            _p(r"\bwithin\s+\d+\s*(minute|hour|hr|day)s?\b", 13, "explicit short deadline"),
            _p(r"\b(before|by)\s+(midnight|today|tonight|tomorrow|end of day)\b", 13, "same-day deadline"),
            _p(r"\b(last|final)\s+(chance|reminder|notice|warning|call)\b", 15, "final-notice pressure"),
            _p(r"\b(limited\s+(time|offer|period|slots?|seats?)|only\s+\d+\s+(slots?|seats?)\s+left|hurry|expires?\s+(today|soon|tonight))\b", 14, "scarcity pressure"),
            _p(r"\bdo not (share|tell|inform)\b[^.]{0,25}\b(anyone|family|bank)\b[^.]{0,20}\b(offer|scheme|prize)", 16, "secrecy request"),
        ),
    ),
    Category(
        "THREAT_INTIMIDATION",
        "Threats and intimidation",
        "The message threatens legal, financial or personal consequences.",
        (
            _p(r"\b(legal action|court (case|proceeding)|arrest warrant|police (case|complaint|cyber cell)|fir\b|lawsuit)\b", 24, "legal threat"),
            _p(r"\b(will be|permanently)\s+(deleted|deactivated|terminated|disconnected|suspended|blocked)\b", 18, "service termination threat"),
            _p(r"\b(penalty|fine|settlement amount|outstanding amount)\b[^.]{0,40}\b(pay|avoid|before)", 18, "penalty demand"),
            _p(r"\b(avoid|prevent)\s+(suspension|deactivation|blocking|disconnection|legal)", 16, "threat avoidance framing"),
            _p(r"\b(virus|malware|hacked|compromised)\b[^.]{0,40}\b(install|download|click|call)", 20, "fake infection warning"),
        ),
    ),
    Category(
        "CREDENTIAL_REQUEST",
        "Credential / personal data request",
        "The message asks for passwords, logins or identity documents.",
        (
            _p(r"\b(enter|share|submit|confirm|provide|send|reply with)\b[^.]{0,30}\b(password|passwd|login (id|details|credential)|username|user id)\b", 26, "password requested"),
            _p(r"\b(share|send|submit|upload)\b[^.]{0,30}\b(aadhaar|aadhar|pan\s?card|passport|bank\s?(details|account)|passbook|ifsc)\b", 22, "identity/bank data requested"),
            _p(r"\b(verify|update|confirm)\s+your\s+(account|identity|details|profile|payment (details|method)|card)\b", 18, "verification bait"),
            _p(r"\breply\s+with\s+your\s+(full name|name|bank|account|details|card)", 20, "reply-with-details request"),
        ),
    ),
    Category(
        "PAYMENT_REQUEST",
        "Advance-fee / payment request",
        "The message asks for money up front, a hallmark of advance-fee fraud.",
        (
            _p(r"\b(registration|processing|joining|verification|clearance|delivery|redelivery|security|convenience|membership)\s+(fee|charge|deposit|amount)\b", 24, "advance fee demand"),
            _p(r"\bpay\b[^.]{0,40}\b(to (claim|receive|release|start|unlock|activate|process)|and (claim|receive|get))\b", 22, "pay-to-receive framing"),
            _p(r"\b(send|transfer|deposit|remit)\b[^.]{0,25}\b(money|amount|funds|usdt|btc|bitcoin|rs\.?|₹)\b", 22, "money transfer request"),
            _p(r"\b(pay only|just pay|minimum deposit|pay just)\b", 20, "trivialised payment"),
            _p(r"\b(upi\s?id|wallet address|account number)\b[^.]{0,30}\b(send|transfer|pay|deposit)", 20, "payment destination supplied"),
            _p(r"\b(send|transfer)\b[^.]{0,25}\b(money|amount)\b[^.]{0,30}\b(right now|immediately|urgently|now)\b", 24, "urgent money transfer"),
        ),
    ),
    Category(
        "JOB_SCAM",
        "Fake job / work-from-home scam",
        "The message advertises implausible earnings for trivial work.",
        (
            _p(r"\b(work from home|part[\s-]?time job|data entry job|online job)\b", 16, "work-from-home offer"),
            _p(r"\bearn\b[^.]{0,30}\b(per day|daily|per month|weekly|monthly)\b", 18, "per-day earnings claim"),
            _p(r"\b(no interview|without (interview|experience|documents)|immediate hiring|direct joining)\b", 18, "no-screening hiring claim"),
            _p(r"\b(liking|watching|subscribing to)\s+(youtube\s+)?(videos|channels|posts)\b", 20, "task-scam wording"),
            _p(r"\b(telegram|whatsapp)\s+(group|channel)\b[^.]{0,30}\b(join|add)", 14, "off-platform group funnel"),
        ),
    ),
    Category(
        "INVESTMENT_SCAM",
        "Investment / guaranteed-return scam",
        "The message promises returns that no legitimate investment can guarantee.",
        (
            _p(r"\b(guaranteed|assured|100%|risk[\s-]?free)\s+(return|profit|income|earning|accuracy)\b", 26, "guaranteed return promise"),
            _p(r"\b(double|triple|3x|2x|5x)\s+your\s+(money|investment|capital|bitcoin|btc)\b", 26, "money-doubling promise"),
            _p(r"\b\d{2,3}\s?%\s+(return|profit|monthly|daily|weekly)\b", 22, "implausible percentage return"),
            _p(r"\b(trading (bot|tips|group)|forex|ipo pre[\s-]?listing|vip (membership|signal))\b", 18, "trading-scam wording"),
            _p(r"\bno risk\b", 18, "explicit no-risk claim"),
        ),
    ),
    Category(
        "CRYPTO_SCAM",
        "Cryptocurrency scam",
        "The message involves crypto transfers or wallet credentials.",
        (
            _p(r"\b(bitcoin|btc|eth(ereum)?|usdt|crypto(currency)?|binance|metamask|coinbase)\b", 14, "cryptocurrency mention"),
            _p(r"\b(wallet)\b[^.]{0,30}\b(recover|restore|seed|phrase|private key|verify|suspend)", 26, "wallet credential phishing"),
            _p(r"\b(seed phrase|private key|recovery phrase|mnemonic)\b", 28, "seed phrase request"),
            _p(r"\bsend\b[^.]{0,25}\b(btc|usdt|eth|bitcoin)\b[^.]{0,40}\b(receive|get|double|return)", 26, "crypto doubling request"),
        ),
    ),
    Category(
        "LOAN_REFUND_SCAM",
        "Fake loan / refund / subsidy offer",
        "The message dangles instant credit, a refund or a government benefit.",
        (
            _p(r"\b(loan|credit)\b[^.]{0,40}\b(approved|pre[\s-]?approved|instant(ly)?|without documents|sanctioned)\b", 22, "instant loan approval"),
            _p(r"\b(refund|cashback|reimbursement)\b[^.]{0,40}\b(approved|pending|processed|claim|receive|credit)\b", 18, "unexpected refund claim"),
            _p(r"\b(government|govt|pm|central)\s+(subsidy|scheme|grant|yojana|benefit)\b", 18, "fake government benefit"),
            _p(r"\b(income tax|it)\s+refund\b", 20, "tax refund lure"),
            _p(r"\bscholarship\b[^.]{0,40}\b(approved|selected|submit|pay)", 18, "scholarship lure"),
        ),
    ),
    Category(
        "IMPERSONATION",
        "Identity impersonation",
        "The sender claims to be someone you know or an authority figure.",
        (
            _p(r"\b(this is|hi)\s+(mom|dad|mum|papa|mummy|your (son|daughter|brother|sister))\b", 24, "family impersonation"),
            _p(r"\bnew number\b[^.]{0,50}\b(phone (broke|lost|stolen)|old number)", 22, "new-number pretext"),
            _p(r"\b(i am|this is)\s+(a )?(lawyer|barrister|advocate|bank manager|officer|police|cyber cell|inspector)\b", 22, "authority impersonation"),
            _p(r"\b(accident|hospital|emergency)\b[^.]{0,50}\b(transfer|send|money|urgent)", 26, "emergency money pretext"),
            _p(r"\b(unclaimed|inheritance|beneficiary|next of kin)\b[^.]{0,50}\b(fund|money|estate|million)", 26, "inheritance fraud"),
        ),
    ),
    Category(
        "TECH_SUPPORT_SCAM",
        "Fake support / app installation",
        "The message pushes you to install software or call an unofficial number.",
        (
            _p(r"\b(download|install)\b[^.]{0,30}\b(apk|app|application|software|tool|antivirus)\b", 22, "app/APK installation push"),
            _p(r"\b\.apk\b", 24, "direct APK reference"),
            _p(r"\b(call|dial|contact)\b[^.]{0,25}\b(this|below|following)\s+(number|no\.?)\b", 18, "call-this-number instruction"),
            _p(r"\b(remote (access|desktop)|anydesk|teamviewer|screen shar)", 26, "remote access request"),
        ),
    ),
    Category(
        "SUSPICIOUS_LINK",
        "Suspicious link or call to action",
        "The message pressures you to open a link.",
        (
            _p(r"\bclick\s+(here|this|the\s+link|below|now)\b", 18, "generic click-here bait"),
            _p(r"\b(open|visit|tap)\s+(this|the)\s+(link|url|website|portal)\b", 14, "open-this-link instruction"),
            _p(r"\b(link|url)\b[^.]{0,30}\b(below|attached|shared)\b", 10, "link reference"),
            _p(r"\b(spin the wheel|scratch (card|to win)|complete (the )?survey)\b", 20, "gamified bait"),
        ),
    ),
)


# --- Text preparation ---------------------------------------------------------


def normalise_text(text: str) -> str:
    """Lowercase, strip invisible characters and normalise unicode punctuation."""
    cleaned = unicodedata.normalize("NFKC", text or "")
    cleaned = _ZERO_WIDTH.sub("", cleaned)
    cleaned = cleaned.replace("’", "'").replace("‘", "'")
    cleaned = cleaned.replace("“", '"').replace("”", '"')
    cleaned = re.sub(r"[\r\n\t]+", " ", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    return cleaned.strip().lower()


def _text_statistics(original: str, normalised: str) -> dict[str, Any]:
    letters = [ch for ch in original if ch.isalpha()]
    uppercase_ratio = (
        sum(ch.isupper() for ch in letters) / len(letters) if letters else 0.0
    )
    words = re.findall(r"[a-z']+", normalised)
    return {
        "character_count": len(original),
        "word_count": len(words),
        "unique_word_count": len(set(words)),
        "uppercase_ratio": round(uppercase_ratio, 3),
        "exclamation_count": original.count("!"),
        "digit_count": sum(ch.isdigit() for ch in original),
        "money_mentions": [m.group(0).strip() for m in _MONEY_PATTERN.finditer(normalised)][:5],
        "phone_mentions": [m.group(0).strip() for m in _PHONE_PATTERN.finditer(original)][:3],
    }


def extract_urls(text: str) -> list[str]:
    """Return de-duplicated URLs/domains found in ``text``."""
    seen: list[str] = []
    for match in _URL_PATTERN.finditer(text or ""):
        candidate = match.group(0).rstrip(".,;:!?)\"'")
        if candidate.lower() not in {c.lower() for c in seen}:
            seen.append(candidate)
    return seen[:5]


# --- Scoring ------------------------------------------------------------------


def _severity_for(weight: float) -> str:
    if weight >= 24:
        return "critical"
    if weight >= 18:
        return "high"
    if weight >= 12:
        return "medium"
    return "low"


def _evaluate_categories(
    normalised: str,
) -> tuple[list[Indicator], list[str], list[str], dict[str, float]]:
    indicators: list[Indicator] = []
    categories: list[str] = []
    phrases: list[str] = []
    category_scores: dict[str, float] = {}

    for category in CATEGORIES:
        hits: list[tuple[Pattern, str]] = []
        for pattern in category.patterns:
            match = pattern.regex.search(normalised)
            if match:
                snippet = re.sub(r"\s+", " ", match.group(0)).strip()
                hits.append((pattern, snippet))

        if not hits:
            continue

        hits.sort(key=lambda pair: pair[0].weight, reverse=True)
        # Strongest signal at full weight; corroborating hits at 40%.
        score = hits[0][0].weight + sum(p.weight * 0.4 for p, _ in hits[1:])
        score = min(score, hits[0][0].weight * 1.8)

        categories.append(category.label)
        category_scores[category.code] = round(score, 2)
        for _, snippet in hits[:3]:
            if snippet and snippet not in phrases:
                phrases.append(snippet)

        notes = "; ".join(pattern.note for pattern, _ in hits[:3])
        quoted = ", ".join(f'"{snippet}"' for _, snippet in hits[:3])
        indicators.append(
            Indicator(
                code=category.code,
                label=category.label,
                detail=f"{category.description} Detected: {notes}. Matched text: {quoted}.",
                severity=_severity_for(score),
                weight=round(score, 2),
            )
        )

    indicators.sort(key=lambda ind: ind.weight, reverse=True)
    return indicators, categories, phrases[:12], category_scores


def _style_indicators(stats: dict[str, Any], normalised: str) -> list[Indicator]:
    extra: list[Indicator] = []
    if stats["uppercase_ratio"] > 0.35 and stats["character_count"] > 25:
        extra.append(
            Indicator(
                "SHOUTING_CASE",
                "Aggressive capitalisation",
                f"{stats['uppercase_ratio'] * 100:.0f}% of the letters are uppercase, a common "
                "attention-grabbing tactic in scam messages.",
                "medium",
                9,
            )
        )
    if stats["exclamation_count"] >= 3:
        extra.append(
            Indicator(
                "EXCESSIVE_PUNCTUATION",
                "Excessive exclamation marks",
                f"The message uses {stats['exclamation_count']} exclamation marks to create "
                "artificial excitement or panic.",
                "low",
                6,
            )
        )
    if stats["money_mentions"]:
        amounts = ", ".join(stats["money_mentions"][:3])
        extra.append(
            Indicator(
                "MONETARY_LURE",
                "Specific monetary amount mentioned",
                f"The message references {amounts}. Naming a concrete sum is used to make an "
                "offer or threat feel real.",
                "low",
                7,
            )
        )
    if re.search(r"\bdear (customer|user|sir/madam|member)\b", normalised):
        extra.append(
            Indicator(
                "GENERIC_SALUTATION",
                "Generic, impersonal greeting",
                "The message opens with a generic salutation instead of your name, typical of "
                "bulk fraud campaigns.",
                "low",
                6,
            )
        )
    return extra


def _analyse_embedded_urls(urls: list[str]) -> tuple[list[Indicator], list[dict[str, Any]], float]:
    indicators: list[Indicator] = []
    reports: list[dict[str, Any]] = []
    contribution = 0.0

    for url in urls:
        try:
            result = analyse_url(url)
        except ValueError:
            continue
        reports.append(
            {
                "url": result["input"],
                "prediction": result["prediction"],
                "risk_score": result["risk_score"],
                "risk_level": result["risk_level"],
                "top_indicators": [ind["label"] for ind in result["indicators"][:3]],
            }
        )
        if result["risk_score"] >= 30:
            weight = min(22.0, result["risk_score"] * 0.25)
            contribution += weight
            indicators.append(
                Indicator(
                    "EMBEDDED_RISKY_LINK",
                    f"Embedded link rated {result['prediction'].lower()}",
                    f"The link '{result['input']}' scored {result['risk_score']:.0f}/100 on its "
                    f"own: {', '.join(ind['label'] for ind in result['indicators'][:3])}.",
                    _severity_for(weight),
                    round(weight, 2),
                )
            )
    return indicators, reports, min(28.0, contribution)


def _heuristic_score(indicators: list[Indicator]) -> float:
    total = 0.0
    for position, indicator in enumerate(indicators):
        decay = 1.0 if position < 3 else max(0.4, 1.0 - 0.14 * (position - 2))
        total += indicator.weight * decay
    return min(100.0, round(total, 2))


def _classify(score: float) -> str:
    if score >= 60:
        return SCAM
    if score >= 30:
        return SUSPICIOUS
    return SAFE


def risk_level_for(score: float) -> str:
    if score >= 80:
        return "CRITICAL"
    if score >= 60:
        return "HIGH"
    if score >= 30:
        return "MEDIUM"
    return "LOW"


def _build_explanation(
    indicators: list[Indicator], categories: list[str], score: float, prediction: str
) -> str:
    if not indicators:
        return (
            "No known fraud patterns were found in this message. It does not request one-time "
            "passwords, passwords or payments, does not impersonate a bank or authority, and "
            "does not apply artificial time pressure. Risk is therefore rated low."
        )

    lead = {
        SCAM: "This message matches well-established scam patterns",
        SUSPICIOUS: "This message contains some patterns associated with fraud",
        SAFE: "This message is broadly normal, with only minor observations",
    }[prediction]

    named = ", ".join(categories[:4]) if categories else "several weak signals"
    detail = " ".join(ind.detail.split(" Detected:")[0] for ind in indicators[:3])
    extra = (
        f" {len(indicators) - 3} additional lower-weight signal(s) also contributed."
        if len(indicators) > 3
        else ""
    )
    return (
        f"{lead}. The risk score of {score:.0f}/100 comes mainly from: {named}. {detail}{extra}"
    )


def _recommendation_for(prediction: str, level: str, categories: list[str]) -> str:
    if prediction == SCAM or level in {"HIGH", "CRITICAL"}:
        base = (
            "Do not reply, click any link or call any number in this message. Never share OTPs, "
            "passwords, card details or UPI PINs — no genuine bank or company will ever ask for "
            "them. Delete the message and, if it claimed to be from an organisation you use, "
            "contact them through their official app or website."
        )
        if any("Advance-fee" in c or "payment" in c.lower() for c in categories):
            base += " Do not send any money: paying a 'fee' to receive money is always fraud."
        return base
    if prediction == SUSPICIOUS or level == "MEDIUM":
        return (
            "Treat this message with caution. Verify the sender through an independent, official "
            "channel before acting, and do not share personal, banking or one-time-password "
            "details based on this message alone."
        )
    return (
        "No major suspicious indicators were detected. Continue following standard security "
        "practices and remain cautious with any message that asks for codes, credentials or money."
    )


# --- Public API ---------------------------------------------------------------


def analyse_message(raw_text: str) -> dict[str, Any]:
    """Analyse ``raw_text`` and return a structured, explainable result.

    Raises:
        ValueError: if the message is empty or too long.
    """
    if not raw_text or not raw_text.strip():
        raise ValueError("Message text is required.")
    if len(raw_text) > 20000:
        raise ValueError("Message exceeds the maximum supported length of 20000 characters.")

    original = raw_text.strip()
    normalised = normalise_text(original)
    stats = _text_statistics(original, normalised)

    indicators, categories, phrases, category_scores = _evaluate_categories(normalised)
    indicators.extend(_style_indicators(stats, normalised))

    urls = extract_urls(original)
    url_indicators, url_reports, _ = _analyse_embedded_urls(urls)
    indicators.extend(url_indicators)
    indicators.sort(key=lambda ind: ind.weight, reverse=True)

    heuristic = _heuristic_score(indicators)

    prediction_source = "heuristic_rules"
    model_probability: float | None = None
    model_meta: dict[str, Any] | None = None
    model_terms: list[str] = []

    model_result = registry.predict_message(normalised)
    if model_result is not None:
        model_probability, model_meta = model_result
        model_terms = registry.top_message_terms(normalised)
        blended = HEURISTIC_WEIGHT * heuristic + MODEL_WEIGHT * (model_probability * 100.0)
        prediction_source = "hybrid_ml_heuristic"
    else:
        blended = heuristic

    # A critical single signal (OTP request, seed phrase, money transfer demand)
    # must not be averaged away.
    if any(ind.weight >= 24 for ind in indicators):
        blended = max(blended, 62.0)

    score = round(min(100.0, max(0.0, blended)), 2)
    prediction = _classify(score)
    level = risk_level_for(score)

    boundary_distance = min(abs(score - 30), abs(score - 60), score, 100 - score)
    confidence = 0.55 + min(0.3, boundary_distance / 100.0)
    if model_probability is not None:
        agreement = 1.0 - abs(model_probability * 100.0 - heuristic) / 100.0
        confidence = min(0.99, confidence * 0.7 + agreement * 0.32)
    confidence = round(min(0.99, max(0.5, confidence)), 3)

    return {
        "input": original,
        "prediction": prediction,
        "risk_score": score,
        "risk_level": level,
        "confidence": confidence,
        "detected_categories": categories,
        "suspicious_phrases": phrases,
        "indicators": [ind.to_dict() for ind in indicators],
        "explanation": _build_explanation(indicators, categories, score, prediction),
        "recommendation": _recommendation_for(prediction, level, categories),
        "analysis_details": {
            "engine": "FraudShield Message Detector v1",
            "prediction_source": prediction_source,
            "heuristic_score": heuristic,
            "model_probability": round(model_probability, 4)
            if model_probability is not None
            else None,
            "model_top_terms": model_terms,
            "model_metadata": {
                "algorithm": (model_meta or {}).get("algorithm"),
                "holdout_accuracy": (model_meta or {}).get("accuracy"),
                "training_samples": (model_meta or {}).get("training_samples"),
                "vocabulary_size": (model_meta or {}).get("vocabulary_size"),
            }
            if model_meta
            else None,
            "weights": {"heuristic": HEURISTIC_WEIGHT, "model": MODEL_WEIGHT},
            "category_scores": category_scores,
            "text_statistics": stats,
            "embedded_urls": url_reports,
            "indicator_count": len(indicators),
        },
    }
