"""Document risk analysis engine.

Positioned as *risk assessment*, not forensic verification. The analyser layers
whatever evidence the environment can provide:

1. File validation (extension, magic bytes, size).
2. Structural inspection (PDF metadata/pages, image dimensions/mode).
3. Text extraction — embedded PDF text always, Tesseract OCR when installed.
4. Content analysis — reuses the scam-message engine over the extracted text.
5. Filename and consistency heuristics.

Every stage is individually optional: a missing Pillow, pypdf or Tesseract
downgrades the evidence available but never fails the request.
"""

from __future__ import annotations

import hashlib
import io
import math
import re
from collections import Counter
from datetime import UTC, datetime
from typing import Any

from app.core.config import settings
from app.core.logging_config import get_logger
from app.ml.message_detector import analyse_message, extract_urls
from app.ml.url_detector import Indicator

logger = get_logger(__name__)

# --- Optional dependency probing ---------------------------------------------

try:
    from PIL import Image, ImageStat

    PIL_AVAILABLE = True
except Exception:  # pragma: no cover
    PIL_AVAILABLE = False

try:
    from PIL import ExifTags

    EXIF_AVAILABLE = True
except Exception:  # pragma: no cover
    EXIF_AVAILABLE = False

try:
    from pypdf import PdfReader

    PYPDF_AVAILABLE = True
except Exception:  # pragma: no cover
    PYPDF_AVAILABLE = False

try:
    import pytesseract

    PYTESSERACT_IMPORTED = True
except Exception:  # pragma: no cover
    PYTESSERACT_IMPORTED = False


_OCR_STATE: dict[str, Any] = {"checked": False, "available": False, "version": None}


def ocr_status() -> dict[str, Any]:
    """Probe the Tesseract binary once and cache the outcome."""
    if _OCR_STATE["checked"]:
        return {"available": _OCR_STATE["available"], "version": _OCR_STATE["version"]}

    _OCR_STATE["checked"] = True
    if not (PYTESSERACT_IMPORTED and PIL_AVAILABLE):
        _OCR_STATE["available"] = False
        return {"available": False, "version": None}
    try:
        version = str(pytesseract.get_tesseract_version())
        _OCR_STATE["available"] = True
        _OCR_STATE["version"] = version
        logger.info("Tesseract OCR detected (version %s).", version)
    except Exception as exc:
        _OCR_STATE["available"] = False
        logger.info("Tesseract OCR not available (%s); using fallback analysis.", exc)
    return {"available": _OCR_STATE["available"], "version": _OCR_STATE["version"]}


# --- Signatures and vocabularies ---------------------------------------------

_MAGIC_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    "pdf": (b"%PDF-",),
    "png": (b"\x89PNG\r\n\x1a\n",),
    "jpg": (b"\xff\xd8\xff",),
    "jpeg": (b"\xff\xd8\xff",),
}

_SUSPICIOUS_FILENAME_TOKENS: tuple[str, ...] = (
    "copy",
    "final",
    "edited",
    "modified",
    "new",
    "duplicate",
    "scan",
    "fake",
    "sample",
    "test",
    "temp",
    "whatsapp",
    "screenshot",
    "download",
    "untitled",
    "img",
)

_HIGH_VALUE_DOC_TERMS: tuple[str, ...] = (
    "aadhaar",
    "aadhar",
    "pan card",
    "passport",
    "driving licence",
    "driving license",
    "voter id",
    "bank statement",
    "salary slip",
    "payslip",
    "invoice",
    "receipt",
    "certificate",
    "marksheet",
    "degree",
    "offer letter",
    "experience letter",
    "cheque",
    "demand draft",
    "insurance policy",
    "income tax",
    "gst",
)

_DOC_RED_FLAG_TERMS: tuple[str, ...] = (
    "guaranteed",
    "no verification",
    "instant approval",
    "urgent transfer",
    "confidential fund",
    "processing fee",
    "beneficiary",
    "wire transfer",
    "advance payment",
    "crypto wallet",
    "bitcoin",
    "otp",
    "password",
    "pin number",
    "cvv",
    "notarised copy",
    "notarized copy",
)

