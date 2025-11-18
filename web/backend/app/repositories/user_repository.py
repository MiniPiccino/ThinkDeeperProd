import json
from pathlib import Path
from typing import Dict


class UserRepository:
    """Stores lightweight user metadata such as plan type."""

    def __init__(self, storage_path: Path, default_plan: str = "free") -> None:
        self._storage_path = storage_path
        self._storage_path.parent.mkdir(parents=True, exist_ok=True)
        self._default_plan = default_plan

    def get_plan(self, user_id: str) -> str:
        data = self._read()
        record = data.get(user_id)
        plan = (record or {}).get("plan", self._default_plan)
        return str(plan).lower()

    def set_plan(self, user_id: str, plan: str) -> None:
        data = self._read()
        normalized = str(plan).lower()
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
