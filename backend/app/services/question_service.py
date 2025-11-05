from datetime import date, datetime
from typing import Dict, Set

from ..config import Settings
from ..models.question import Question
from ..repositories import AnswerRepository, ProgressRepository, QuestionRepository


class QuestionService:
    """Coordinates question selection and supporting metadata."""

    WEEK_TOTAL_DAYS = 7

    def __init__(
        self,
        repository: QuestionRepository,
        progress_repository: ProgressRepository,
        answer_repository: AnswerRepository,
        settings: Settings,
    ) -> None:
        self._repository = repository
        self._progress_repository = progress_repository
        self._answer_repository = answer_repository
        self._settings = settings

    def daily_question(self, for_date: date, user_id: str | None) -> Dict[str, object]:
        question: Question = self._repository.get_daily_question(for_date)
        progress = {"xp_total": 0, "streak": 0}
        if user_id:
            stored = self._progress_repository.fetch(user_id)
            progress = {
                "xp_total": int(stored.get("xp_total", 0)),
                "streak": int(stored.get("streak", 0)),
            }

        previous_feedback: Dict[str, object] | None = None
        if user_id:
            previous_answer = self._answer_repository.latest_before(user_id, for_date)
            if previous_answer and previous_answer.feedback:
                previous_feedback = {
                    "feedback": previous_answer.feedback,
                    "submittedAt": previous_answer.created_at.isoformat(),
                    "questionId": previous_answer.question_id,
                }

        week_progress = {
            "completedDays": 0,
            "totalDays": self.WEEK_TOTAL_DAYS,
            "badgeEarned": False,
        }
        if user_id:
            answers = self._answer_repository.answers_for_week(user_id, question.week_index)
            completed: Set[str] = {stored.question_id for stored in answers}
            week_progress["completedDays"] = min(len(completed), self.WEEK_TOTAL_DAYS)
            week_progress["badgeEarned"] = len(completed) >= self.WEEK_TOTAL_DAYS

        difficulty_meta = self._difficulty_meta(question.day_index)

        response: Dict[str, object] = {
            "id": question.id,
            "prompt": question.prompt,
            "theme": question.theme,
            "weekIndex": question.week_index,
            "dayIndex": question.day_index,
            "availableOn": question.available_on.isoformat(),
            "timerSeconds": self._settings.default_timer_seconds,
            "xpTotal": progress["xp_total"],
            "streak": progress["streak"],
            "difficulty": difficulty_meta,
            "weekProgress": week_progress,
        }
        response["previousFeedback"] = previous_feedback
        return response

    @staticmethod
    def _difficulty_meta(day_index: int) -> Dict[str, object]:
        buckets = [
            (0, 2, "primer", 1.0),
            (3, 4, "deepening", 1.15),
            (5, 6, "mastery", 1.35),
        ]
        for start, end, label, multiplier in buckets:
            if start <= day_index <= end:
                return {
                    "label": label,
                    "score": day_index + 1,
                    "multiplier": multiplier,
                }
        return {
            "label": "primer",
            "score": day_index + 1,
            "multiplier": 1.0,
        }
