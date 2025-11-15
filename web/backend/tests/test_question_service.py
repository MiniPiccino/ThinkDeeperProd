from datetime import date, datetime, timezone

from app.repositories import AnswerRepository, ProgressRepository, StoredAnswer
from app.services import QuestionService


def test_daily_question_payload(question_service: QuestionService) -> None:
    payload = question_service.daily_question(date(2024, 1, 1), user_id="user-1")
    assert payload["prompt"] == "Q1"
    assert payload["theme"] == "Week 1"
    assert payload["streak"] == 0
    assert payload["xpTotal"] == 0
    assert payload["previousFeedback"] is None
    assert payload["difficulty"]["label"] == "primer"
    assert payload["weekProgress"]["completedDays"] == 0
    assert payload["weekProgress"]["totalDays"] == 7
    dopamine = payload["dopamine"]
    assert dopamine["curiosityHook"]  # non-empty string
    assert len(dopamine["challengeModes"]) == 3
    assert dopamine["challengeModes"][0]["unlocked"] is True
    priming = payload["priming"]
    assert priming["emotionalHook"]
    assert "feeling" in priming["emotionalHook"]
    assert priming["teaserQuestion"]


def test_daily_question_reflects_progress(
    question_service: QuestionService,
    progress_repository: ProgressRepository,
) -> None:
    progress_repository.update("user-2", 7, datetime.now(tz=timezone.utc))
    payload = question_service.daily_question(date(2024, 1, 2), user_id="user-2")
    assert payload["streak"] == 1
    assert payload["xpTotal"] == 7
    assert payload["weekProgress"]["completedDays"] == 0
    dopamine = payload["dopamine"]
    reward = dopamine["rewardHighlights"][0]
    assert reward["title"] == "Lifetime XP"
    assert reward["earned"] is True
    priming = payload["priming"]
    assert "streak" not in priming["emotionalHook"].lower()


def test_daily_question_includes_previous_feedback(
    question_service: QuestionService,
    answer_repository: AnswerRepository,
) -> None:
    stored = StoredAnswer(
        user_id="user-3",
        question_id="week-1-day-1",
        answer="Answer text",
        feedback="Consider adding concrete examples tomorrow.",
        xp_awarded=10,
        xp_total=10,
        streak=1,
        created_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        duration_seconds=120,
    )
    answer_repository.save_answer(stored)

    payload = question_service.daily_question(date(2024, 1, 2), user_id="user-3")
    previous = payload["previousFeedback"]
    assert previous is not None
    assert previous["feedback"] == "Consider adding concrete examples tomorrow."
    assert previous["questionId"] == "week-1-day-1"
    assert payload["weekProgress"]["completedDays"] == 1
    dopamine = payload["dopamine"]
    assert any("Carry yesterday's feedback" in item for item in dopamine["curiosityPrompts"])
    priming = payload["priming"]
    assert "yesterday" in priming["emotionalHook"]
