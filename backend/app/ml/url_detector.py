"""URL fraud detection engine.

Hybrid design: a deterministic weighted rule engine over lexical features is
blended with a RandomForest probability. The rule engine is authoritative for
explainability (each triggered rule becomes a user-facing indicator) while the
model contributes a learned, non-linear view of the same feature vector.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.ml.features import UrlFeatures, extract_url_features, is_valid_url
from app.ml.model_store import registry

# Blend weights for the final score.
HEURISTIC_WEIGHT = 0.6
MODEL_WEIGHT = 0.4

SAFE = "Safe"
SUSPICIOUS = "Suspicious"
PHISHING = "Phishing"


@dataclass(slots=True)
class Indicator:
    """A single explainable risk signal."""

    code: str
    label: str
    detail: str
    severity: str  # info | low | medium | high | critical
    weight: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "label": self.label,
            "detail": self.detail,
            "severity": self.severity,
            "weight": round(self.weight, 2),
        }


def _severity_for(weight: float) -> str:
    if weight >= 20:
        return "critical"
    if weight >= 13:
        return "high"
    if weight >= 7:
        return "medium"
    return "low"


def _evaluate_rules(f: UrlFeatures) -> list[Indicator]:
    """Run every heuristic rule and collect the ones that fire."""
    found: list[Indicator] = []

    def add(code: str, label: str, detail: str, weight: float) -> None:
        found.append(Indicator(code, label, detail, _severity_for(weight), weight))

    # --- Transport security ---
    if not f.has_https:
        add(
            "NO_HTTPS",
            "No HTTPS encryption",
            "The link uses plain HTTP, so anything you type can be read in transit.",
            14,
        )

    # --- Host identity ---
    if f.has_ip_host:
        add(
            "IP_HOST",
            "IP address used instead of a domain",
            f"The link points straight at the IP address {f.host} rather than a registered "
            "domain name — a common way to hide a phishing server.",
            25,
        )
    if f.has_at_symbol:
        add(
            "AT_SYMBOL",
            "'@' symbol in the address",
            "Everything before the '@' is ignored by browsers, so the real destination is "
            "hidden behind text that looks trustworthy.",
            20,
        )
    if f.has_punycode:
        add(
            "PUNYCODE",
            "Internationalised (punycode) domain",
            "The domain uses 'xn--' encoding, which can render look-alike characters that "
            "imitate a well known brand.",
            16,
        )
    if f.brand_impersonation:
        add(
            "BRAND_IMPERSONATION",
            f"Possible '{f.impersonated_brand}' impersonation",
            f"The name '{f.impersonated_brand}' appears in the address, but the registered "
            f"domain is '{f.registered_domain}', which is not an official domain for that brand.",
            22,
        )
    if f.is_shortener:
        add(
            "URL_SHORTENER",
            "Link shortening service",
            f"'{f.host}' is a URL shortener, so the true destination cannot be inspected "
            "before clicking.",
            11,
        )

    # --- Domain structure ---
    if f.num_subdomains >= 4:
        add(
            "DEEP_SUBDOMAINS",
            "Excessive subdomain nesting",
            f"The host contains {f.num_subdomains} subdomain levels, which is typically used "
            "to bury a fake brand name inside an unrelated domain.",
            18,
        )
    elif f.num_subdomains == 3:
        add(
            "MANY_SUBDOMAINS",
            "Multiple subdomains",
            f"The host contains {f.num_subdomains} subdomain levels, more than a normal "
            "website needs.",
            12,
        )

    if f.num_domain_hyphens >= 3:
        add(
            "MANY_HYPHENS",
            "Heavily hyphenated domain",
            f"The domain contains {f.num_domain_hyphens} hyphens, a pattern frequently used to "
            "stitch together believable-sounding phrases.",
            13,
        )
    elif f.num_domain_hyphens == 2:
        add(
            "HYPHENATED_DOMAIN",
            "Hyphenated domain name",
            "The domain joins several words with hyphens, which brands rarely do.",
            8,
        )

    if f.num_domain_digits >= 4:
        add(
            "DIGITS_IN_DOMAIN",
            "Unusual digits in the domain",
            f"The host contains {f.num_domain_digits} digits, suggesting an auto-generated "
            "throwaway domain.",
            10,
        )

    if f.suspicious_tld:
        add(
            "SUSPICIOUS_TLD",
            f"High-abuse domain extension (.{f.tld})",
            f"The '.{f.tld}' extension is cheap or free to register and is disproportionately "
            "used for fraud campaigns.",
            15,
        )

    if f.has_port:
        add(
            "NON_STANDARD_PORT",
            "Non-standard network port",
            "The link connects on an unusual port instead of the normal web ports, which "
            "legitimate public sites almost never require.",
            9,
        )

    # --- Length / obfuscation ---
    if f.url_length > 110:
        add(
            "VERY_LONG_URL",
            "Excessive URL length",
            f"The address is {f.url_length} characters long — long links are used to push the "
            "real domain out of view on mobile screens.",
            15,
        )
    elif f.url_length > 75:
        add(
            "LONG_URL",
            "Long URL",
            f"The address is {f.url_length} characters long, longer than a typical link.",
            9,
        )

    if f.has_double_slash_redirect:
        add(
            "DOUBLE_SLASH_REDIRECT",
            "Embedded redirect path",
            "An extra '//' appears inside the path, which is often used to chain a redirect to "
            "a second, hidden website.",
            12,
        )

    if f.num_hex_encoded >= 3:
        add(
            "ENCODED_CHARACTERS",
            "Percent-encoded characters",
            f"The address contains {f.num_hex_encoded} percent-encoded characters, which can "
            "disguise the real destination text.",
            9,
        )

    if f.num_special_chars >= 12:
        add(
            "MANY_SPECIAL_CHARS",
            "High density of special characters",
            f"The address contains {f.num_special_chars} special characters, well above a "
            "normal link.",
            8,
        )

    if f.risky_file_extension:
        add(
            "RISKY_DOWNLOAD",
            "Direct executable or archive download",
            "The link ends in a file type commonly used to deliver malware.",
            20,
        )

    if f.num_path_segments >= 6:
        add(
            "DEEP_PATH",
            "Unusually deep URL path",
            f"The path has {f.num_path_segments} segments, which can be used to pad the link.",
            6,
        )

    # --- Semantic / credential-harvest signals ---
    if f.suspicious_keyword_count:
        keyword_weight = min(24.0, 7.0 * f.suspicious_keyword_count)
        shown = ", ".join(f.matched_keywords[:6])
        add(
            "SUSPICIOUS_KEYWORDS",
            f"{f.suspicious_keyword_count} credential-bait keyword(s)",
            f"The address contains security/finance bait words ({shown}) that are typical of "
            "pages built to capture logins or payments.",
            keyword_weight,
        )

    if f.matched_sensitive_params:
        add(
            "SENSITIVE_PARAMETERS",
            "Sensitive data in the query string",
            "The link carries parameters such as "
            f"{', '.join(f.matched_sensitive_params[:5])}, which suggests it expects account or "
            "payment data to be passed in the URL.",
            9,
        )

    # --- Combination rule: bait keywords + no TLS is the classic phishing pair.
    if f.suspicious_keyword_count >= 3 and not f.has_https:
        add(
            "CREDENTIAL_HARVEST_PATTERN",
            "Credential-harvesting pattern",
            "Multiple login/verification bait words are combined with an unencrypted "
            "connection — the signature of a page built to steal credentials.",
            12,
        )

    if f.brand_impersonation and (f.suspicious_keyword_count >= 2 or f.num_subdomains >= 2):
        add(
            "BRAND_PLUS_BAIT",
            "Brand name combined with login bait",
            "A recognisable brand name is paired with verification wording on a domain that "
            "does not belong to that brand.",
            10,
        )

    found.sort(key=lambda ind: ind.weight, reverse=True)
    return found


def _heuristic_score(indicators: list[Indicator]) -> float:
    """Diminishing-returns aggregation so a stack of weak rules cannot max out."""
    total = 0.0
    for position, indicator in enumerate(indicators):
        decay = 1.0 if position < 3 else max(0.45, 1.0 - 0.12 * (position - 2))
        total += indicator.weight * decay
    return min(100.0, round(total, 2))


def _classify(score: float) -> str:
    if score >= 60:
        return PHISHING
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
    f: UrlFeatures, indicators: list[Indicator], score: float, prediction: str
) -> str:
    if not indicators:
        return (
            f"No suspicious characteristics were found in this address. The domain "
            f"'{f.registered_domain or f.host}' is served over an encrypted HTTPS connection, "
            "has a normal length and structure, and contains none of the login, payment or "
            "reward bait wording typically used in phishing links. Risk is therefore rated low."
        )

    top = indicators[:3]
    reasons = "; ".join(f"{ind.label.lower()}" for ind in top)
    lead = {
        PHISHING: "This address shows strong signs of a phishing attempt",
        SUSPICIOUS: "This address shows some characteristics associated with fraudulent links",
        SAFE: "This address is largely normal, with only minor observations",
    }[prediction]

    detail = " ".join(ind.detail for ind in top)
    extra = ""
    if len(indicators) > 3:
        extra = f" A further {len(indicators) - 3} lower-weight signal(s) also contributed."

    return (
        f"{lead}. The risk score of {score:.0f}/100 is driven mainly by {reasons}. {detail}"
        f"{extra}"
    )


def _recommendation_for(prediction: str, level: str) -> str:
    if prediction == PHISHING or level in {"HIGH", "CRITICAL"}:
        return (
            "Do not open this link. Never enter passwords, OTPs, card numbers or UPI PINs on "
            "this website. If the message claimed to come from your bank or a service you use, "
            "contact them through their official app or a number you already have."
        )
    if prediction == SUSPICIOUS or level == "MEDIUM":
        return (
            "Treat this link with caution. Verify the sender independently and type the "
            "organisation's official address into your browser yourself instead of clicking. "
            "Do not submit personal or financial details until you have confirmed it is genuine."
        )
    return (
        "No major suspicious indicators were detected. Continue following standard security "
        "practices: check the domain spelling before signing in and make sure the connection "
        "shows HTTPS."
    )


def analyse_url(raw_url: str) -> dict[str, Any]:
    """Analyse ``raw_url`` and return a structured, explainable result.

    Raises:
        ValueError: if the URL cannot be parsed or is not http/https.
    """
    ok, error = is_valid_url(raw_url)
    if not ok:
        raise ValueError(error)

    features = extract_url_features(raw_url)
    indicators = _evaluate_rules(features)
    heuristic = _heuristic_score(indicators)

    prediction_source = "heuristic_rules"
    model_probability: float | None = None
    model_meta: dict[str, Any] | None = None

    model_result = registry.predict_url(features)
    if model_result is not None:
        model_probability, model_meta = model_result
        model_score = model_probability * 100.0
        blended = HEURISTIC_WEIGHT * heuristic + MODEL_WEIGHT * model_score
        prediction_source = "hybrid_ml_heuristic"
    else:
        blended = heuristic

    # A hard signal (raw IP host, '@' redirect, executable download) should never
    # be diluted below the suspicious band by an optimistic model.
    hard_floor = max((ind.weight for ind in indicators if ind.weight >= 20), default=0.0)
    if hard_floor:
        blended = max(blended, 45.0)

    score = round(min(100.0, max(0.0, blended)), 2)
    prediction = _classify(score)
    level = risk_level_for(score)

    # Confidence: distance from the nearest band boundary, plus corroboration
    # between the two engines when both are available.
    boundary_distance = min(abs(score - 30), abs(score - 60), score, 100 - score)
    confidence = 0.55 + min(0.3, boundary_distance / 100.0)
    if model_probability is not None:
        agreement = 1.0 - abs(model_probability * 100.0 - heuristic) / 100.0
        confidence = min(0.99, confidence * 0.7 + agreement * 0.32)
    confidence = round(min(0.99, max(0.5, confidence)), 3)

    return {
        "input": features.url,
        "normalised_url": features.normalised_url,
        "prediction": prediction,
        "risk_score": score,
        "risk_level": level,
        "confidence": confidence,
        "indicators": [ind.to_dict() for ind in indicators],
        "explanation": _build_explanation(features, indicators, score, prediction),
        "recommendation": _recommendation_for(prediction, level),
        "analysis_details": {
            "engine": "FraudShield URL Detector v1",
            "prediction_source": prediction_source,
            "heuristic_score": heuristic,
            "model_probability": round(model_probability, 4)
            if model_probability is not None
            else None,
            "model_metadata": {
                "algorithm": (model_meta or {}).get("algorithm"),
                "holdout_accuracy": (model_meta or {}).get("accuracy"),
                "training_samples": (model_meta or {}).get("training_samples"),
            }
            if model_meta
            else None,
            "weights": {"heuristic": HEURISTIC_WEIGHT, "model": MODEL_WEIGHT},
            "indicator_count": len(indicators),
            "features": {
                "scheme": features.scheme,
                "host": features.host,
                "registered_domain": features.registered_domain,
                "tld": features.tld,
                "url_length": features.url_length,
                "domain_length": features.domain_length,
                "num_dots": features.num_dots,
                "num_hyphens": features.num_hyphens,
                "num_digits": features.num_digits,
                "num_special_chars": features.num_special_chars,
                "num_subdomains": features.num_subdomains,
                "num_query_params": features.num_query_params,
                "digit_ratio": features.digit_ratio,
                "entropy": features.entropy,
                "has_https": bool(features.has_https),
                "has_ip_host": bool(features.has_ip_host),
                "has_at_symbol": bool(features.has_at_symbol),
                "is_shortener": bool(features.is_shortener),
                "suspicious_tld": bool(features.suspicious_tld),
                "suspicious_keywords": features.matched_keywords,
                "sensitive_query_params": features.matched_sensitive_params,
                "impersonated_brand": features.impersonated_brand or None,
            },
        },
    }
