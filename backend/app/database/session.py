"""Database engine, session factory and declarative base.

FraudShield prefers PostgreSQL but must never fail to boot because a database
server is missing — a marker demo has to work on a laptop with nothing
installed. So the configured ``DATABASE_URL`` is probed once at import time and,
if it cannot be reached, the engine silently falls back to a local SQLite file.
"""

from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import BACKEND_DIR, settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)

SQLITE_FALLBACK_URL = f"sqlite:///{(BACKEND_DIR / 'fraudshield.db').as_posix()}"


def _build_engine(url: str) -> Engine:
    connect_args: dict[str, object] = {}
    if url.startswith("sqlite"):
        # FastAPI runs handlers in a threadpool; SQLite needs this relaxed check.
        connect_args["check_same_thread"] = False
    else:
        # Fail fast when probing an unreachable host instead of hanging startup.
        connect_args["connect_timeout"] = 5

    return create_engine(url, connect_args=connect_args, pool_pre_ping=True, future=True)


def _is_reachable(candidate: Engine) -> bool:
    try:
        with candidate.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception as error:  # noqa: BLE001 - any driver/network failure means "no"
        logger.warning("Database at %s is unavailable: %s", candidate.url.render_as_string(), error)
        return False
    return True


def _resolve_engine() -> tuple[Engine, str]:
    """Return ``(engine, url)``, degrading to SQLite when PostgreSQL is absent."""
    url = settings.DATABASE_URL

    if url.startswith("sqlite"):
        return _build_engine(url), url

    try:
        candidate = _build_engine(url)
    except Exception as error:  # noqa: BLE001 - missing driver, bad URL…
        logger.warning("Cannot use DATABASE_URL (%s); falling back to SQLite.", error)
    else:
        if _is_reachable(candidate):
            logger.info("Connected to PostgreSQL.")
            return candidate, url
        candidate.dispose()

    logger.warning("Falling back to SQLite at %s. Data stays local to this machine.", SQLITE_FALLBACK_URL)
    return _build_engine(SQLITE_FALLBACK_URL), SQLITE_FALLBACK_URL


engine, ACTIVE_DATABASE_URL = _resolve_engine()

#: True when the *effective* connection is SQLite, whatever was configured.
USING_SQLITE = ACTIVE_DATABASE_URL.startswith("sqlite")

#: Human-readable flavour for ``GET /api/health``.
DATABASE_FLAVOUR = "sqlite" if USING_SQLITE else "postgresql"

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a scoped database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
