"""Lexical feature extraction for URLs.

The same feature vector feeds both the trained classifier
(:mod:`app.ml.model_store`) and the heuristic rule engine
(:mod:`app.ml.url_detector`), which keeps the two views of a URL consistent.
"""

from __future__ import annotations

import ipaddress
import math
import re
from collections import Counter
from dataclasses import asdict, dataclass, field
from urllib.parse import unquote, urlparse

# --- Lexical vocabularies -----------------------------------------------------

SUSPICIOUS_KEYWORDS: tuple[str, ...] = (
    "login",
    "signin",
    "verify",
    "verification",
    "secure",
    "security",
    "account",
    "update",
    "banking",
    "bank",
    "confirm",
    "password",
    "passwd",
    "credential",
    "wallet",
    "payment",
    "invoice",
    "billing",
    "free",
    "gift",
    "bonus",
    "prize",
    "winner",
    "claim",
    "unlock",
    "recover",
    "suspended",
    "limited",
    "kyc",
    "otp",
    "refund",
    "support",
    "helpdesk",
    "alert",
)

SENSITIVE_QUERY_KEYS: tuple[str, ...] = (
    "account",
    "password",
    "passwd",
    "pwd",
    "otp",
    "pin",
    "token",
    "card",
    "cvv",
    "ssn",
    "aadhaar",
    "upi",
    "redirect",
    "next",
    "url",
)

SUSPICIOUS_TLDS: tuple[str, ...] = (
    "zip",
    "mov",
    "tk",
    "ml",
    "ga",
    "cf",
    "gq",
    "top",
    "xyz",
    "buzz",
    "click",
    "country",
    "kim",
    "work",
    "loan",
    "men",
    "review",
    "date",
    "racing",
    "stream",
    "download",
    "rest",
    "cam",
    "surf",
    "quest",
    "cyou",
    "sbs",
    "icu",
)

URL_SHORTENERS: tuple[str, ...] = (
    "bit.ly",
    "tinyurl.com",
    "goo.gl",
    "t.co",
    "ow.ly",
    "is.gd",
    "buff.ly",
    "cutt.ly",
    "rebrand.ly",
    "shorturl.at",
    "rb.gy",
    "tiny.cc",
    "bitly.com",
    "t.ly",
    "shorte.st",
    "adf.ly",
)

# Brands routinely abused in credential-harvesting campaigns.
TARGETED_BRANDS: tuple[str, ...] = (
    "paypal",
    "apple",
    "icloud",
    "microsoft",
    "office365",
    "outlook",
    "google",
    "gmail",
    "amazon",
    "netflix",
    "facebook",
    "instagram",
    "whatsapp",
    "linkedin",
    "hdfc",
    "icici",
    "sbi",
    "axis",
    "kotak",
    "paytm",
    "phonepe",
    "gpay",
    "binance",
    "coinbase",
    "metamask",
    "dhl",
    "fedex",
    "usps",
    "irs",
    "steam",
)

BRAND_OFFICIAL_DOMAINS: dict[str, tuple[str, ...]] = {
    "paypal": ("paypal.com",),
    "apple": ("apple.com",),
    "icloud": ("icloud.com", "apple.com"),
    "microsoft": ("microsoft.com", "live.com", "microsoftonline.com"),
    "office365": ("office.com", "microsoft.com"),
    "outlook": ("outlook.com", "live.com", "microsoft.com"),
    "google": ("google.com", "google.co.in", "withgoogle.com"),
    "gmail": ("gmail.com", "google.com"),
    "amazon": ("amazon.com", "amazon.in", "amazon.co.uk"),
    "netflix": ("netflix.com",),
    "facebook": ("facebook.com", "fb.com"),
    "instagram": ("instagram.com",),
    "whatsapp": ("whatsapp.com", "wa.me"),
    "linkedin": ("linkedin.com",),
    "hdfc": ("hdfcbank.com",),
    "icici": ("icicibank.com",),
    "sbi": ("onlinesbi.sbi", "sbi.co.in"),
    "axis": ("axisbank.com",),
    "kotak": ("kotak.com",),
    "paytm": ("paytm.com",),
    "phonepe": ("phonepe.com",),
    "gpay": ("google.com", "pay.google.com"),
    "binance": ("binance.com",),
    "coinbase": ("coinbase.com",),
    "metamask": ("metamask.io",),
    "dhl": ("dhl.com",),
    "fedex": ("fedex.com",),
    "usps": ("usps.com",),
    "irs": ("irs.gov",),
    "steam": ("steampowered.com", "steamcommunity.com"),
}

RISKY_FILE_EXTENSIONS: tuple[str, ...] = (
    ".exe",
    ".scr",
    ".apk",
    ".bat",
    ".cmd",
    ".msi",
    ".jar",
    ".vbs",
    ".ps1",
    ".zip",
    ".rar",
    ".7z",
    ".iso",
)

