from datetime import date, datetime, timedelta, timezone

import pytest

from app.repositories import (
    AnswerRepository,
    BadgeRepository,
    ProgressRepository,
    QuestionRepository,
)
from app.services import AnswerService, EvaluationService
from app.services.answer_service import DuplicateAnswerError
from app.services.question_service import QuestionService


def test_application_timezone_boundary(
    question_repository: QuestionRepository,
    progress_repository: ProgressRepository,
    answer_repository: AnswerRepository,
    tmp_settings,
) -> None:
    values = tmp_settings.model_dump(by_alias=True)
    values["APPLICATION_TIMEZONE"] = "Europe/Zagreb"
    service = QuestionService(
        question_repository,
        progress_repository,
        answer_repository,
        type(tmp_settings)(**values),
    )
    assert service.current_application_date(
        datetime(2025, 1, 1, 22, 30, tzinfo=timezone.utc)
    ) == date(2025, 1, 1)
    assert service.current_application_date(
        datetime(2025, 1, 1, 23, 30, tzinfo=timezone.utc)
    ) == date(2025, 1, 2)


def test_year_boundary_streak_week_and_snapshot_integrity(
    question_repository: QuestionRepository,
    evaluation_service: EvaluationService,
    answer_repository: AnswerRepository,
    progress_repository: ProgressRepository,
    badge_repository: BadgeRepository,
) -> None:
    clock = [datetime(2024, 12, 31, 12, tzinfo=timezone.utc)]
    service = AnswerService(
        question_repository,
        evaluation_service,
        answer_repository,
        progress_repository,
        badge_repository,
        clock=lambda: clock[0],
        application_timezone="UTC",
    )
    first_question = question_repository.get_daily_question(date(2024, 12, 31))
    first = service.submit_answer(
        first_question.id, "First year-end reflection", "calendar-user", 30
    )
    clock[0] = datetime(2025, 1, 1, 12, tzinfo=timezone.utc)
    second_question = question_repository.get_daily_question(date(2025, 1, 1))
    second = service.submit_answer(
        second_question.id, "New year reflection", "calendar-user", 30
    )
    assert second.streak == first.streak + 1
    assert second.week_completed_days == 2
    stored = answer_repository.recent_answers("calendar-user")
    assert stored[0].question_text == second_question.prompt
    assert stored[0].question_theme == second_question.theme
    assert stored[0].catalog_version == "test-v1"
    assert stored[0].difficulty_score == 3


def test_same_catalog_slot_in_future_year_is_not_duplicate(
    question_repository: QuestionRepository,
    evaluation_service: EvaluationService,
    answer_repository: AnswerRepository,
    progress_repository: ProgressRepository,
    badge_repository: BadgeRepository,
) -> None:
    clock = [datetime(2024, 1, 1, 12, tzinfo=timezone.utc)]
    service = AnswerService(
        question_repository,
        evaluation_service,
        answer_repository,
        progress_repository,
        badge_repository,
        clock=lambda: clock[0],
    )
    q1 = question_repository.get_daily_question(date(2024, 1, 1))
    service.submit_answer(q1.id, "Year one", "returning-user", 20)
    with pytest.raises(DuplicateAnswerError):
        service.submit_answer(q1.id, "Duplicate", "returning-user", 20)
    clock[0] = datetime(2025, 1, 1, 12, tzinfo=timezone.utc)
    q2 = question_repository.get_daily_question(date(2025, 1, 1))
    result = service.submit_answer(q2.id, "Year two", "returning-user", 20)
    assert q1.id != q2.id
    assert result.xp_total > 0


def test_week_completion_bonus_crosses_year_boundary(
    question_repository: QuestionRepository,
    evaluation_service: EvaluationService,
    answer_repository: AnswerRepository,
    progress_repository: ProgressRepository,
    badge_repository: BadgeRepository,
) -> None:
    clock = [datetime(2025, 12, 29, 12, tzinfo=timezone.utc)]
    service = AnswerService(
        question_repository, evaluation_service, answer_repository, progress_repository,
        badge_repository, clock=lambda: clock[0],
    )
    results = []
    for offset in range(7):
        current = date(2025, 12, 29) + timedelta(days=offset)
        clock[0] = datetime(current.year, current.month, current.day, 12, tzinfo=timezone.utc)
        question = question_repository.get_daily_question(current)
        results.append(service.submit_answer(question.id, f"Day {offset}", "bonus-user", 10))
    assert results[-1].week_completed_days == 7
    assert results[-1].bonus_xp == AnswerService.WEEK_COMPLETION_BONUS_XP
    assert results[-1].streak == 7


def test_monday_and_sunday_difficulty_remains_ordered(
    question_service: QuestionService,
) -> None:
    monday = question_service.daily_question(date(2025, 12, 29), None)
    sunday = question_service.daily_question(date(2026, 1, 4), None)
    assert monday["difficulty"]["label"] == "primer"
    assert sunday["difficulty"]["label"] == "mastery"
    assert monday["difficulty"]["multiplier"] < sunday["difficulty"]["multiplier"]


def test_legacy_answer_remains_readable_and_week_compatible(
    question_service: QuestionService,
    answer_repository: AnswerRepository,
) -> None:
    from app.repositories import StoredAnswer

    answer_repository.save_answer(
        StoredAnswer(
            user_id="legacy",
            question_id="week-1-day-1",
            answer="Legacy",
            feedback="Stored",
            xp_awarded=10,
            xp_total=10,
            streak=1,
            created_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
            duration_seconds=30,
            week_index=0,
        )
    )
    payload = question_service.daily_question(date(2024, 1, 2), "legacy")
    assert payload["previousFeedback"]["questionId"] == "week-1-day-1"
    assert payload["weekProgress"]["completedDays"] == 1
