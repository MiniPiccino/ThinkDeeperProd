from __future__ import annotations

from datetime import datetime, timezone
from typing import List

from ..models.badge import Badge
from ..repositories import BadgeRepository, StoredBadge


class BadgeService:
    """Handles badge persistence and retrieval."""

    def __init__(self, repository: BadgeRepository) -> None:
        self._repository = repository

    def award_weekly_badge(self, *, user_id: str, week_index: int, theme: str, name: str) -> None:
        record = StoredBadge(
            id=f"{user_id}-week-{week_index}",
            user_id=user_id,
            week_index=week_index,
            theme=theme,
            name=name,
            earned_at=datetime.now(timezone.utc),
        )
        self._repository.record_badge(record)

    def list_badges(self, user_id: str) -> List[Badge]:
        stored = self._repository.list_badges(user_id)
        return [Badge.model_validate(badge, from_attributes=True) for badge in stored]
