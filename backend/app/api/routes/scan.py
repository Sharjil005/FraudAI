"""Analysis routes: URL, message and document scanning."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession
from app.core.logging_config import get_logger
from app.ml.document_analyzer import ocr_status
from app.ml.model_store import registry
from app.schemas.scan import (
    DocumentScanResult,
    MessageScanRequest,
    MessageScanResult,
    QrScanRequest,
    QrScanResult,
    UrlScanRequest,
    UrlScanResult,
)
from app.services.scan_service import (
    run_document_scan,
    run_message_scan,
    run_qr_scan,
    run_url_scan,
)

logger = get_logger(__name__)
router = APIRouter(prefix="/scan", tags=["Analysis"])


@router.post(
    "/url",
    response_model=UrlScanResult,
    status_code=status.HTTP_201_CREATED,
    summary="Analyse a suspicious URL for phishing indicators",
)
def scan_url(payload: UrlScanRequest, db: DbSession, current_user: CurrentUser) -> dict:
    try:
        return run_url_scan(db, current_user, payload.url)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        db.rollback()
        logger.exception("URL scan failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="URL analysis could not be completed. Please try again.",
        ) from exc


@router.post(
    "/message",
    response_model=MessageScanResult,
    status_code=status.HTTP_201_CREATED,
    summary="Analyse an SMS, email or chat message for scam patterns",
)
def scan_message(payload: MessageScanRequest, db: DbSession, current_user: CurrentUser) -> dict:
    try:
        return run_message_scan(db, current_user, payload.message)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        db.rollback()
        logger.exception("Message scan failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Message analysis could not be completed. Please try again.",
        ) from exc


@router.post(
    "/document",
    response_model=DocumentScanResult,
    status_code=status.HTTP_201_CREATED,
    summary="Analyse an uploaded image or PDF for document risk indicators",
)
async def scan_document(
    db: DbSession,
    current_user: CurrentUser,
    file: Annotated[UploadFile, File(description="PNG, JPG, JPEG or PDF file")],
) -> dict:
    filename = (file.filename or "").strip()
    if not filename:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A file with a valid name is required.",
        )

    try:
        content = await file.read()
    except Exception as exc:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file could not be read.",
        ) from exc
    finally:
        await file.close()

    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"File is too large. The maximum supported size is "
                f"{settings.MAX_UPLOAD_SIZE_MB} MB."
            ),
        )

    try:
        return run_document_scan(db, current_user, filename, content)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        db.rollback()
        logger.exception("Document scan failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Document analysis could not be completed. Please try again.",
        ) from exc


@router.post(
    "/qr",
    response_model=QrScanResult,
    status_code=status.HTTP_201_CREATED,
    summary="Analyse a QR code payload or UPI payment link for fraud signals",
)
def scan_qr_payload(payload: QrScanRequest, db: DbSession, current_user: CurrentUser) -> dict:
    if not payload.payload or not payload.payload.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A UPI link, VPA handle, or QR payload string is required.",
        )
    try:
        return run_qr_scan(
            db,
            current_user,
            payload=payload.payload.strip(),
            claimed_intent=payload.claimed_intent,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        db.rollback()
        logger.exception("QR payload scan failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="QR/UPI analysis could not be completed. Please try again.",
        ) from exc


@router.post(
    "/qr/upload",
    response_model=QrScanResult,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a QR code image to decode and scan for payment fraud",
)
async def scan_qr_upload(
    db: DbSession,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    claimed_intent: Annotated[str, Form()] = "GENERAL_SCAN",
) -> dict:
    filename = (file.filename or "").strip()
    if not filename:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A file with a valid name is required.",
        )

    try:
        content = await file.read()
    except Exception as exc:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded image could not be read.",
        ) from exc
    finally:
        await file.close()

    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File is too large. The maximum supported size is {settings.MAX_UPLOAD_SIZE_MB} MB.",
        )

    try:
        return run_qr_scan(
            db,
            current_user,
            file_bytes=content,
            filename=filename,
            claimed_intent=claimed_intent,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        db.rollback()
        logger.exception("QR image scan failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="QR code decoding and analysis could not be completed. Please try again.",
        ) from exc


@router.get(
    "/capabilities",
    summary="Report which analysis engines and optional dependencies are active",
)
def capabilities() -> dict:
    ocr = ocr_status()
    return {
        "models": registry.status(),
        "ocr": {
            "engine": "tesseract",
            "available": ocr["available"],
            "version": ocr["version"],
            "fallback": (
                "Structural, metadata and filename analysis only"
                if not ocr["available"]
                else None
            ),
        },
        "uploads": {
            "allowed_extensions": sorted(settings.allowed_extensions),
            "max_size_mb": settings.MAX_UPLOAD_SIZE_MB,
        },
        "risk_bands": {
            "LOW": "0-29",
            "MEDIUM": "30-59",
            "HIGH": "60-79",
            "CRITICAL": "80-100",
        },
    }
