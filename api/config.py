"""Application configuration management."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from pydantic import BaseSettings, EmailStr, Field, validator


class Settings(BaseSettings):
    """Settings pulled from environment variables or `.env` files."""

    app_env: str = Field("dev", env="APP_ENV")
    api_host: str = Field("0.0.0.0", env="API_HOST")
    api_port: int = Field(8001, env="API_PORT")

    secret_key: str = Field(..., env="SECRET_KEY")
    access_token_ttl_min: int = Field(15, env="ACCESS_TOKEN_TTL_MIN")
    refresh_token_ttl_days: int = Field(7, env="REFRESH_TOKEN_TTL_DAYS")

    db_url: str = Field(..., env="DB_URL")
    redis_url: str = Field(..., env="REDIS_URL")

    cors_origins: List[str] = Field(default_factory=list, env="CORS_ORIGINS")

    alert_channels: List[str] = Field(default_factory=list, env="ALERT_CHANNELS")
    slack_webhook_url: Optional[str] = Field(None, env="SLACK_WEBHOOK_URL")

    smtp_host: Optional[str] = Field(None, env="SMTP_HOST")
    smtp_port: Optional[int] = Field(None, env="SMTP_PORT")
    smtp_user: Optional[EmailStr] = Field(None, env="SMTP_USER")
    smtp_pass: Optional[str] = Field(None, env="SMTP_PASS")
    smtp_from: Optional[EmailStr] = Field(None, env="SMTP_FROM")
    smtp_to: Optional[EmailStr] = Field(None, env="SMTP_TO")

    seed_admin_email: Optional[EmailStr] = Field(None, env="SEED_ADMIN_EMAIL")
    seed_admin_password: Optional[str] = Field(None, env="SEED_ADMIN_PASSWORD")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

    @validator("cors_origins", pre=True)
    def parse_cors_origins(cls, value: str | List[str]) -> List[str]:
        """Ensure CORS origins are returned as a list."""
        if isinstance(value, list):
            return value
        if not value:
            return []
        return [origin.strip() for origin in value.split(",") if origin.strip()]

    @validator("alert_channels", pre=True)
    def parse_alert_channels(cls, value: str | List[str]) -> List[str]:
        if isinstance(value, list):
            return value
        if not value:
            return []
        return [channel.strip() for channel in value.split(",") if channel.strip()]

    @validator("secret_key")
    def validate_secret_key(cls, value: str) -> str:
        if len(value) < 16:
            raise ValueError("SECRET_KEY must be at least 16 characters long.")
        return value


@lru_cache()
def get_settings() -> Settings:
    """Return a cached instance of application settings."""
    env_path = Path(".env")
    if env_path.exists():
        return Settings(_env_file=env_path)
    return Settings()


SettingsType = Settings
