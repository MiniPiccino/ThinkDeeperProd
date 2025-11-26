import json
import logging
from pathlib import Path
from typing import Dict, Optional

from ..integrations.supabase_client import SupabaseClient

logger = logging.getLogger(__name__)


class UserRepository:
    """Stores lightweight user metadata such as plan type."""

    def __init__(
        self,
        storage_path: Path,
        default_plan: str = "free",
        supabase_client: Optional[SupabaseClient] = None,
        supabase_table: Optional[str] = None,
    ) -> None:
        self._storage_path = storage_path
        self._storage_path.parent.mkdir(parents=True, exist_ok=True)
        self._default_plan = default_plan
        self._supabase = supabase_client if supabase_client and supabase_table else None
        self._supabase_table = supabase_table

    def get_plan(self, user_id: str) -> str:
        if self._supabase:
            try:
                rows = self._supabase.select(
                    self._supabase_table,
                    filters={"user_id": user_id},
                    limit=1,
                )
                if rows:
                    plan = rows[0].get("plan", self._default_plan)
                    return str(plan).lower()
            except RuntimeError as exc:
                logger.warning("Supabase user_plan fetch failed; falling back to file store: %s", exc)
                self._disable_supabase()

        data = self._read()
        record = data.get(user_id)
        plan = (record or {}).get("plan", self._default_plan)
        return str(plan).lower()

    def set_plan(self, user_id: str, plan: str) -> None:
        normalized = str(plan).lower()
        if self._supabase:
            try:
                self._supabase.upsert(
                    self._supabase_table,
                    {"user_id": user_id, "plan": normalized},
                    conflict_column="user_id",
                )
                return
            except RuntimeError as exc:
                logger.warning("Supabase user_plan upsert failed; falling back to file store: %s", exc)
                self._disable_supabase()

        data = self._read()
        data[user_id] = {"plan": normalized}
        self._write(data)

    def is_premium(self, user_id: str) -> bool:
        return self.get_plan(user_id) == "premium"

    def _read(self) -> Dict[str, Dict[str, str]]:
        if not self._storage_path.exists():
            return {}
        with self._storage_path.open("r", encoding="utf-8") as handle:
            try:
                return json.load(handle)
            except json.JSONDecodeError:
                return {}

    def _write(self, data: Dict[str, Dict[str, str]]) -> None:
        with self._storage_path.open("w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)

    def _disable_supabase(self) -> None:
        self._supabase = None
        self._supabase_table = None
