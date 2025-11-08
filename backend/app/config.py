from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from pydantic import Field
from pydantic_settings import BaseSettings

_DATA_DIR = Path(__file__).parents[1] / "data"


class Settings(BaseSettings):
    """Application configuration loaded from environment variables and .env files."""

    openai_api_key: str = Field(..., alias="OPENAI_API_KEY")
    google_sheets_id: Optional[str] = Field(default=None, alias="GOOGLE_SHEETS_ID")
    google_service_account_json: Optional[str] = Field(
        default=None, alias="GOOGLE_APPLICATION_CREDENTIALS_JSON"
    )
    data_dir: Path = Field(default=_DATA_DIR, alias="DATA_DIR")
    question_source: Path = Field(
        default=_DATA_DIR / "questions.json",
        alias="QUESTION_SOURCE",
    )
    answers_store_path: Path = Field(
        default=_DATA_DIR / "answers.jsonl",
        alias="ANSWERS_STORE_PATH",
    )
    progress_store_path: Path = Field(
        default=_DATA_DIR / "progress.json",
        alias="PROGRESS_STORE_PATH",
    )
    supabase_url: Optional[str] = Field(default=None, alias="SUPABASE_URL")
    supabase_service_key: Optional[str] = Field(default=None, alias="SUPABASE_SERVICE_KEY")
    supabase_answers_table: str = Field(default="answers", alias="SUPABASE_ANSWERS_TABLE")
    supabase_progress_table: str = Field(default="user_progress", alias="SUPABASE_PROGRESS_TABLE")
    evaluation_model: str = Field(default="gpt-4o-mini", alias="EVALUATION_MODEL")
    default_timer_seconds: int = Field(default=300, alias="DEFAULT_TIMER_SECONDS")
    xp_max: int = Field(default=100, alias="XP_MAX")
    allowed_origins: List[str] = Field(
        default_factory=lambda: ["http://localhost:3000"],
        alias="ALLOWED_ORIGINS",
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        populate_by_name = True


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""

    return Settings()  # type: ignore[arg-type]