_IMAGE_EDITOR_HINTS: tuple[str, ...] = (
    "photoshop",
    "gimp",
    "canva",
    "pixlr",
    "paint.net",
    "illustrator",
    "inkscape",
    "picsart",
    "snapseed",
    "lightroom",
    "coreldraw",
)

_PDF_EDITOR_HINTS: tuple[str, ...] = (
    "photoshop",
    "ilovepdf",
    "smallpdf",
    "pdfescape",
    "sejda",
    "pdf24",
    "foxit phantom",
    "nitro pro",
    "canva",
    "word to pdf",
)


def _severity_for(weight: float) -> str:
    if weight >= 20:
        return "critical"
    if weight >= 13:
        return "high"
    if weight >= 7:
        return "medium"
    return "low"


# --- Validation ---------------------------------------------------------------


def validate_upload(filename: str, content: bytes) -> tuple[str, str]:
    """Validate an uploaded file.

    Returns ``(extension, detected_type)``.

    Raises:
        ValueError: for empty files, oversized files or unsupported types.
    """
    if not filename or not filename.strip():
        raise ValueError("A file name is required.")
    if not content:
        raise ValueError("The uploaded file is empty.")
    if len(content) > settings.max_upload_bytes:
        raise ValueError(
            f"File is too large. The maximum supported size is {settings.MAX_UPLOAD_SIZE_MB} MB."
        )

    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    allowed = settings.allowed_extensions
    if extension not in allowed:
        raise ValueError(
            "Unsupported file type. Allowed types: " + ", ".join(sorted(allowed)).upper() + "."
        )

    detected = "unknown"
    for kind, signatures in _MAGIC_SIGNATURES.items():
        if any(content.startswith(sig) for sig in signatures):
            detected = "jpg" if kind == "jpeg" else kind
            break

    return extension, detected


# --- Inspection helpers -------------------------------------------------------


def _inspect_pdf(content: bytes) -> tuple[dict[str, Any], str, list[Indicator]]:
    meta: dict[str, Any] = {"container": "pdf"}
    indicators: list[Indicator] = []
    text = ""

    if not PYPDF_AVAILABLE:
        meta["pdf_parser"] = "unavailable"
        return meta, text, indicators

    try:
        reader = PdfReader(io.BytesIO(content))
        meta["page_count"] = len(reader.pages)
        meta["encrypted"] = bool(reader.is_encrypted)

        info = reader.metadata or {}
        for key, value in dict(info).items():
            clean_key = str(key).lstrip("/")
            meta[f"pdf_{clean_key.lower()}"] = str(value)[:300]

        chunks: list[str] = []
        for page in reader.pages[:15]:
            try:
                chunks.append(page.extract_text() or "")
            except Exception:
                continue
        text = "\n".join(chunk for chunk in chunks if chunk).strip()
        meta["embedded_text_characters"] = len(text)

        producer = " ".join(
            str(meta.get(key, "")) for key in ("pdf_producer", "pdf_creator")
        ).lower()
        hit = next((hint for hint in _PDF_EDITOR_HINTS if hint in producer), None)
        if hit:
            indicators.append(
                Indicator(
                    "PDF_EDITOR_PRODUCER",
                    "Document produced by an editing tool",
                    f"The PDF metadata names '{hit}' as the producer. This is common for "
                    "legitimately converted files, but it also means the document was not "
                    "issued directly by an authoritative system. Requires manual verification.",
                    "medium",
                    11,
                )
            )

        created = str(meta.get("pdf_creationdate", ""))
        modified = str(meta.get("pdf_moddate", ""))
        if created and modified and created != modified:
            indicators.append(
                Indicator(
                    "PDF_MODIFIED_AFTER_CREATION",
                    "Modified after creation",
                    f"The PDF records a creation date of {created} and a later modification date "
                    f"of {modified}, indicating the file was changed after it was first produced.",
                    "medium",
                    10,
                )
            )
        if not info:
            indicators.append(
                Indicator(
                    "PDF_NO_METADATA",
                    "Metadata stripped",
                    "The PDF carries no author, producer or creation-date metadata. Metadata is "
                    "often removed when a document is re-generated or sanitised.",
                    "low",
                    7,
                )
            )
        if reader.is_encrypted:
            indicators.append(
                Indicator(
                    "PDF_ENCRYPTED",
                    "Password-protected document",
                    "The PDF is encrypted, so its contents could only be partially inspected.",
                    "low",
                    6,
                )
            )
        if meta.get("page_count", 0) == 0:
            indicators.append(
                Indicator(
                    "PDF_NO_PAGES",
                    "Malformed PDF structure",
                    "The PDF reports zero readable pages, which suggests a corrupted or "
                    "deliberately malformed file.",
                    "high",
                    16,
                )
            )
    except Exception as exc:
        meta["pdf_parse_error"] = str(exc)[:200]
        indicators.append(
            Indicator(
                "PDF_PARSE_FAILURE",
                "Document structure could not be parsed",
                "The file claims to be a PDF but its internal structure could not be read. "
                "Potential anomaly — requires manual verification.",
                "high",
                15,
            )
        )
    return meta, text, indicators