# Two-level public suffixes that must not be mistaken for a subdomain.
_MULTIPART_SUFFIXES: frozenset[str] = frozenset(
    {
        "co.uk",
        "co.in",
        "co.jp",
        "co.kr",
        "co.za",
        "co.nz",
        "com.au",
        "com.br",
        "com.cn",
        "com.mx",
        "com.tr",
        "com.sg",
        "com.hk",
        "com.pk",
        "com.bd",
        "net.in",
        "org.in",
        "gov.in",
        "ac.in",
        "org.uk",
        "gov.uk",
        "ac.uk",
        "net.au",
        "org.au",
        "gov.au",
    }
)

_SPECIAL_CHARS = set("@?=&%#~$*+,;:!'\"()[]{}<>|\\^`")
_IPV4_IN_HOST = re.compile(r"^\d{1,3}(?:\.\d{1,3}){3}$")
_HEX_ENCODED = re.compile(r"%[0-9a-fA-F]{2}")


# --- Feature container --------------------------------------------------------


@dataclass(slots=True)
class UrlFeatures:
    """Numeric + contextual description of a single URL."""

    url: str = ""
    normalised_url: str = ""
    scheme: str = ""
    host: str = ""
    registered_domain: str = ""
    tld: str = ""
    path: str = ""
    query: str = ""

    url_length: int = 0
    domain_length: int = 0
    path_length: int = 0
    query_length: int = 0
    num_dots: int = 0
    num_hyphens: int = 0
    num_domain_hyphens: int = 0
    num_digits: int = 0
    num_domain_digits: int = 0
    num_special_chars: int = 0
    num_subdomains: int = 0
    num_path_segments: int = 0
    num_query_params: int = 0
    num_hex_encoded: int = 0
    digit_ratio: float = 0.0
    entropy: float = 0.0
    domain_entropy: float = 0.0

    has_https: int = 0
    has_ip_host: int = 0
    has_at_symbol: int = 0
    has_double_slash_redirect: int = 0
    has_port: int = 0
    has_punycode: int = 0
    is_shortener: int = 0
    suspicious_tld: int = 0
    risky_file_extension: int = 0
    brand_impersonation: int = 0

    suspicious_keyword_count: int = 0
    matched_keywords: list[str] = field(default_factory=list)
    matched_sensitive_params: list[str] = field(default_factory=list)
    impersonated_brand: str = ""

    # Ordered numeric vector used by the classifier. Keep in sync with
    # ``FEATURE_NAMES``.
    def to_vector(self) -> list[float]:
        return [float(getattr(self, name)) for name in FEATURE_NAMES]

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


FEATURE_NAMES: tuple[str, ...] = (
    "url_length",
    "domain_length",
    "path_length",
    "query_length",
    "num_dots",
    "num_hyphens",
    "num_domain_hyphens",
    "num_digits",
    "num_domain_digits",
    "num_special_chars",
    "num_subdomains",
    "num_path_segments",
    "num_query_params",
    "num_hex_encoded",
    "digit_ratio",
    "entropy",
    "domain_entropy",
    "has_https",
    "has_ip_host",
    "has_at_symbol",
    "has_double_slash_redirect",
    "has_port",
    "has_punycode",
    "is_shortener",
    "suspicious_tld",
    "risky_file_extension",
    "brand_impersonation",
    "suspicious_keyword_count",
)


# --- Helpers ------------------------------------------------------------------


def shannon_entropy(value: str) -> float:
    """Shannon entropy (bits/char) of ``value``; 0.0 for empty input."""
    if not value:
        return 0.0
    counts = Counter(value)
    total = len(value)
    return -sum((c / total) * math.log2(c / total) for c in counts.values())


def normalise_url(raw: str) -> str:
    """Trim noise and add a scheme so :func:`urlparse` behaves predictably."""
    candidate = (raw or "").strip().strip("<>\"'")
    candidate = candidate.replace("\\", "/")
    if not candidate:
        return ""
    if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.\-]*://", candidate):
        # Preserve an explicit http/https-less input as http so the missing-TLS
        # signal is not silently invented.
        candidate = f"http://{candidate}"
    return candidate


def split_host(host: str) -> tuple[str, str, list[str]]:
    """Return ``(registered_domain, tld, subdomain_labels)`` for a hostname."""
    host = host.lower().strip(".")
    if not host:
        return "", "", []
    if _IPV4_IN_HOST.match(host):
        return host, "", []

    labels = host.split(".")
    if len(labels) == 1:
        return host, "", []

    suffix_candidate = ".".join(labels[-2:])
    if suffix_candidate in _MULTIPART_SUFFIXES and len(labels) >= 3:
        registered = ".".join(labels[-3:])
        tld = suffix_candidate
        subdomains = labels[:-3]
    else:
        registered = ".".join(labels[-2:])
        tld = labels[-1]
        subdomains = labels[:-2]

    # ``www`` is ubiquitous and carries no fraud signal.
    subdomains = [label for label in subdomains if label not in {"www"}]
    return registered, tld, subdomains


