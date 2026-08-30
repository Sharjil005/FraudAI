"""Password hashing and JWT helpers."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from app.core.config import settings

# bcrypt refuses inputs longer than 72 bytes; truncate defensively.
_BCRYPT_MAX_BYTES = 72


def hash_password(password: str) -> str:
    payload = password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    return bcrypt.hashpw(payload, bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(
            password.encode("utf-8")[:_BCRYPT_MAX_BYTES],
            password_hash.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


def create_access_token(
    subject: str | int,
    *,
    role: str = "USER",
    expires_minutes: int | None = None,
) -> str:
    expires_delta = timedelta(minutes=expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
        "type": "access",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode a JWT, raising ``jwt.PyJWTError`` subclasses on failure."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
