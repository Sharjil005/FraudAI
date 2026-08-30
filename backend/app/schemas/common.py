"""Shared response envelopes."""

from __future__ import annotations

from pydantic import BaseModel, Field


class MessageResponse(BaseModel):
    message: str = Field(..., examples=["Operation completed successfully."])


class ErrorResponse(BaseModel):
    detail: str = Field(..., examples=["Invalid credentials."])
    code: str | None = Field(default=None, examples=["INVALID_CREDENTIALS"])


class PaginatedMeta(BaseModel):
    total: int = Field(..., ge=0)
    page: int = Field(..., ge=1)
    page_size: int = Field(..., ge=1)
    total_pages: int = Field(..., ge=0)
