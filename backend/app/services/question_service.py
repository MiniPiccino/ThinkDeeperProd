from datetime import date, datetime, timedelta
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
        priming = self._priming_meta(
            question=question,
            progress=progress,
            previous_feedback=previous_feedback,
            difficulty=difficulty_meta,
        )
        dopamine = self._dopamine_meta(
            question=question,
            progress=progress,
            week_progress=week_progress,
            previous_feedback=previous_feedback,
            difficulty=difficulty_meta,
        )
        response["priming"] = priming
        response["dopamine"] = dopamine
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

    def _priming_meta(
        self,
        question: Question,
        progress: Dict[str, int],
        previous_feedback: Dict[str, object] | None,
        difficulty: Dict[str, object],
    ) -> Dict[str, object]:
        streak = int(progress.get("streak", 0))
        difficulty_label = str(difficulty.get("label", "primer")).lower()
        prompt_focus = question.prompt.strip()
        emotional_hook = (
            "Before unlocking the prompt, imagine how today's question might challenge your beliefs and notice the first feeling that surfaces."
        )
        if streak >= 3:
            emotional_hook = (
                f'You are on a {streak}-day streak. Let today\'s question brush past your thoughts and feel the first pulse of emotion—ride that wave into the session.'
            )

        if previous_feedback and previous_feedback.get("feedback"):
            emotional_hook += " Bring yesterday's takeaway to mind so the feeling anchors to something concrete."

        teaser_question = "What does that feeling want to ask before your rational mind edits it?"

        somatic_cue = (
            "Take one 4-6 breathing cycle (inhale 4, exhale 6) and name the feeling out loud before you start."
        )
        if difficulty_label == "mastery":
            somatic_cue = (
                "Try a 4-7-8 breath, then consciously relax your shoulders; mastery mode needs a settled body."
            )

        cognitive_bridge = "When the prompt unlocks, turn the feeling into one bold claim you can test."

        return {
            "emotionalHook": emotional_hook,
            "teaserQuestion": teaser_question,
            "somaticCue": somatic_cue,
            "cognitiveCue": cognitive_bridge,
        }

    def _dopamine_meta(
        self,
        question: Question,
        progress: Dict[str, int],
        week_progress: Dict[str, int | bool],
        previous_feedback: Dict[str, object] | None,
        difficulty: Dict[str, object],
    ) -> Dict[str, object]:
        streak = int(progress.get("streak", 0))
        xp_total = int(progress.get("xp_total", 0))
        total_days = int(week_progress.get("totalDays", self.WEEK_TOTAL_DAYS))
        completed_days = int(week_progress.get("completedDays", 0))

        curiosity_prompts = [
            f"You are on day {question.day_index + 1} of this week's deep work arc.",
            f"Theme spotlight: {question.theme}. Notice the angle that surprises you.",
        ]
        if previous_feedback and previous_feedback.get("feedback"):
            curiosity_prompts.append("Carry yesterday's feedback forward: stay mindful of the insight you unlocked.")

        curiosity_hook = (
            f"Prime your curiosity around {question.theme.lower()}. Look for the assumption you usually skip."
        )

        challenge_modes = [
            {
                "label": "Primer flow",
                "description": "Open with gentle focus to warm up. Ideal when you are rebuilding momentum.",
                "multiplier": 1.0,
                "unlocked": True,
            },
            {
                "label": "Deepening",
                "description": "Lean into nuance and contrast ideas to unlock richer feedback loops.",
                "multiplier": 1.15,
                "unlocked": question.day_index >= 2 or streak >= 1,
            },
            {
                "label": "Mastery",
                "description": "Choose the toughest variant and defend your reasoning under pressure.",
                "multiplier": 1.35,
                "unlocked": question.day_index >= 4 or streak >= 3,
            },
        ]

        remaining_sessions = max(total_days - completed_days, 0)
        reward_highlights = [
            {
                "title": "Lifetime XP",
                "description": f"{xp_total} total XP collected so far.",
                "earned": xp_total > 0,
            },
            {
                "title": "Active streak",
                "description": f"{streak} day streak alive." if streak > 0 else "Start today to build your streak momentum.",
                "earned": streak > 0,
            },
            {
                "title": "Weekly badge",
                "description": (
                    "Badge secured for finishing the arc."
                    if week_progress.get("badgeEarned")
                    else f"{remaining_sessions} session(s) left before this week's badge unlocks."
                ),
                "earned": bool(week_progress.get("badgeEarned")),
            },
        ]

        anticipate_teaser = (
            "Tomorrow extends this thread - show up ready to test whether your reflection still holds."
        )
        next_prompt_time = question.available_on + timedelta(days=1)

        return {
            "curiosityHook": curiosity_hook,
            "curiosityPrompts": curiosity_prompts,
            "challengeModes": challenge_modes,
            "rewardHighlights": reward_highlights,
            "anticipationTeaser": anticipate_teaser,
            "nextPromptAvailableAt": datetime.combine(next_prompt_time, datetime.min.time(), tzinfo=None).isoformat(),
            "activeDifficulty": difficulty.get("label"),
        }
