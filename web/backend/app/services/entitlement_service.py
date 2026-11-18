from __future__ import annotations

from dataclasses import dataclass

from ..repositories.user_repository import EntitlementRecord, EntitlementStoreUnavailable, UserRepository


@dataclass(frozen=True, slots=True)
class PremiumAccess:
    user_id: str
    entitlement: EntitlementRecord


class EntitlementService:
    """Central policy for server-side premium capability decisions."""

    def __init__(self, user_repository: UserRepository) -> None:
        self._users = user_repository

    def entitlement_for(self, user_id: str) -> EntitlementRecord:
        return self._users.get_entitlement(user_id)

    def display_entitlement_for(self, user_id: str) -> EntitlementRecord:
        """Return free UI capabilities when entitlement state cannot be verified."""
        try:
            return self.entitlement_for(user_id)
        except EntitlementStoreUnavailable:
            return EntitlementRecord(plan="free", status="unavailable", expires_at=None, source=None)

    def premium_access_for(self, user_id: str) -> PremiumAccess | None:
        entitlement = self.entitlement_for(user_id)
        if not entitlement.is_active():
            return None
        return PremiumAccess(user_id=user_id, entitlement=entitlement)
