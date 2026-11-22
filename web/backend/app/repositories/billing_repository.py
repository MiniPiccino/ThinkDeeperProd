from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any, Protocol

from ..integrations.supabase_client import SupabaseClient


class BillingStoreUnavailable(RuntimeError):
    """Raised when durable billing state cannot be read or updated."""


class BillingOwnershipError(RuntimeError):
    """Raised when Paddle identifiers conflict with an existing user mapping."""


@dataclass(frozen=True, slots=True)
class CheckoutCorrelation:
    correlation_id: str
    user_id: str
    price_id: str
    paddle_transaction_id: str | None
    status: str
    expires_at: datetime


@dataclass(frozen=True, slots=True)
class CheckoutReservation:
    status: str
    correlation: CheckoutCorrelation | None = None
    subscription_id: str | None = None


@dataclass(frozen=True, slots=True)
class PaddleEventMutation:
    event_id: str
    notification_id: str
    event_type: str
    occurred_at: datetime
    payload_sha256: str
    subscription_id: str | None = None
    transaction_id: str | None = None
    customer_id: str | None = None
    correlation_id: str | None = None
    subscription_status: str | None = None
    price_id: str | None = None
    current_period_start: datetime | None = None
    current_period_end: datetime | None = None
    scheduled_change_action: str | None = None
    scheduled_change_at: datetime | None = None
    adjustment_action: str | None = None
    adjustment_type: str | None = None
    adjustment_status: str | None = None

    def as_rpc_payload(self, past_due_grace_days: int) -> dict[str, Any]:
        values = asdict(self)
        for key, value in list(values.items()):
            if isinstance(value, datetime):
                values[key] = value.isoformat()
        values["past_due_grace_days"] = past_due_grace_days
        return {"p_event": values}


@dataclass(frozen=True, slots=True)
class EventProcessingResult:
    status: str
    user_id: str | None = None
    reason: str | None = None


@dataclass(frozen=True, slots=True)
class LocalSubscription:
    subscription_id: str
    user_id: str
    status: str
    last_event_at: datetime


class BillingRepository(Protocol):
    def reserve_checkout(self, correlation: CheckoutCorrelation) -> CheckoutReservation: ...

    def link_checkout_transaction(self, correlation_id: str, transaction_id: str) -> None: ...

    def get_checkout_by_transaction(self, transaction_id: str) -> CheckoutCorrelation | None: ...

    def process_event(
        self,
        mutation: PaddleEventMutation,
        *,
        past_due_grace_days: int,
    ) -> EventProcessingResult: ...

    def list_subscriptions(self) -> list[LocalSubscription]: ...


