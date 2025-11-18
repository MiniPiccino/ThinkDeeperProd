from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class ReflectionEntry(BaseModel):
    question_id: str = Field(..., alias="questionId")
    prompt: str
    theme: str
    answered_at: datetime = Field(..., alias="answeredAt")
    xp_awarded: int = Field(..., alias="xpAwarded")
    duration_seconds: int = Field(..., alias="durationSeconds")
    excerpt: str
    answer: str
    feedback: Optional[str] = None

    class Config:
        populate_by_name = True


class ReflectionDaySummary(BaseModel):
    date: date
    weekday: str
    has_entry: bool = Field(..., alias="hasEntry")
    entry: Optional[ReflectionEntry] = None

    class Config:
        populate_by_name = True


class ReflectionTeaser(BaseModel):
    question_id: str = Field(..., alias="questionId")
    prompt: str
    answered_at: datetime = Field(..., alias="answeredAt")
    snippet: str

    class Config:
        populate_by_name = True


class ReflectionOverview(BaseModel):
    plan: str
    today: Optional[ReflectionEntry] = None
    today_locked: bool = Field(..., alias="todayLocked")
    week: List[ReflectionDaySummary]
    teasers: List[ReflectionTeaser]
    timeline_unlocked: bool = Field(..., alias="timelineUnlocked")

    class Config:
        populate_by_name = True
