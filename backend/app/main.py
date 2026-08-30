"""FraudShield AI — FastAPI application entrypoint."""

from __future__ import annotations

import time
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import settings
from app.core.logging_config import configure_logging, get_logger
from app.database.init_db import init_db
from app.database.session import DATABASE_FLAVOUR
from app.ml import model_store

configure_logging()
logger = get_logger("app.main")

DESCRIPTION = """
**FraudShield AI** is an AI-powered digital fraud detection and risk analysis platform.

It analyses three attack surfaces and returns a single explainable risk assessment:

* **URL Analysis** — 28 lexical/structural features scored by a Random Forest classifier
  blended with a weighted rule engine (phishing, brand impersonation, credential harvesting).
* **Message Analysis** — TF-IDF + Logistic Regression combined with 15 categories of
  scam pattern detection (OTP theft, lottery, KYC, threats, investment fraud).
* **Document Analysis** — structural, metadata and OCR-based risk assessment of images
  and PDFs. This is a *risk indicator* engine, not forensic proof.

Every response includes the risk score (0-100), risk band, top contributing indicators,
a plain-language explanation and an actionable recommendation.

### Authentication
Call `POST /api/auth/login`, then send the returned token as `Authorization: Bearer <token>`.
Use the **Authorize** button above to try the protected endpoints from this page.
""".strip()

TAGS_METADATA = [
    {"name": "Authentication", "description": "Registration, login and current-user lookup."},
    {"name": "Analysis", "description": "Run URL, message and document fraud analysis."},
    {"name": "Scan History", "description": "Browse, filter and inspect previous scans."},
    {"name": "Dashboard", "description": "Aggregated statistics for the signed-in user."},
    {"name": "Administration", "description": "Platform-wide analytics and user management."},
    {"name": "Reports", "description": "Download PDF/HTML risk reports."},
    {"name": "System", "description": "Health and service metadata."},
]


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info("Starting %s (%s)", settings.PROJECT_NAME, settings.ENVIRONMENT)
    init_db()
    if settings.TRAIN_MODELS_ON_STARTUP:
        try:
            model_store.warm_up()
        except Exception:  # pragma: no cover - never block startup on ML
            logger.exception("Model warm-up failed; falling back to heuristic-only scoring")
    logger.info("Startup complete. Docs available at /docs")
    yield
    logger.info("Shutting down %s", settings.PROJECT_NAME)


app = FastAPI(
    title=settings.PROJECT_NAME,
    description=DESCRIPTION,
    version="1.0.0",
    openapi_tags=TAGS_METADATA,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
    contact={"name": "FraudShield AI", "url": "http://localhost:5173"},
    license_info={"name": "MIT"},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Report-Format", "X-Process-Time"],
)


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):  # type: ignore[no-untyped-def]
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Process-Time"] = f"{(time.perf_counter() - started) * 1000:.1f}ms"
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Flatten Pydantic errors into a single readable message for the UI."""
    messages: list[str] = []
    for error in exc.errors():
        location = ".".join(str(part) for part in error.get("loc", ()) if part != "body")
        message = error.get("msg", "Invalid value")
        messages.append(f"{location}: {message}" if location else message)

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": messages[0] if messages else "The submitted data is invalid.",
            "errors": messages,
        },
    )


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
    logger.warning("Rejected request to %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": str(exc) or "The submitted data could not be processed."},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected server error occurred. Please try again."},
    )


app.include_router(api_router, prefix=settings.API_PREFIX)


@app.get("/", tags=["System"], summary="Service banner")
def root() -> dict:
    return {
        "service": settings.PROJECT_NAME,
        "version": "1.0.0",
        "status": "online",
        "documentation": "/docs",
        "api_prefix": settings.API_PREFIX,
    }


@app.get(f"{settings.API_PREFIX}/health", tags=["System"], summary="Health check")
def health() -> dict:
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "database": DATABASE_FLAVOUR,
        "models": model_store.registry.status(),
    }
