import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from ..integrations.supabase_client import SupabaseClient


class EntitlementStoreUnavailable(RuntimeError):
    """Raised when the configured entitlement source cannot be read safely."""


@dataclass(frozen=True, slots=True)
class EntitlementRecord:
    plan: str
    status: str
    expires_at: datetime | None
    source: str | None
    legacy: bool = False

    def is_active(self, now: datetime | None = None) -> bool:
        if self.plan != "premium" or self.status not in {"active", "trialing", "past_due", "legacy"}:
            return False
        current = now or datetime.now(timezone.utc)
        return self.expires_at is None or self.expires_at > current


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
        entitlement = self.get_entitlement(user_id)
        return "premium" if entitlement.is_active() else "free"

    def get_entitlement(self, user_id: str) -> EntitlementRecord:
        """Read entitlement state without falling back across storage backends.

        A configured Supabase table is the source of truth. If it is unavailable,
        authorization must fail closed instead of consulting a potentially stale
        local file.
        """
        if self._supabase:
            try:
                rows = self._supabase.select(
                    self._supabase_table,
                    filters={"user_id": user_id},
                    limit=1,
                )
            except RuntimeError as exc:
                raise EntitlementStoreUnavailable("Entitlement source is unavailable.") from exc
            record: dict[str, Any] = rows[0] if rows else {}
        else:
            record = self._read_entitlements().get(user_id, {})
        if not isinstance(record, dict):
            raise EntitlementStoreUnavailable("Entitlement record has an invalid format.")
        return self._parse_entitlement(record)

    def set_plan(self, user_id: str, plan: str) -> None:
        normalized = str(plan).lower()
        if normalized not in {"free", "premium"}:
            raise ValueError("Plan must be either 'free' or 'premium'.")
        if self._supabase:
            try:
                self._supabase.upsert(
                    self._supabase_table,
                    {"user_id": user_id, "plan": normalized},
                    conflict_column="user_id",
                )
                return
            except RuntimeError as exc:
                raise EntitlementStoreUnavailable("Entitlement source is unavailable.") from exc

        data = self._read_entitlements()
        existing = data.get(user_id, {})
        if not isinstance(existing, dict):
            raise EntitlementStoreUnavailable("Entitlement record has an invalid format.")
        record = dict(existing)
        record["plan"] = normalized
        data[user_id] = record
        self._write(data)

    def is_premium(self, user_id: str) -> bool:
        return self.get_entitlement(user_id).is_active()

    def _read_entitlements(self) -> Dict[str, Dict[str, Any]]:
        if not self._storage_path.exists():
            return {}
        try:
            with self._storage_path.open("r", encoding="utf-8") as handle:
                data = json.load(handle)
        except (OSError, json.JSONDecodeError) as exc:
            raise EntitlementStoreUnavailable("Entitlement source is unavailable.") from exc
        if not isinstance(data, dict):
            raise EntitlementStoreUnavailable("Entitlement source has an invalid format.")
        return data

    def _parse_entitlement(self, record: dict[str, Any]) -> EntitlementRecord:
        plan = str(record.get("plan", self._default_plan)).lower()
        if plan not in {"free", "premium"}:
            return EntitlementRecord(plan="free", status="invalid", expires_at=None, source=None)

        raw_status = record.get("status")
        legacy = plan == "premium" and raw_status is None
        status = str(raw_status).lower() if raw_status is not None else ("legacy" if legacy else "inactive")
        expires_at = self._parse_expiry(record.get("expires_at") or record.get("expiresAt"))
        source = record.get("source")
        return EntitlementRecord(
            plan=plan,
            status=status,
            expires_at=expires_at,
            source=str(source) if source else None,
            legacy=legacy,
        )

    @staticmethod
    def _parse_expiry(value: Any) -> datetime | None:
        if value is None or value == "":
            return None
        if not isinstance(value, str):
            raise EntitlementStoreUnavailable("Entitlement expiry has an invalid format.")
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise EntitlementStoreUnavailable("Entitlement expiry has an invalid format.") from exc
        if parsed.tzinfo is None:
            raise EntitlementStoreUnavailable("Entitlement expiry must include a timezone.")
        return parsed.astimezone(timezone.utc)

    def _write(self, data: Dict[str, Dict[str, Any]]) -> None:
        with self._storage_path.open("w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