class SupabaseBillingRepository:
    """Durable billing store backed by PostgreSQL through Supabase PostgREST."""

    CHECKOUT_TABLE = "billing_checkout_correlations"
    RESERVE_CHECKOUT_RPC = "reserve_paddle_checkout"
    PROCESS_EVENT_RPC = "process_paddle_billing_event"

    def __init__(self, client: SupabaseClient) -> None:
        self._client = client

    def reserve_checkout(self, correlation: CheckoutCorrelation) -> CheckoutReservation:
        try:
            response = self._client.rpc(
                self.RESERVE_CHECKOUT_RPC,
                {
                    "p_user_id": correlation.user_id,
                    "p_price_id": correlation.price_id,
                    "p_correlation_id": correlation.correlation_id,
                    "p_expires_at": correlation.expires_at.isoformat(),
                },
            )
        except RuntimeError as exc:
            raise BillingStoreUnavailable("Billing state is unavailable.") from exc
        if isinstance(response, list):
            response = response[0] if response else None
        if not isinstance(response, dict) or not isinstance(response.get("status"), str):
            raise BillingStoreUnavailable("Checkout reservation returned an invalid result.")
        reservation_status = response["status"]
        if reservation_status == "active_subscription":
            return CheckoutReservation(
                status=reservation_status,
                subscription_id=response.get("subscription_id"),
            )
        if reservation_status not in {"created", "existing"}:
            raise BillingStoreUnavailable("Checkout reservation returned an unknown status.")
        try:
            reserved = CheckoutCorrelation(
                correlation_id=str(response["correlation_id"]),
                user_id=correlation.user_id,
                price_id=str(response["price_id"]),
                paddle_transaction_id=(
                    str(response["paddle_transaction_id"])
                    if response.get("paddle_transaction_id")
                    else None
                ),
                status=str(response["checkout_status"]),
                expires_at=datetime.fromisoformat(
                    str(response["expires_at"]).replace("Z", "+00:00")
                ),
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise BillingStoreUnavailable("Checkout reservation is invalid.") from exc
        return CheckoutReservation(status=reservation_status, correlation=reserved)

    def link_checkout_transaction(self, correlation_id: str, transaction_id: str) -> None:
        try:
            rows = self._client.update(
                self.CHECKOUT_TABLE,
                {
                    "paddle_transaction_id": transaction_id,
                    "status": "linked",
                },
                {"correlation_id": correlation_id, "status": "pending"},
            )
        except RuntimeError as exc:
            raise BillingStoreUnavailable("Billing state is unavailable.") from exc
        if len(rows) != 1:
            raise BillingOwnershipError("Checkout correlation could not be linked safely.")

    def get_checkout_by_transaction(self, transaction_id: str) -> CheckoutCorrelation | None:
        try:
            rows = self._client.select(
                self.CHECKOUT_TABLE,
                filters={"paddle_transaction_id": transaction_id},
                limit=1,
            )
        except RuntimeError as exc:
            raise BillingStoreUnavailable("Billing state is unavailable.") from exc
        if not rows:
            return None
        row = rows[0]
        try:
            return CheckoutCorrelation(
                correlation_id=str(row["correlation_id"]),
                user_id=str(row["user_id"]),
                price_id=str(row["price_id"]),
                paddle_transaction_id=str(row["paddle_transaction_id"]),
                status=str(row["status"]),
                expires_at=datetime.fromisoformat(str(row["expires_at"]).replace("Z", "+00:00")),
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise BillingStoreUnavailable("Billing correlation is invalid.") from exc

    def process_event(
        self,
        mutation: PaddleEventMutation,
        *,
        past_due_grace_days: int,
    ) -> EventProcessingResult:
        try:
            response = self._client.rpc(
                self.PROCESS_EVENT_RPC,
                mutation.as_rpc_payload(past_due_grace_days),
            )
        except RuntimeError as exc:
            message = str(exc).lower()
            if "billing_ownership_conflict" in message:
                raise BillingOwnershipError("Paddle ownership mapping conflicts with stored state.") from exc
            raise BillingStoreUnavailable("Billing event could not be persisted.") from exc
        if isinstance(response, list):
            response = response[0] if response else None
        if not isinstance(response, dict) or not isinstance(response.get("status"), str):
            raise BillingStoreUnavailable("Billing event processor returned an invalid result.")
        return EventProcessingResult(
            status=response["status"],
            user_id=response.get("user_id"),
            reason=response.get("reason"),
        )

    def list_subscriptions(self) -> list[LocalSubscription]:
        try:
            rows = self._client.select("paddle_subscriptions")
        except RuntimeError as exc:
            raise BillingStoreUnavailable("Billing state is unavailable.") from exc
        subscriptions: list[LocalSubscription] = []
        try:
            for row in rows:
                subscriptions.append(
                    LocalSubscription(
                        subscription_id=str(row["subscription_id"]),
                        user_id=str(row["user_id"]),
                        status=str(row["status"]),
                        last_event_at=datetime.fromisoformat(
                            str(row["last_event_at"]).replace("Z", "+00:00")
                        ),
                    )
                )
        except (KeyError, TypeError, ValueError) as exc:
            raise BillingStoreUnavailable("Stored subscription data is invalid.") from exc
        return subscriptions


class UnavailableBillingRepository:
    """Fail-closed repository used when durable billing persistence is not configured."""

    @staticmethod
    def _unavailable() -> None:
        raise BillingStoreUnavailable("Durable billing storage is not configured.")

    def reserve_checkout(self, correlation: CheckoutCorrelation) -> CheckoutReservation:
        self._unavailable()
        raise AssertionError("unreachable")

    def link_checkout_transaction(self, correlation_id: str, transaction_id: str) -> None:
        self._unavailable()

    def get_checkout_by_transaction(self, transaction_id: str) -> CheckoutCorrelation | None:
        self._unavailable()

    def process_event(
        self,
        mutation: PaddleEventMutation,
        *,
        past_due_grace_days: int,
    ) -> EventProcessingResult:
        self._unavailable()
        raise AssertionError("unreachable")

    def list_subscriptions(self) -> list[LocalSubscription]:
        self._unavailable()
        raise AssertionError("unreachable")
