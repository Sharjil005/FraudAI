"""Authentication schemas."""

from __future__ import annotations

import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.user import UserRole
from app.schemas.types import AccountEmail

_NAME_PATTERN = re.compile(r"^[A-Za-z][A-Za-z .'\-]{1,119}$")


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120, examples=["Aarav Sharma"])
    email: AccountEmail = Field(..., examples=["aarav@example.com"])
    password: str = Field(..., min_length=8, max_length=128, examples=["StrongPass@123"])

    @field_validator("name")
    @classmethod
    def _validate_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not _NAME_PATTERN.match(cleaned):
            raise ValueError("Name may only contain letters, spaces, apostrophes and hyphens.")
        return cleaned

    @field_validator("password")
    @classmethod
    def _validate_password(cls, value: str) -> str:
        if not re.search(r"[A-Za-z]", value):
            raise ValueError("Password must contain at least one letter.")
        if not re.search(r"\d", value):
            raise ValueError("Password must contain at least one number.")
        return value


class LoginRequest(BaseModel):
    email: AccountEmail = Field(..., examples=["demo@fraudshield.local"])
    password: str = Field(..., min_length=1, max_length=128, examples=["Demo@12345"])


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: UserRole
    is_active: bool = True
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Token lifetime in seconds.")
    user: UserOut