def _inspect_image(content: bytes) -> tuple[dict[str, Any], list[Indicator]]:
    meta: dict[str, Any] = {"container": "image"}
    indicators: list[Indicator] = []

    if not PIL_AVAILABLE:
        meta["image_parser"] = "unavailable"
        return meta, indicators

    try:
        with Image.open(io.BytesIO(content)) as image:
            image.load()
            width, height = image.size
            meta.update(
                {
                    "format": image.format,
                    "mode": image.mode,
                    "width": width,
                    "height": height,
                    "megapixels": round(width * height / 1_000_000, 3),
                    "aspect_ratio": round(width / height, 3) if height else None,
                }
            )

            # Compression ratio: an unusually small file for its pixel count
            # implies heavy re-compression (repeated save cycles).
            raw_estimate = width * height * len(image.getbands())
            if raw_estimate:
                ratio = len(content) / raw_estimate
                meta["bytes_per_pixel"] = round(ratio, 4)
                if ratio < 0.035 and width * height > 200_000:
                    indicators.append(
                        Indicator(
                            "HEAVY_RECOMPRESSION",
                            "Signs of heavy re-compression",
                            f"The image stores only {ratio:.3f} bytes per pixel, which usually "
                            "means it has been saved and re-saved several times. Repeated "
                            "re-compression can accompany edited images. Potential anomaly.",
                            "medium",
                            11,
                        )
                    )

            if width < 400 or height < 400:
                indicators.append(
                    Indicator(
                        "LOW_RESOLUTION",
                        "Low resolution for a document",
                        f"The image is only {width}x{height} pixels. Genuine document scans are "
                        "normally higher resolution; low resolution also hides editing artefacts.",
                        "medium",
                        10,
                    )
                )

            try:
                grey = image.convert("L")
                stats = ImageStat.Stat(grey)
                meta["mean_brightness"] = round(stats.mean[0], 2)
                meta["brightness_stddev"] = round(stats.stddev[0], 2)

                histogram = grey.histogram()
                total = sum(histogram) or 1
                entropy = -sum(
                    (count / total) * math.log2(count / total) for count in histogram if count
                )
                meta["pixel_entropy"] = round(entropy, 3)

                if stats.stddev[0] < 12:
                    indicators.append(
                        Indicator(
                            "FLAT_TONAL_RANGE",
                            "Unusually flat tonal range",
                            f"Brightness variation is very low (standard deviation "
                            f"{stats.stddev[0]:.1f}), which can indicate a synthetically "
                            "generated or heavily flattened image rather than a camera scan.",
                            "medium",
                            9,
                        )
                    )
                # A near-binary histogram is typical of a digitally composed
                # document rather than a photographed or scanned one.
                dominant = max(histogram)
                if dominant / total > 0.75:
                    indicators.append(
                        Indicator(
                            "SYNTHETIC_TONE_DISTRIBUTION",
                            "Synthetic tone distribution",
                            f"{dominant / total * 100:.0f}% of pixels share a single brightness "
                            "value, a pattern more consistent with a digitally created image "
                            "than with a scan or photograph.",
                            "low",
                            8,
                        )
                    )
            except Exception:
                pass

            if EXIF_AVAILABLE:
                exif_data: dict[str, Any] = {}
                try:
                    raw_exif = image.getexif()
                    for tag_id, value in dict(raw_exif).items():
                        tag = ExifTags.TAGS.get(tag_id, str(tag_id))
                        exif_data[str(tag)] = str(value)[:200]
                except Exception:
                    exif_data = {}

                meta["exif_tag_count"] = len(exif_data)
                if exif_data:
                    meta["exif"] = dict(list(exif_data.items())[:15])
                    blob = " ".join(exif_data.values()).lower()
                    hit = next((h for h in _IMAGE_EDITOR_HINTS if h in blob), None)
                    if hit:
                        indicators.append(
                            Indicator(
                                "IMAGE_EDITOR_SIGNATURE",
                                "Image editing software signature",
                                f"EXIF metadata references '{hit}'. The image has passed through "
                                "an editor, so its contents cannot be assumed to be unaltered. "
                                "Requires manual verification.",
                                "high",
                                17,
                            )
                        )
                    if "DateTime" in exif_data and "DateTimeOriginal" in exif_data:
                        if exif_data["DateTime"] != exif_data["DateTimeOriginal"]:
                            indicators.append(
                                Indicator(
                                    "EXIF_TIMESTAMP_MISMATCH",
                                    "EXIF timestamps disagree",
                                    "The original capture time and the last-modified time in the "
                                    "EXIF data differ, indicating the file was re-saved after "
                                    "capture.",
                                    "medium",
                                    12,
                                )
                            )
                elif (image.format or "").upper() in {"JPEG", "JPG"}:
                    indicators.append(
                        Indicator(
                            "NO_EXIF_METADATA",
                            "Camera metadata absent",
                            "This JPEG carries no EXIF data. Metadata is normally present in "
                            "camera photos and scans, and is stripped by screenshots, messaging "
                            "apps and most editing tools. Potential anomaly.",
                            "medium",
                            10,
                        )
                    )
    except Exception as exc:
        meta["image_parse_error"] = str(exc)[:200]
        indicators.append(
            Indicator(
                "IMAGE_PARSE_FAILURE",
                "Image could not be decoded",
                "The file could not be opened as a valid image, which suggests it is corrupted "
                "or its extension does not match its real content.",
                "high",
                16,
            )
        )
    return meta, indicators


