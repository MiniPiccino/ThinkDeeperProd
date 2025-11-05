from app.models.answer import AnswerResult
from app.services import AnswerService


def test_answer_submission_persists(answer_service: AnswerService) -> None:
    result = answer_service.submit_answer(
        question_id="week-1-day-1",
        answer="My thoughtful reflection.",
        user_id="tester",
        duration_seconds=180,
    )

    assert isinstance(result, AnswerResult)
    assert result.feedback.startswith("Tight")
    assert result.xp_awarded == 12
    assert result.xp_total == 12
    assert result.streak == 1
    assert result.base_xp == 12
    assert result.bonus_xp == 0
    assert result.difficulty_level == "primer"
    assert result.week_completed_days == 1
    assert result.week_total_days == 7
    assert result.week_badge_earned is False
    assert result.level == 1
    assert result.level_progress_percent == 10


def test_multiple_answers_accumulate(answer_service: AnswerService) -> None:
    answer_service.submit_answer(
        question_id="week-1-day-1",
        answer="First answer",
        user_id="tester-2",
        duration_seconds=120,
    )
    second = answer_service.submit_answer(
        question_id="week-1-day-2",
        answer="Second answer",
        user_id="tester-2",
        duration_seconds=240,
    )

    assert second.xp_total == 24
    assert second.streak >= 1
    assert second.week_completed_days == 2


def test_week_completion_triggers_bonus(answer_service: AnswerService) -> None:
    user = "badge-hunter"
    for day in range(1, 7):
        answer_service.submit_answer(
            question_id=f"week-1-day-{day}",
            answer=f"Day {day}",
            user_id=user,
            duration_seconds=180,
        )

    final = answer_service.submit_answer(
        question_id="week-1-day-7",
        answer="Final push",
        user_id=user,
        duration_seconds=200,
    )

    assert final.week_badge_earned is True
    assert final.bonus_xp == answer_service.WEEK_COMPLETION_BONUS_XP
    assert final.week_completed_days == 7