def _is_ip_host(host: str) -> bool:
    bare = host.split(":", 1)[0]
    try:
        ipaddress.ip_address(bare)
        return True
    except ValueError:
        return bool(_IPV4_IN_HOST.match(bare))


def _detect_brand_impersonation(host: str, registered_domain: str) -> str:
    """Return the impersonated brand when a brand name appears off-domain."""
    for brand in TARGETED_BRANDS:
        if brand not in host:
            continue
        official = BRAND_OFFICIAL_DOMAINS.get(brand, ())
        if any(registered_domain == dom or registered_domain.endswith(f".{dom}") for dom in official):
            continue
        return brand
    return ""


# --- Public API ---------------------------------------------------------------


def extract_url_features(raw_url: str) -> UrlFeatures:
    """Build a :class:`UrlFeatures` record from a raw user-supplied URL."""
    normalised = normalise_url(raw_url)
    parsed = urlparse(normalised)

    host = (parsed.hostname or "").lower()
    netloc = parsed.netloc.lower()
    path = parsed.path or ""
    query = parsed.query or ""
    decoded = unquote(normalised).lower()

    registered_domain, tld, subdomains = split_host(host)
    lowered = normalised.lower()

    matched_keywords = sorted({kw for kw in SUSPICIOUS_KEYWORDS if kw in decoded})
    matched_params = sorted(
        {
            key
            for key in SENSITIVE_QUERY_KEYS
            if re.search(rf"(^|[?&]){re.escape(key)}=", query.lower())
        }
    )
    brand = _detect_brand_impersonation(host, registered_domain)

    digits = sum(ch.isdigit() for ch in normalised)
    path_segments = [seg for seg in path.split("/") if seg]

    features = UrlFeatures(
        url=raw_url.strip(),
        normalised_url=normalised,
        scheme=parsed.scheme,
        host=host,
        registered_domain=registered_domain,
        tld=tld,
        path=path,
        query=query,
        url_length=len(normalised),
        domain_length=len(host),
        path_length=len(path),
        query_length=len(query),
        num_dots=normalised.count("."),
        num_hyphens=normalised.count("-"),
        num_domain_hyphens=host.count("-"),
        num_digits=digits,
        num_domain_digits=sum(ch.isdigit() for ch in host),
        num_special_chars=sum(ch in _SPECIAL_CHARS for ch in normalised),
        num_subdomains=len(subdomains),
        num_path_segments=len(path_segments),
        num_query_params=len([p for p in query.split("&") if p]),
        num_hex_encoded=len(_HEX_ENCODED.findall(normalised)),
        digit_ratio=round(digits / max(len(normalised), 1), 4),
        entropy=round(shannon_entropy(normalised), 4),
        domain_entropy=round(shannon_entropy(host), 4),
        has_https=int(parsed.scheme == "https"),
        has_ip_host=int(_is_ip_host(host)) if host else 0,
        has_at_symbol=int("@" in netloc or "@" in path or "@" in query),
        has_double_slash_redirect=int("//" in lowered[8:]),
        has_port=int(bool(parsed.port) and parsed.port not in (80, 443)),
        has_punycode=int("xn--" in host),
        is_shortener=int(any(host == s or host.endswith(f".{s}") for s in URL_SHORTENERS)),
        suspicious_tld=int(tld.split(".")[-1] in SUSPICIOUS_TLDS if tld else 0),
        risky_file_extension=int(any(path.lower().endswith(ext) for ext in RISKY_FILE_EXTENSIONS)),
        brand_impersonation=int(bool(brand)),
        suspicious_keyword_count=len(matched_keywords),
        matched_keywords=matched_keywords,
        matched_sensitive_params=matched_params,
        impersonated_brand=brand,
    )
    return features


def is_valid_url(raw_url: str) -> tuple[bool, str]:
    """Validate a URL for analysis. Returns ``(ok, error_message)``."""
    if not raw_url or not raw_url.strip():
        return False, "URL is required."
    if len(raw_url.strip()) > 2048:
        return False, "URL exceeds the maximum supported length of 2048 characters."

    normalised = normalise_url(raw_url)
    parsed = urlparse(normalised)
    if parsed.scheme not in {"http", "https"}:
        return False, "Only http and https URLs can be analysed."
    host = parsed.hostname or ""
    if not host:
        return False, "The URL does not contain a valid host name."
    if not _is_ip_host(host) and "." not in host and host != "localhost":
        return False, "The host name looks incomplete (missing domain suffix)."
    if re.search(r"\s", host):
        return False, "The host name contains invalid whitespace."
    return True, ""