def _run_ocr(content: bytes) -> tuple[str, dict[str, Any]]:
    status = ocr_status()
    info: dict[str, Any] = {"attempted": False, **status}
    if not status["available"]:
        return "", info

    info["attempted"] = True
    try:
        with Image.open(io.BytesIO(content)) as image:
            prepared = image.convert("L")
            if max(prepared.size) < 1000:
                scale = 1000 / max(prepared.size)
                prepared = prepared.resize(
                    (int(prepared.width * scale), int(prepared.height * scale))
                )
            text = pytesseract.image_to_string(prepared)
        info["characters"] = len(text.strip())
        return text.strip(), info
    except Exception as exc:  # pragma: no cover
        info["error"] = str(exc)[:200]
        return "", info


def _analyse_filename(filename: str) -> list[Indicator]:
    indicators: list[Indicator] = []
    stem = filename.rsplit(".", 1)[0].lower()
    lowered = filename.lower()

    tokens = [tok for tok in _SUSPICIOUS_FILENAME_TOKENS if tok in stem]
    if tokens:
        indicators.append(
            Indicator(
                "FILENAME_PATTERN",
                "Non-original file naming",
                f"The file name contains {', '.join(repr(t) for t in tokens[:4])}, which "
                "suggests a re-saved, forwarded or working copy rather than an original issued "
                "document.",
                "low",
                7,
            )
        )
    if lowered.count(".") > 1:
        indicators.append(
            Indicator(
                "DOUBLE_EXTENSION",
                "Multiple file extensions",
                "The file name contains more than one extension, a technique used to disguise "
                "the real file type.",
                "high",
                15,
            )
        )
    if re.fullmatch(r"[a-f0-9]{16,}\.[a-z0-9]+", lowered) or re.fullmatch(
        r"(img|image|doc|file|scan)[-_ ]?\d{3,}\.[a-z0-9]+", lowered
    ):
        indicators.append(
            Indicator(
                "GENERIC_FILENAME",
                "Auto-generated file name",
                "The file name looks machine-generated rather than descriptive, which is normal "
                "for downloads but provides no provenance information.",
                "low",
                5,
            )
        )
    if len(filename) > 120:
        indicators.append(
            Indicator(
                "LONG_FILENAME",
                "Unusually long file name",
                "Very long file names are sometimes used to push a real extension out of view.",
                "low",
                6,
            )
        )
    return indicators


