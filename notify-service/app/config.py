from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Set this in your .env file — get the real value from your
    # Neon project's "Connect" modal, and make sure it ends in
    # ?sslmode=require
    database_url: str= "postgresql://neondb_owner:REDACTED@ep-weathered-dew-axxpdl3u.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require"

    model_config = SettingsConfigDict(env_file=".env.example", extra="ignore")


settings = Settings()