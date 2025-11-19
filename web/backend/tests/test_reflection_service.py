from datetime import datetime, timedelta, timezone

from app.repositories import StoredAnswer, AnswerRepository, UserRepository
from app.services import ReflectionService
from app.repositories import QuestionRepository


def _store_answer(repo: AnswerRepository, *, user_id: str, question_id: str, answer: str, days_ago: int = 0) -> None:
    now = datetime.now(tz=timezone.utc) - timedelta(days=days_ago)
    repo.save_answer(
        StoredAnswer(
            user_id=user_id,
            question_id=question_id,
            answer=answer,
            feedback="Keep going",
            xp_awarded=10,
            xp_total=10,
            streak=days_ago + 1,
            created_at=now,
            duration_seconds=120,
            week_index=0,
        )
    )


def test_reflection_overview_for_free_user(
    reflection_service: ReflectionService,
    answer_repository: AnswerRepository,
    question_repository: QuestionRepository,
    user_repository: UserRepository,
) -> None:
    user_id = "user-free"
    user_repository.set_plan(user_id, "free")
    question = question_repository.get_by_id("week-1-day-1")
    _store_answer(
        answer_repository,
        user_id=user_id,
        question_id=question.id,
        answer="Today I learned to slow down.",
        days_ago=0,
    )

    overview = reflection_service.overview(user_id, tz_offset_minutes=-120)

    assert overview.plan == "free"
    assert overview.today is not None
    assert overview.today_locked is False
    assert overview.timeline_unlocked is False
    assert overview.week[0].weekday


def test_reflection_overview_marks_premium_and_teasers(
    reflection_service: ReflectionService,
    answer_repository: AnswerRepository,
    question_repository: QuestionRepository,
    user_repository: UserRepository,
) -> None:
    user_id = "user-premium"
    user_repository.set_plan(user_id, "premium")
    question = question_repository.get_by_id("week-1-day-1")
    for days_ago in range(0, 10):
        _store_answer(
            answer_repository,
            user_id=user_id,
            question_id=question.id,
            answer=f"Reflection entry {days_ago}",
            days_ago=days_ago,
        )

    overview = reflection_service.overview(user_id, tz_offset_minutes=0)

    assert overview.plan == "premium"
    assert overview.timeline_unlocked is True
    assert overview.teasers == []
    assert len(overview.week) == 7
