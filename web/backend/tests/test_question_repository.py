from datetime import date

import pytest

from app.repositories import QuestionRepository


def test_dated_instance_is_distinct_from_catalog_id(
    question_repository: QuestionRepository,
) -> None:
    question = question_repository.get_daily_question(date(2024, 1, 1))
    assert question.id == "question:2024-01-01"
    assert question.catalog_id == "week-1-day-1"
    assert question.week_instance_id == "week:2024-01-01"


def test_monday_to_sunday_progression(question_repository: QuestionRepository) -> None:
    week = [
        question_repository.get_daily_question(date(2024, 1, day))
        for day in range(1, 8)
    ]
    assert [item.day_index for item in week] == list(range(7))
    assert [item.catalog_id for item in week] == [
        f"week-1-day-{day}" for day in range(1, 8)
    ]


def test_year_boundary_and_two_years_do_not_reuse_instances(
    question_repository: QuestionRepository,
) -> None:
    dec31 = question_repository.get_daily_question(date(2024, 12, 31))
    jan1 = question_repository.get_daily_question(date(2025, 1, 1))
    next_year = question_repository.get_daily_question(date(2026, 1, 1))
    assert dec31.week_instance_id == jan1.week_instance_id
    assert len({dec31.id, jan1.id, next_year.id}) == 3
    assert jan1.day_index == 2


def test_leap_day_has_unique_instance(question_repository: QuestionRepository) -> None:
    leap = question_repository.get_daily_question(date(2024, 2, 29))
    following = question_repository.get_daily_question(date(2024, 3, 1))
    assert leap.id != following.id
    assert leap.day_index == 3
    assert following.day_index == 4


def test_iso_week_53_uses_documented_overflow_rotation(
    question_repository: QuestionRepository,
) -> None:
    week53 = question_repository.get_daily_question(date(2026, 12, 28))
    following = question_repository.get_daily_question(date(2027, 1, 4))
    assert week53.week_instance_id == "week:2026-12-28"
    assert following.week_instance_id == "week:2027-01-04"
    assert week53.catalog_id != following.catalog_id


def test_get_by_catalog_and_instance_id(
    question_repository: QuestionRepository,
) -> None:
    catalog = question_repository.get_by_id("week-1-day-2")
    instance = question_repository.get_by_id("question:2024-01-02")
    assert catalog.catalog_id == "week-1-day-2"
    assert instance.catalog_id == "week-1-day-2"


def test_get_by_id_invalid(question_repository: QuestionRepository) -> None:
    with pytest.raises(KeyError):
        question_repository.get_by_id("missing-question")
