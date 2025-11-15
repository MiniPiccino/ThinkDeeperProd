from datetime import date

import pytest

from app.repositories import QuestionRepository


def test_get_daily_question_cycles(question_repository: QuestionRepository) -> None:
    first = question_repository.get_daily_question(date(2024, 1, 1))
    second = question_repository.get_daily_question(date(2024, 1, 2))
    third = question_repository.get_daily_question(date(2024, 1, 3))
    eighth = question_repository.get_daily_question(date(2024, 1, 8))

    assert first.prompt == "Q1"
    assert second.prompt == "Q2"
    assert third.prompt == "Q3"
    # 8th day should wrap back to start after seven prompts
    assert eighth.prompt == "Q1"


def test_get_by_id(question_repository: QuestionRepository) -> None:
    question = question_repository.get_by_id("week-1-day-2")
    assert question.prompt == "Q2"


def test_get_by_id_invalid(question_repository: QuestionRepository) -> None:
    with pytest.raises(KeyError):
        question_repository.get_by_id("missing-question")


def test_questions_align_to_monday_weeks(question_repository: QuestionRepository) -> None:
    # Jan 1, 2025 lands on Wednesday, so it should be the third prompt of the first week.
    jan_first = question_repository.get_daily_question(date(2025, 1, 1))
    assert jan_first.prompt == "Q3"
