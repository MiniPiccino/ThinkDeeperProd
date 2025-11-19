from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional

from ..models.reflection import (
    ReflectionDaySummary,
    ReflectionEntry,
    ReflectionOverview,
    ReflectionTeaser,
)
from ..repositories import AnswerRepository, QuestionRepository, StoredAnswer, UserRepository


class ReflectionService:
    """Builds reflection summaries backed by stored answers."""

    WEEK_DAYS = 7
    MAX_RECENT_FETCH = 90

    def __init__(
        self,
        answer_repository: AnswerRepository,
        question_repository: QuestionRepository,
        user_repository: UserRepository,
    ) -> None:
        self._answers = answer_repository
        self._questions = question_repository
        self._users = user_repository

    def overview(self, user_id: str, tz_offset_minutes: int = 0) -> ReflectionOverview:
        plan = self._users.get_plan(user_id)
        is_premium = plan == "premium"
        today = self._local_date(tz_offset_minutes)
        recent_answers = self._answers.recent_answers(user_id, limit=self.MAX_RECENT_FETCH)
        answers_by_date: Dict[date, StoredAnswer] = {}
        for stored in recent_answers:
            day = self._local_date_from_timestamp(stored.created_at, tz_offset_minutes)
            if day not in answers_by_date:
                answers_by_date[day] = stored

        today_entry = answers_by_date.get(today)
        weekly_blocks = self._weekly_summaries(today, answers_by_date, tz_offset_minutes)
        teasers = []
        if not is_premium:
            week_start = today - timedelta(days=today.weekday())
            older = [entry for entry in recent_answers if entry.created_at.date() < week_start]
            teasers = [self._teaser_payload(entry) for entry in older[:2] if entry.answer.strip()]

        overview = ReflectionOverview(
            plan=plan,
            today=self._entry_payload(today_entry) if today_entry else None,
            todayLocked=today_entry is None,
            week=weekly_blocks,
            teasers=teasers,
            timelineUnlocked=is_premium,
        )
        return overview

    def _weekly_summaries(
        self,
        reference_day: date,
        answers_by_date: Dict[date, StoredAnswer],
        tz_offset_minutes: int,
    ) -> List[ReflectionDaySummary]:
        start_of_week = reference_day - timedelta(days=reference_day.weekday())
        days = []
        for offset in range(self.WEEK_DAYS):
            current = start_of_week + timedelta(days=offset)
            stored = answers_by_date.get(current)
            days.append(
                ReflectionDaySummary(
                    date=current,
                    weekday=current.strftime("%A"),
                    hasEntry=stored is not None,
                    entry=self._entry_payload(stored) if stored else None,
                )
            )
        return days

    def _entry_payload(self, stored: Optional[StoredAnswer]) -> Optional[ReflectionEntry]:
        if not stored:
            return None
        prompt, theme = self._question_meta(stored.question_id)
        excerpt = self._excerpt(stored.answer)
        return ReflectionEntry(
            questionId=stored.question_id,
            prompt=prompt,
            theme=theme,
            answeredAt=stored.created_at,
            xpAwarded=stored.xp_awarded,
            durationSeconds=stored.duration_seconds,
            excerpt=excerpt,
            answer=stored.answer,
            feedback=stored.feedback or None,
        )

    def _teaser_payload(self, stored: StoredAnswer) -> ReflectionTeaser:
        prompt, _ = self._question_meta(stored.question_id)
        return ReflectionTeaser(
            questionId=stored.question_id,
            prompt=prompt,
            answeredAt=stored.created_at,
            snippet=self._excerpt(stored.answer, 140),
        )

    def _question_meta(self, question_id: str) -> tuple[str, str]:
        try:
            question = self._questions.get_by_id(question_id)
            return question.prompt, question.theme
        except KeyError:
            return ("Daily reflection", "Unknown theme")

    @staticmethod
    def _excerpt(answer: str, limit: int = 220) -> str:
        text = answer.strip()
        if len(text) <= limit:
            return text
        return text[: limit - 1].rstrip() + "…"

    @staticmethod
    def _local_date_from_timestamp(timestamp: datetime, tz_offset_minutes: int) -> date:
        aware = timestamp
        if timestamp.tzinfo is None:
            aware = timestamp.replace(tzinfo=timezone.utc)
        utc_value = aware.astimezone(timezone.utc)
        local_dt = utc_value - timedelta(minutes=tz_offset_minutes)
        return local_dt.date()

    @staticmethod
    def _local_date(tz_offset_minutes: int) -> date:
        now_utc = datetime.now(timezone.utc)
        return (now_utc - timedelta(minutes=tz_offset_minutes)).date()