def _analyse_extracted_text(text: str) -> tuple[list[Indicator], dict[str, Any]]:
    indicators: list[Indicator] = []
    details: dict[str, Any] = {}
    if not text or len(text.strip()) < 15:
        return indicators, details

    lowered = text.lower()
    words = re.findall(r"[a-zA-Z']{2,}", text)
    details["word_count"] = len(words)
    details["character_count"] = len(text)

    doc_terms = sorted({term for term in _HIGH_VALUE_DOC_TERMS if term in lowered})
    if doc_terms:
        details["document_type_hints"] = doc_terms
        indicators.append(
            Indicator(
                "HIGH_VALUE_DOCUMENT",
                "High-value document content",
                "The text references "
                f"{', '.join(doc_terms[:4])}. Documents of this kind are frequently forged, so "
                "independent verification with the issuing authority is advisable.",
                "low",
                8,
            )
        )

    red_flags = sorted({term for term in _DOC_RED_FLAG_TERMS if term in lowered})
    if red_flags:
        details["red_flag_terms"] = red_flags
        weight = min(20.0, 6.0 * len(red_flags))
        indicators.append(
            Indicator(
                "SUSPICIOUS_DOCUMENT_TERMS",
                f"{len(red_flags)} suspicious term(s) in the text",
                f"The extracted text contains {', '.join(red_flags[:5])} — wording associated "
                "with advance-fee fraud, credential requests or unverifiable guarantees.",
                _severity_for(weight),
                weight,
            )
        )

    urls = extract_urls(text)
    if urls:
        details["embedded_urls"] = urls

    # Reuse the scam-message engine over the document body.
    try:
        message_result = analyse_message(text[:8000])
    except ValueError:
        message_result = None

    if message_result and message_result["risk_score"] >= 30:
        weight = min(24.0, message_result["risk_score"] * 0.28)
        details["content_analysis"] = {
            "risk_score": message_result["risk_score"],
            "prediction": message_result["prediction"],
            "detected_categories": message_result["detected_categories"],
            "suspicious_phrases": message_result["suspicious_phrases"][:6],
        }
        indicators.append(
            Indicator(
                "FRAUDULENT_CONTENT_PATTERNS",
                "Fraud patterns in the document text",
                "Running the document text through the scam-message engine returned "
                f"{message_result['risk_score']:.0f}/100 "
                f"({', '.join(message_result['detected_categories'][:3]) or 'multiple signals'}).",
                _severity_for(weight),
                round(weight, 2),
            )
        )
    elif message_result:
        details["content_analysis"] = {
            "risk_score": message_result["risk_score"],
            "prediction": message_result["prediction"],
            "detected_categories": message_result["detected_categories"],
        }

    # Garbled text is a weak signal of tampering or of a poor-quality scan.
    if words:
        alpha_ratio = sum(ch.isalnum() or ch.isspace() for ch in text) / max(len(text), 1)
        details["alphanumeric_ratio"] = round(alpha_ratio, 3)
        if alpha_ratio < 0.7 and len(text) > 120:
            indicators.append(
                Indicator(
                    "GARBLED_TEXT",
                    "Text layer is largely unreadable",
                    f"Only {alpha_ratio * 100:.0f}% of the extracted text is alphanumeric, which "
                    "points to a poor scan, an unusual font or a manipulated text layer.",
                    "low",
                    8,
                )
            )
        repeats = Counter(w.lower() for w in words if len(w) > 3)
        if repeats and len(words) > 40:
            top_word, count = repeats.most_common(1)[0]
            if count / len(words) > 0.18:
                details["dominant_word"] = {"word": top_word, "ratio": round(count / len(words), 3)}
                indicators.append(
                    Indicator(
                        "REPETITIVE_TEXT",
                        "Highly repetitive text",
                        f"The word '{top_word}' accounts for {count / len(words) * 100:.0f}% of "
                        "the text, which is unusual for a genuine document body.",
                        "low",
                        7,
                    )
                )
    return indicators, details


# --- Scoring ------------------------------------------------------------------


