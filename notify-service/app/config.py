from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Set DATABASE_URL in .env (never commit it). Falls back to a local
    # SQLite file so the service still starts without credentials.
    database_url: str = "sqlite:///./local.db"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()