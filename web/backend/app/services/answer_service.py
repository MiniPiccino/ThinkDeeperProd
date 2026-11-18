from datetime import datetime, timezone
import logging
from threading import Lock, RLock
from typing import Callable, Dict, Optional, Set
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from ..models.answer import AnswerResult
from ..repositories import (
    AnswerRepository,
    BadgeRepository,
    ProgressRepository,
    QuestionRepository,
    StoredAnswer,
    StoredBadge,
)
from .evaluation_rate_limiter import EvaluationRateLimiter
from .evaluation_service import EvaluationService, EvaluationUnavailable

logger = logging.getLogger(__name__)


class DuplicateAnswerError(RuntimeError):
    pass


class InvalidDailyQuestionError(RuntimeError):
    pass


class InvalidAnswerError(RuntimeError):
    pass


class AnswerPersistenceError(RuntimeError):
    pass


class AnswerService:
    """Validates, reserves, evaluates once, then finalizes XP and persistence."""

    WEEK_DAYS = 7
    WEEK_COMPLETION_BONUS_XP = 25
    XP_PER_LEVEL = 120
    PARTICIPATION_XP = 10

    def __init__(
        self,
        question_repository: QuestionRepository,
        evaluation_service: EvaluationService,
        answer_repository: AnswerRepository,
        progress_repository: ProgressRepository,
        badge_repository: Optional[BadgeRepository] = None,
        rate_limiter: Optional[EvaluationRateLimiter] = None,
        clock: Callable[[], datetime] = lambda: datetime.now(tz=timezone.utc),
        application_timezone: str = "UTC",
    ) -> None:
        self._question_repository = question_repository
        self._evaluation_service = evaluation_service
        self._answer_repository = answer_repository
        self._progress_repository = progress_repository
        self._badge_repository = badge_repository
        self._rate_limiter = rate_limiter
        self._clock = clock
        try:
            self._application_timezone = ZoneInfo(application_timezone)
        except ZoneInfoNotFoundError as exc:
            raise RuntimeError("Invalid APPLICATION_TIMEZONE") from exc
        self._locks_guard = Lock()
        self._user_locks: dict[str, RLock] = {}

    def submit_answer(
        self, question_id: str, answer: str, user_id: str, duration_seconds: int
    ) -> AnswerResult:
        normalized = answer.strip()
        if not normalized:
            raise InvalidAnswerError("Answer must contain non-whitespace text")
        if len(normalized) > 4000:
            raise InvalidAnswerError("Answer is too long")

        now = self._clock()
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)
        application_date = now.astimezone(self._application_timezone).date()
        today_question = self._question_repository.get_daily_question(application_date)
        if question_id != today_question.id:
            raise InvalidDailyQuestionError("Question is not today's prompt")

        with self._user_lock(user_id):
            if not self._answer_repository.reserve_submission(user_id, question_id):
                raise DuplicateAnswerError(question_id)

            acquired = False
            try:
                if self._rate_limiter:
                    self._rate_limiter.acquire(user_id)
                    acquired = True
                try:
                    evaluation = self._evaluation_service.evaluate(
                        today_question.prompt, normalized
                    )
                except EvaluationUnavailable:
                    evaluation = self._evaluation_service.fallback()
                finally:
                    if acquired:
                        self._rate_limiter.release()

                answers_this_week = self._answer_repository.answers_for_week_instance(
                    user_id, today_question.week_instance_id, today_question.week_index
                )
                answered_ids: Set[str] = {
                    stored.question_id for stored in answers_this_week
                }
                week_completed_days = min(len(answered_ids) + 1, self.WEEK_DAYS)
                difficulty = self._difficulty_meta(today_question.day_index)
                base_xp = self._apply_difficulty(
                    self.PARTICIPATION_XP + evaluation.engagement_bonus,
                    float(difficulty["multiplier"]),
                )
                bonus_xp = (
                    self.WEEK_COMPLETION_BONUS_XP
                    if week_completed_days == self.WEEK_DAYS
                    else 0
                )
                total_awarded = base_xp + bonus_xp
                stored = StoredAnswer(
                    user_id=user_id,
                    question_id=question_id,
                    answer=normalized,
                    feedback=evaluation.feedback,
                    xp_awarded=total_awarded,
                    xp_total=0,
                    streak=0,
                    created_at=now,
                    duration_seconds=min(duration_seconds, 86400),
                    week_index=today_question.week_index,
                    question_instance_id=today_question.id,
                    catalog_question_id=today_question.catalog_id,
                    question_date=today_question.available_on,
                    question_text=today_question.prompt,
                    question_theme=today_question.theme,
                    difficulty_label=str(difficulty["label"]),
                    difficulty_score=today_question.day_index + 1,
                    difficulty_multiplier=float(difficulty["multiplier"]),
                    catalog_version=today_question.catalog_version,
                    week_instance_id=today_question.week_instance_id,
                )

                finalized = self._answer_repository.finalize_submission(stored)
                if finalized is not None:
                    progress = finalized
                else:
                    progress = self._progress_repository.update(
                        user_id, total_awarded, now, activity_date=application_date
                    )
                    stored.xp_total = int(progress["xp_total"])
                    stored.streak = int(progress["streak"])
                    self._answer_repository.save_answer(stored)

                badge_earned = week_completed_days == self.WEEK_DAYS
                badge_name = (
                    self._badge_name(today_question.week_index, today_question.theme)
                    if badge_earned
                    else None
                )
                if badge_earned and self._badge_repository:
                    try:
                        self._badge_repository.record_badge(
                            StoredBadge(
                                id=f"{user_id}-{today_question.week_instance_id}",
                                user_id=user_id,
                                week_index=today_question.week_index,
                                theme=today_question.theme,
                                name=badge_name or "Weekly Insight Badge",
                                earned_at=now,
                                week_instance_id=today_question.week_instance_id,
                            )
                        )
                    except Exception:
                        logger.error(
                            "Weekly badge persistence failed after answer finalization"
                        )
            except DuplicateAnswerError:
                raise
            except Exception as exc:
                try:
                    self._answer_repository.release_submission(user_id, question_id)
                except Exception:
                    pass
                raise AnswerPersistenceError(
                    "Answer submission could not be completed"
                ) from exc

        xp_total = int(progress["xp_total"])
        streak = int(progress["streak"])
        level = self._level_stats(xp_total)
        return AnswerResult(
            feedback=evaluation.feedback,
            xp_awarded=total_awarded,
            base_xp=base_xp,
            bonus_xp=bonus_xp,
            xp_total=xp_total,
            streak=streak,
            difficulty_level=str(difficulty["label"]),
            difficulty_multiplier=float(difficulty["multiplier"]),
            week_completed_days=week_completed_days,
            week_total_days=self.WEEK_DAYS,
            week_badge_earned=badge_earned,
            badge_name=badge_name,
            level=level["level"],
            xp_to_next_level=level["xp_to_next"],
            next_level_threshold=level["next_level_threshold"],
            xp_into_level=level["xp_into_level"],
            level_progress_percent=level["progress_percent"],
        )

    def _user_lock(self, user_id: str) -> RLock:
        with self._locks_guard:
            return self._user_locks.setdefault(user_id, RLock())

    @staticmethod
    def _apply_difficulty(base_xp: int, multiplier: float) -> int:
        return max(1, round(base_xp * multiplier))

    @staticmethod
    def _difficulty_meta(day_index: int) -> Dict[str, object]:
        if day_index >= 5:
            return {"label": "mastery", "multiplier": 1.35}
        if day_index >= 3:
            return {"label": "deepening", "multiplier": 1.15}
        return {"label": "primer", "multiplier": 1.0}

    @staticmethod
    def _badge_name(week_index: int, theme: str) -> str:
        parts = [part.strip() for part in theme.split("—") if part.strip()]
        return f"{parts[-1] if parts else f'Week {week_index + 1}'} Insight Badge"

    def _level_stats(self, xp_total: int) -> Dict[str, int]:
        xp_total = max(0, xp_total)
        level = (xp_total // self.XP_PER_LEVEL) + 1
        previous = (level - 1) * self.XP_PER_LEVEL
        next_threshold = level * self.XP_PER_LEVEL
        into = xp_total - previous
        return {
            "level": level,
            "xp_into_level": into,
            "next_level_threshold": next_threshold,
            "xp_to_next": max(0, next_threshold - xp_total),
            "progress_percent": max(0, min(round(into / self.XP_PER_LEVEL * 100), 100)),
        }