def _score(indicators: list[Indicator]) -> float:
    total = 0.0
    for position, indicator in enumerate(indicators):
        decay = 1.0 if position < 3 else max(0.4, 1.0 - 0.13 * (position - 2))
        total += indicator.weight * decay
    return min(100.0, round(total, 2))


def risk_level_for(score: float) -> str:
    if score >= 80:
        return "CRITICAL"
    if score >= 60:
        return "HIGH"
    if score >= 30:
        return "MEDIUM"
    return "LOW"


_PREDICTION_BY_LEVEL = {
    "LOW": "No Significant Anomalies",
    "MEDIUM": "Potential Anomalies Detected",
    "HIGH": "Multiple Anomalies Detected",
    "CRITICAL": "Strong Anomaly Pattern Detected",
}

DISCLAIMER = (
    "This result is an automated risk assessment and does not constitute forensic "
    "verification. It highlights statistical and structural anomalies only; it cannot prove "
    "that a document is genuine or forged. Always verify important documents with the "
    "issuing authority."
)


def _build_explanation(
    indicators: list[Indicator],
    score: float,
    level: str,
    evidence: list[str],
) -> str:
    basis = ", ".join(evidence) if evidence else "file structure and naming only"
    if not indicators:
        return (
            f"No anomalies were detected. The analysis was based on {basis}. The file structure "
            "is well formed, its metadata is internally consistent, and no suspicious wording "
            "was found in the extracted content. Note that an absence of detected anomalies is "
            "not proof of authenticity."
        )

    reasons = "; ".join(ind.label.lower() for ind in indicators[:3])
    detail = " ".join(ind.detail for ind in indicators[:3])
    extra = (
        f" A further {len(indicators) - 3} lower-weight observation(s) also contributed."
        if len(indicators) > 3
        else ""
    )
    lead = {
        "LOW": "Only minor observations were made about this document",
        "MEDIUM": "Potential anomalies were detected in this document",
        "HIGH": "Multiple anomalies were detected in this document",
        "CRITICAL": "A strong pattern of anomalies was detected in this document",
    }[level]
    return (
        f"{lead}. The risk score of {score:.0f}/100 is based on {basis}, and is driven mainly by "
        f"{reasons}. {detail}{extra}"
    )


def _recommendation_for(level: str) -> str:
    if level == "CRITICAL":
        return (
            "Do not act on this document. Multiple structural and content anomalies were found "
            "together. Treat it as unverified, do not transfer money or share credentials on the "
            "strength of it, and confirm directly with the issuing authority before proceeding."
        )
    if level == "HIGH":
        return (
            "Manual verification is required before this document is relied upon. Request the "
            "original from the issuer, compare it against an official record, and do not make "
            "payments or decisions based on this copy alone."
        )
    if level == "MEDIUM":
        return (
            "Some characteristics warrant a closer look. Confirm the document's origin with the "
            "sender through a channel you trust, and cross-check key details (names, numbers, "
            "dates, amounts) against an independent source."
        )
    return (
        "No major suspicious indicators were detected. Continue following standard verification "
        "practices for documents that carry financial or legal weight."
    )


# --- Public API ---------------------------------------------------------------


