"""Document risk analysis and its graceful OCR fallback."""

from __future__ import annotations

import struct
import zlib

import pytest

from app.ml.document_analyzer import DISCLAIMER, analyse_document, validate_upload


def _png(width: int = 200, height: int = 150) -> bytes:
    rows = bytearray()
    for _ in range(height):
        rows.append(0)
        rows.extend((220, 220, 220) * width)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">2I5B", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(rows), 6))
        + chunk(b"IEND", b"")
    )


_MINIMAL_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
    b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>\nendobj\n"
    b"trailer\n<< /Size 4 /Root 1 0 R >>\n%%EOF\n"
)


def test_png_upload_is_accepted() -> None:
    extension, detected = validate_upload("statement.png", _png())
    assert extension == "png"
    assert detected == "png"


def test_pdf_upload_is_accepted() -> None:
    extension, detected = validate_upload("statement.pdf", _MINIMAL_PDF)
    assert extension == "pdf"
    assert detected == "pdf"


def test_empty_file_is_rejected() -> None:
    with pytest.raises(ValueError):
        validate_upload("empty.png", b"")


def test_unsupported_extension_is_rejected() -> None:
    with pytest.raises(ValueError):
        validate_upload("payload.exe", b"MZ\x90\x00")


def test_extension_mismatch_is_flagged() -> None:
    result = analyse_document("statement.pdf", _png())
    codes = {indicator["code"] for indicator in result["indicators"]}
    assert "EXTENSION_MISMATCH" in codes
    assert result["risk_score"] > 0


def test_analysis_returns_meaningful_output_without_ocr() -> None:
    """Required demo scenario: uploading a document must always produce analysis."""
    result = analyse_document("aadhaar_card_scan_copy_final.png", _png(900, 600))

    assert result["prediction"]
    assert result["explanation"]
    assert result["recommendation"]
    assert result["risk_level"] in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
    assert isinstance(result["indicators"], list)
    assert result["indicators"], "analysis must always explain what it inspected"
    assert result["metadata"]
    assert "ocr_available" in result


def test_document_output_avoids_forensic_certainty() -> None:
    result = analyse_document("bank_statement_edited_copy.png", _png())
    assert result["disclaimer"] == DISCLAIMER
    lowered = f"{result['prediction']} {result['explanation']}".lower()
    for forbidden in ("forged", "confirmed fake", "definitely", "proven", "certainly"):
        assert forbidden not in lowered


def test_informational_indicators_do_not_affect_the_score() -> None:
    result = analyse_document("photo.png", _png())
    for indicator in result["indicators"]:
        if indicator["code"] == "OCR_UNAVAILABLE":
            assert indicator["weight"] == 0
            assert indicator["severity"] == "info"


def test_pdf_without_pages_or_text_is_analysed() -> None:
    result = analyse_document("scan.pdf", _MINIMAL_PDF)
    assert result["file_type"] == "pdf"
    assert result["indicators"]
    assert 0 <= result["risk_score"] <= 100
