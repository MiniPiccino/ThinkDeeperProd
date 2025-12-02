import json
import logging
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..integrations.supabase_client import SupabaseClient

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class StoredBadge:
    id: str
    user_id: str
    week_index: int
    theme: str
    name: str
    earned_at: datetime


class BadgeRepository:
    """Persists earned badges per user with Supabase or JSON fallback."""

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

    def record_badge(self, badge: StoredBadge) -> None:
        """Upsert a badge for a user/week."""
        record: Dict[str, Any] = {
            **asdict(badge),
            "earned_at": badge.earned_at.isoformat(),
        }
        if self._supabase:
            try:
                self._supabase.upsert(
                    self._supabase_table,
                    record,
                    conflict_column="id",
                )
                return
            except RuntimeError as exc:
                logger.warning("Supabase badge upsert failed; falling back to file store: %s", exc)
                self._disable_supabase()

        data = self._read()
        user_badges = data.get(badge.user_id, [])
        user_badges = [item for item in user_badges if item.get("id") != badge.id]
        user_badges.append(record)
        data[badge.user_id] = user_badges
        self._write(data)

    def list_badges(self, user_id: str) -> List[StoredBadge]:
        if self._supabase:
            try:
                rows = self._supabase.select(
                    self._supabase_table,
                    filters={"user_id": user_id},
                    order=("week_index", "asc"),
                )
                return [badge for badge in (self._from_record(row) for row in rows) if badge]
            except RuntimeError as exc:
                logger.warning("Supabase badge list failed; falling back to file store: %s", exc)
                self._disable_supabase()

        data = self._read()
        badges = data.get(user_id, [])
        return [
            badge
            for badge in (self._from_record(item) for item in badges)
            if badge is not None
        ]

    def _read(self) -> Dict[str, List[Dict[str, Any]]]:
        if not self._storage_path.exists():
            return {}
        with self._storage_path.open("r", encoding="utf-8") as handle:
            try:
                return json.load(handle)
            except json.JSONDecodeError:
                return {}

    def _write(self, data: Dict[str, List[Dict[str, Any]]]) -> None:
        with self._storage_path.open("w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)

    def _disable_supabase(self) -> None:
        self._supabase = None
        self._supabase_table = None

    @staticmethod
    def _from_record(record: Dict[str, Any]) -> Optional[StoredBadge]:
        try:
            earned_at_raw = record.get("earned_at")
            earned_at = (
                datetime.fromisoformat(earned_at_raw)
                if isinstance(earned_at_raw, str)
                else datetime.now(timezone.utc)
            )
            return StoredBadge(
                id=str(record.get("id")),
                user_id=str(record.get("user_id")),
                week_index=int(record.get("week_index", 0)),
                theme=str(record.get("theme", "")),
                name=str(record.get("name", "")),
                earned_at=earned_at,
            )
        except Exception:
            return None
