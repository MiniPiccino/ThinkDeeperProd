from datetime import datetime, timedelta, timezone

from app.repositories import ProgressRepository


def test_progress_first_entry(progress_repository: ProgressRepository) -> None:
    now = datetime.now(tz=timezone.utc)
    result = progress_repository.update("user-1", 10, now)
    assert result["xp_total"] == 10
    assert result["streak"] == 1


def test_progress_streak_increment(progress_repository: ProgressRepository) -> None:
    first = datetime.now(tz=timezone.utc)
    progress_repository.update("user-2", 5, first)

    second = first + timedelta(days=1, minutes=1)
    result = progress_repository.update("user-2", 5, second)

    assert result["xp_total"] == 10
    assert result["streak"] == 2


def test_progress_streak_resets_after_gap(progress_repository: ProgressRepository) -> None:
    first = datetime.now(tz=timezone.utc)
    progress_repository.update("user-3", 5, first)

    third_day = first + timedelta(days=3)
    result = progress_repository.update("user-3", 10, third_day)

    assert result["xp_total"] == 15
    assert result["streak"] == 1


def test_progress_recovers_only_with_consecutive_days(progress_repository: ProgressRepository) -> None:
    first = datetime.now(tz=timezone.utc)
    progress_repository.update("user-4", 5, first)

    missed = first + timedelta(days=3)
    progress_repository.update("user-4", 5, missed)

    comeback = missed + timedelta(days=1)
    result = progress_repository.update("user-4", 5, comeback)

    assert result["streak"] == 2


def test_progress_handles_invalid_last_answered(progress_repository: ProgressRepository) -> None:
    # Manually seed an invalid date to ensure we recover without raising.
    progress_repository._write(  # type: ignore[attr-defined]
        {
            "user-5": {
                "xp_total": 20,
                "streak": 7,
                "last_answered_on": "not-a-date",
            }
        }
    )

    now = datetime.now(tz=timezone.utc)
    result = progress_repository.update("user-5", 5, now)

    assert result["xp_total"] == 25
    assert result["streak"] == 1