def analyse_document(filename: str, content: bytes) -> dict[str, Any]:
    """Analyse an uploaded document and return a structured risk assessment.

    Raises:
        ValueError: if the file fails validation.
    """
    extension, detected_type = validate_upload(filename, content)

    indicators: list[Indicator] = []
    evidence: list[str] = ["file structure", "file naming"]

    metadata: dict[str, Any] = {
        "filename": filename,
        "declared_extension": extension,
        "detected_type": detected_type,
        "file_size_bytes": len(content),
        "file_size_kb": round(len(content) / 1024, 2),
        "sha256": hashlib.sha256(content).hexdigest(),
        "analysed_at": datetime.now(UTC).isoformat(),
    }

    # Extension vs. magic-byte consistency.
    normalised_ext = "jpg" if extension == "jpeg" else extension
    if detected_type == "unknown":
        indicators.append(
            Indicator(
                "UNRECOGNISED_SIGNATURE",
                "File signature not recognised",
                f"The file is named as a .{extension} document but its binary header does not "
                "match any expected format signature. Potential anomaly — requires manual "
                "verification.",
                "high",
                18,
            )
        )
    elif detected_type != normalised_ext:
        indicators.append(
            Indicator(
                "EXTENSION_MISMATCH",
                "Extension does not match file content",
                f"The file is named .{extension} but its actual content is a {detected_type.upper()} "
                "file. A mismatch of this kind is a strong sign the file has been renamed.",
                "critical",
                24,
            )
        )

    text = ""
    ocr_info: dict[str, Any] = {"attempted": False, "available": ocr_status()["available"]}

    if extension == "pdf":
        pdf_meta, pdf_text, pdf_indicators = _inspect_pdf(content)
        metadata.update(pdf_meta)
        indicators.extend(pdf_indicators)
        text = pdf_text
        if PYPDF_AVAILABLE:
            evidence.append("PDF metadata and page structure")
        if pdf_text:
            evidence.append("embedded PDF text")
        elif metadata.get("page_count"):
            indicators.append(
                Indicator(
                    "SCANNED_PDF_NO_TEXT",
                    "No selectable text layer",
                    "The PDF contains pages but no extractable text, meaning it is an image-only "
                    "scan. Content-level checks could not be applied to it.",
                    "low",
                    6,
                )
            )
    else:
        image_meta, image_indicators = _inspect_image(content)
        metadata.update(image_meta)
        indicators.extend(image_indicators)
        if PIL_AVAILABLE:
            evidence.append("image properties and EXIF metadata")
        text, ocr_info = _run_ocr(content)
        if text:
            evidence.append("OCR-extracted text")

    if not text and not ocr_info.get("available", False) and extension != "pdf":
        indicators.append(
            Indicator(
                "OCR_UNAVAILABLE",
                "OCR engine not installed",
                "Tesseract OCR is not installed on this server, so the text inside the image "
                "could not be read. The assessment below is based on file structure, image "
                "properties and metadata only, and is therefore less complete.",
                "info",
                0,
            )
        )

    indicators.extend(_analyse_filename(filename))
    text_indicators, text_details = _analyse_extracted_text(text)
    indicators.extend(text_indicators)

    # Informational indicators (weight 0) never influence the score.
    scoring_indicators = [ind for ind in indicators if ind.weight > 0]
    scoring_indicators.sort(key=lambda ind: ind.weight, reverse=True)
    score = _score(scoring_indicators)
    level = risk_level_for(score)
    prediction = _PREDICTION_BY_LEVEL[level]

    ordered = scoring_indicators + [ind for ind in indicators if ind.weight == 0]

    # Confidence reflects how much evidence was actually available.
    evidence_score = 0.45
    if text:
        evidence_score += 0.2
    if metadata.get("exif_tag_count") or metadata.get("pdf_producer"):
        evidence_score += 0.12
    if detected_type != "unknown":
        evidence_score += 0.1
    if PIL_AVAILABLE or PYPDF_AVAILABLE:
        evidence_score += 0.08
    confidence = round(min(0.95, evidence_score), 3)

    truncated_text = text[:6000]
    return {
        "filename": filename,
        "file_type": extension,
        "file_size": len(content),
        "prediction": prediction,
        "risk_score": score,
        "risk_level": level,
        "confidence": confidence,
        "extracted_text": truncated_text,
        "extracted_text_truncated": len(text) > len(truncated_text),
        "ocr_available": bool(ocr_info.get("available")),
        "ocr_used": bool(text) and extension != "pdf",
        "metadata": metadata,
        "indicators": [ind.to_dict() for ind in ordered],
        "explanation": _build_explanation(scoring_indicators, score, level, evidence),
        "recommendation": _recommendation_for(level),
        "disclaimer": DISCLAIMER,
        "analysis_details": {
            "engine": "FraudShield Document Analyzer v1",
            "prediction_source": "structural_heuristics",
            "evidence_sources": evidence,
            "capabilities": {
                "pillow": PIL_AVAILABLE,
                "pypdf": PYPDF_AVAILABLE,
                "tesseract_ocr": bool(ocr_info.get("available")),
                "tesseract_version": ocr_info.get("version"),
            },
            "ocr": ocr_info,
            "text_analysis": text_details,
            "indicator_count": len(scoring_indicators),
            "heuristic_score": score,
        },
    }
