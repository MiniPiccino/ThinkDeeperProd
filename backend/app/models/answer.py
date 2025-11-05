from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict


class AnswerCreate(BaseModel):
    """Inbound payload when a user submits an answer."""

    question_id: str = Field(..., alias="questionId")
    answer: str
    user_id: Optional[str] = Field(default=None, alias="userId")
    duration_seconds: int = Field(..., alias="durationSeconds", ge=0)

    model_config = ConfigDict(populate_by_name=True)


class AnswerResult(BaseModel):
    """Response returned to the frontend after evaluation."""

    feedback: str
    xp_awarded: int = Field(..., alias="xpAwarded")
    base_xp: int = Field(..., alias="baseXp")
    bonus_xp: int = Field(..., alias="bonusXp")
    xp_total: int = Field(..., alias="xpTotal")
    streak: int
    difficulty_level: str = Field(..., alias="difficultyLevel")
    difficulty_multiplier: float = Field(..., alias="difficultyMultiplier")
    week_completed_days: int = Field(..., alias="weekCompletedDays")
    week_total_days: int = Field(..., alias="weekTotalDays")
    week_badge_earned: bool = Field(..., alias="weekBadgeEarned")
    badge_name: Optional[str] = Field(default=None, alias="badgeName")
    level: int
    xp_to_next_level: int = Field(..., alias="xpToNextLevel")
    next_level_threshold: int = Field(..., alias="nextLevelThreshold")
    xp_into_level: int = Field(..., alias="xpIntoLevel")
    level_progress_percent: int = Field(..., alias="levelProgressPercent")
    evaluated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(populate_by_name=True)
