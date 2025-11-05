import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional


class ProgressRepository:
    """Persists lightweight user progress metrics in JSON form."""

    def __init__(self, storage_path: Path) -> None:
        self._storage_path = storage_path
        self._storage_path.parent.mkdir(parents=True, exist_ok=True)

    def fetch(self, user_id: str) -> Dict[str, int | str]:
        data = self._read()
        return data.get(
            user_id,
            {
                "xp_total": 0,
                "streak": 0,
                "last_answered_on": None,
            },
        )

    def update(self, user_id: str, xp_awarded: int, submitted_at: datetime) -> Dict[str, int | str]:
        data = self._read()
        existing = data.get(
            user_id,
            {"xp_total": 0, "streak": 0, "last_answered_on": None},
        )
        xp_total = int(existing.get("xp_total", 0)) + xp_awarded

        last_answered_on = existing.get("last_answered_on")
        streak = int(existing.get("streak", 0))

        today = submitted_at.date()
        if last_answered_on:
            last_date = datetime.fromisoformat(last_answered_on).date()
            if (today - last_date).days == 1:
                streak += 1
            elif (today - last_date).days == 0:
                # same day submission does not break streak
                streak = max(streak, 1)
            else:
                streak = 1
        else:
            streak = 1

        updated = {
            "xp_total": xp_total,
            "streak": streak,
            "last_answered_on": submitted_at.isoformat(),
        }
        data[user_id] = updated
        self._write(data)
        return updated

    def _read(self) -> Dict[str, Dict[str, Optional[int | str]]]:
        if not self._storage_path.exists():
            return {}
        with self._storage_path.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    def _write(self, data: Dict[str, Dict[str, int | str]]) -> None:
        with self._storage_path.open("w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
