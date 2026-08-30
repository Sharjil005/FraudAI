"""Application configuration.

All settings are environment driven with safe development defaults so that the
project runs immediately after checkout without any manual configuration.
"""

from __future__ import annotations

import secrets
from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(PROJECT_ROOT / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ---- Identity -----------------------------------------------------------
    PROJECT_NAME: str = "FraudShield AI"
    API_PREFIX: str = "/api"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # ---- Database -----------------------------------------------------------
    # Defaults to a local SQLite file. Point at PostgreSQL by exporting
    # DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/fraudshield
    DATABASE_URL: str = f"sqlite:///{(BACKEND_DIR / 'fraudshield.db').as_posix()}"

    # ---- Auth ---------------------------------------------------------------
    SECRET_KEY: str = secrets.token_urlsafe(48)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # ---- Bootstrap accounts -------------------------------------------------
    ADMIN_EMAIL: str = "admin@fraudshield.local"
    ADMIN_PASSWORD: str = "Admin@12345"
    ADMIN_NAME: str = "FraudShield Admin"
    DEMO_EMAIL: str = "demo@fraudshield.local"
    DEMO_PASSWORD: str = "Demo@12345"
    DEMO_NAME: str = "Demo Analyst"
    CREATE_BOOTSTRAP_USERS: bool = True

    # ---- Uploads ------------------------------------------------------------
    UPLOAD_DIRECTORY: str = str(BACKEND_DIR / "uploads")
    MAX_UPLOAD_SIZE_MB: int = 10
    ALLOWED_UPLOAD_EXTENSIONS: str = "png,jpg,jpeg,pdf"

    # ---- ML -----------------------------------------------------------------
    MODEL_DIRECTORY: str = str(BACKEND_DIR / "app" / "ml" / "artifacts")
    TRAIN_MODELS_ON_STARTUP: bool = True

    # ---- CORS ---------------------------------------------------------------
    CORS_ORIGINS: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:4173,http://127.0.0.1:4173,"
        "http://localhost:3000,http://127.0.0.1:3000"
    )

    @field_validator("ENVIRONMENT")
    @classmethod
    def _normalise_env(cls, value: str) -> str:
        return value.strip().lower()

    # ---- Derived helpers ----------------------------------------------------
    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def allowed_extensions(self) -> set[str]:
        return {
            ext.strip().lower().lstrip(".")
            for ext in self.ALLOWED_UPLOAD_EXTENSIONS.split(",")
            if ext.strip()
        }

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    @property
    def upload_path(self) -> Path:
        path = Path(self.UPLOAD_DIRECTORY)
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def model_path(self) -> Path:
        path = Path(self.MODEL_DIRECTORY)
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def is_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
