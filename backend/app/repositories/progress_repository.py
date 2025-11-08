import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

from ..integrations.supabase_client import SupabaseClient

logger = logging.getLogger(__name__)


class ProgressRepository:
    """Persists lightweight user progress metrics in JSON or Supabase."""

    def __init__(
        self,
        storage_path: Path,
        supabase_client: Optional[SupabaseClient] = None,
        supabase_table: Optional[str] = None,
    ) -> None:
        self._storage_path = storage_path
        self._storage_path.parent.mkdir(parents=True, exist_ok=True)
        self._supabase = supabase_client if supabase_client and supabase_table else None
        self._supabase_table = supabase_table

    def fetch(self, user_id: str) -> Dict[str, int | str]:
        if self._supabase:
            try:
                rows = self._supabase.select(
                    self._supabase_table,
                    filters={"user_id": user_id},
                    limit=1,
                )
                if rows:
                    row = rows[0]
                    return {
                        "xp_total": int(row.get("xp_total", 0)),
                        "streak": int(row.get("streak", 0)),
                        "last_answered_on": row.get("last_answered_on"),
                    }
                return {"xp_total": 0, "streak": 0, "last_answered_on": None}
            except RuntimeError as exc:
                logger.warning("Supabase fetch failed; falling back to file store: %s", exc)
                self._disable_supabase()

        data = self._read()
        return data.get(user_id, {"xp_total": 0, "streak": 0, "last_answered_on": None})

    def update(self, user_id: str, xp_awarded: int, submitted_at: datetime) -> Dict[str, int | str]:
        if self._supabase:
            existing = self.fetch(user_id)
        else:
            data = self._read()
            existing = data.get(user_id, {"xp_total": 0, "streak": 0, "last_answered_on": None})

        xp_total = int(existing.get("xp_total", 0) or 0) + xp_awarded

        last_answered_on = existing.get("last_answered_on")
        streak = int(existing.get("streak", 0) or 0)

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

        if self._supabase:
            try:
                record = {"user_id": user_id, **updated}
                self._supabase.upsert(self._supabase_table, record, conflict_column="user_id")
                return updated
            except RuntimeError as exc:
                logger.warning("Supabase upsert failed; falling back to file store: %s", exc)
                self._disable_supabase()

        data = self._read()
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

    def _disable_supabase(self) -> None:
        self._supabase = None
        self._supabase_table = None
