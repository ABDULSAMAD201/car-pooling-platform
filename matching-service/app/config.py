from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env.example",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    DATABASE_URL: str = "postgresql://neondb_owner:REDACTED@ep-bold-tooth-aepz4etm.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"
    BOOKING_SERVICE_URL: str = "http://localhost:8000"


settings = Settings()
