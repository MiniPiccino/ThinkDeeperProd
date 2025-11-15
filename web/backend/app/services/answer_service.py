from datetime import datetime, timezone
from typing import Dict, Optional, Set

from ..models.answer import AnswerResult
from ..repositories import (
    AnswerRepository,
    ProgressRepository,
    QuestionRepository,
    StoredAnswer,
)
from .evaluation_service import EvaluationService


class DuplicateAnswerError(RuntimeError):
    """Raised when a user attempts to answer the same question more than once."""

    def __init__(self, question_id: str) -> None:
        super().__init__(f"Question '{question_id}' already answered.")
        self.question_id = question_id


class AnswerService:
    """Handles evaluation workflow, persistence, and streak calculations."""

    WEEK_DAYS = 7
    WEEK_COMPLETION_BONUS_XP = 25
    XP_PER_LEVEL = 120

    def __init__(
        self,
        question_repository: QuestionRepository,
        evaluation_service: EvaluationService,
        answer_repository: AnswerRepository,
        progress_repository: ProgressRepository,
    ) -> None:
        self._question_repository = question_repository
        self._evaluation_service = evaluation_service
        self._answer_repository = answer_repository
        self._progress_repository = progress_repository

    def submit_answer(
        self,
        question_id: str,
        answer: str,
        user_id: Optional[str],
        duration_seconds: int,
    ) -> AnswerResult:
        question = self._question_repository.get_by_id(question_id)
        feedback, base_xp = self._evaluation_service.evaluate(
            question.prompt, answer, duration_seconds
        )
        now = datetime.now(tz=timezone.utc)
        persisted_user_id = user_id or "anonymous"

        answers_this_week = self._answer_repository.answers_for_week(
            persisted_user_id, question.week_index
        )
        answered_ids: Set[str] = {stored.question_id for stored in answers_this_week}
        already_completed_today = question_id in answered_ids

        if already_completed_today:
            raise DuplicateAnswerError(question_id)

        difficulty_meta = self._difficulty_meta(question.day_index)
        adjusted_xp = self._apply_difficulty(base_xp, difficulty_meta["multiplier"])

        bonus_xp = 0
        week_completed_days = len(answered_ids) + (0 if already_completed_today else 1)
        week_completed_days = min(week_completed_days, self.WEEK_DAYS)
        badge_earned = False
        badge_name: Optional[str] = None
        if not already_completed_today and week_completed_days == self.WEEK_DAYS:
            bonus_xp = self.WEEK_COMPLETION_BONUS_XP
            badge_earned = True
            badge_name = self._badge_name(question.week_index, question.theme)

        total_awarded = adjusted_xp + bonus_xp
        progress = self._progress_repository.update(persisted_user_id, total_awarded, now)

        stored = StoredAnswer(
            user_id=persisted_user_id,
            question_id=question_id,
            answer=answer,
            feedback=feedback,
            xp_awarded=total_awarded,
            xp_total=int(progress["xp_total"]),
            streak=int(progress["streak"]),
            created_at=now,
            duration_seconds=duration_seconds,
            week_index=question.week_index,
        )
        self._answer_repository.save_answer(stored)

        level_stats = self._level_stats(int(progress["xp_total"]))

        return AnswerResult(
            feedback=feedback,
            xp_awarded=total_awarded,
            base_xp=adjusted_xp,
            bonus_xp=bonus_xp,
            xp_total=int(progress["xp_total"]),
            streak=int(progress["streak"]),
            difficulty_level=difficulty_meta["label"],
            difficulty_multiplier=difficulty_meta["multiplier"],
            week_completed_days=week_completed_days,
            week_total_days=self.WEEK_DAYS,
            week_badge_earned=badge_earned,
            badge_name=badge_name,
            level=level_stats["level"],
            xp_to_next_level=level_stats["xp_to_next"],
            next_level_threshold=level_stats["next_level_threshold"],
            xp_into_level=level_stats["xp_into_level"],
            level_progress_percent=level_stats["progress_percent"],
        )

    def _apply_difficulty(self, base_xp: int, multiplier: float) -> int:
        scaled = round(base_xp * multiplier)
        return max(1, scaled)

    @staticmethod
    def _difficulty_meta(day_index: int) -> Dict[str, object]:
        if day_index >= 5:
            return {"label": "mastery", "multiplier": 1.35}
        if day_index >= 3:
            return {"label": "deepening", "multiplier": 1.15}
        return {"label": "primer", "multiplier": 1.0}

    def _badge_name(self, week_index: int, theme: str) -> str:
        parts = [part.strip() for part in theme.split("—") if part.strip()]
        core = parts[-1] if parts else f"Week {week_index + 1}"
        return f"{core} Insight Badge"

    def _level_stats(self, xp_total: int) -> Dict[str, int]:
        if xp_total < 0:
            xp_total = 0
        xp_per_level = self.XP_PER_LEVEL
        level = (xp_total // xp_per_level) + 1
        previous_threshold = (level - 1) * xp_per_level
        next_level_threshold = level * xp_per_level
        xp_into_level = xp_total - previous_threshold
        xp_to_next = max(0, next_level_threshold - xp_total)
        progress_percent = round((xp_into_level / xp_per_level) * 100) if xp_per_level else 0
        return {
            "level": level,
            "xp_into_level": xp_into_level,
            "next_level_threshold": next_level_threshold,
            "xp_to_next": xp_to_next,
            "progress_percent": max(0, min(progress_percent, 100)),
        }
