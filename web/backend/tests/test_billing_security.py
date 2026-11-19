from __future__ import annotations

import hashlib
import hmac
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any

import httpx
import pytest

from app.config import Settings
from app.repositories import (
    BillingStoreUnavailable,
    CheckoutCorrelation,
    EventProcessingResult,
    LocalSubscription,
    PaddleEventMutation,
)
from app.services import (
    BillingConfigError,
    BillingRequestError,
    BillingService,
    WebhookVerificationError,
)


NOW = 1_800_000_000
USER_A = "11111111-1111-4111-8111-111111111111"
USER_B = "22222222-2222-4222-8222-222222222222"
SECRET = "pdl_ntfset_test_secret"
TXN = "txn_01test00000000000000000000"
SUB = "sub_01test00000000000000000000"
CUSTOMER = "ctm_01test00000000000000000000"


class MemoryBillingRepository:
    def __init__(self) -> None:
        self.correlations: dict[str, CheckoutCorrelation] = {}
        self.events: dict[str, PaddleEventMutation] = {}
        self.subscriptions: dict[str, dict[str, Any]] = {}
        self._lock = Lock()
        self.fail = False

    def create_checkout_correlation(self, correlation: CheckoutCorrelation) -> None:
        if self.fail:
            raise BillingStoreUnavailable
        self.correlations[correlation.correlation_id] = correlation

    def link_checkout_transaction(self, correlation_id: str, transaction_id: str) -> None:
        correlation = self.correlations[correlation_id]
        self.correlations[correlation_id] = CheckoutCorrelation(
            correlation_id=correlation.correlation_id,
            user_id=correlation.user_id,
            price_id=correlation.price_id,
            paddle_transaction_id=transaction_id,
            status="linked",
            expires_at=correlation.expires_at,
        )

    def get_checkout_by_transaction(self, transaction_id: str) -> CheckoutCorrelation | None:
        if self.fail:
            raise BillingStoreUnavailable
        return next(
            (
                item
                for item in self.correlations.values()
                if item.paddle_transaction_id == transaction_id
            ),
            None,
        )

    def process_event(
        self,
        mutation: PaddleEventMutation,
        *,
        past_due_grace_days: int,
    ) -> EventProcessingResult:
        if self.fail:
            raise BillingStoreUnavailable
        with self._lock:
            if mutation.event_id in self.events:
                return EventProcessingResult(status="duplicate")
            self.events[mutation.event_id] = mutation
            correlation = next(
                (
                    item
                    for item in self.correlations.values()
                    if item.correlation_id == mutation.correlation_id
                    or item.paddle_transaction_id == mutation.transaction_id
                ),
                None,
            )
            existing = self.subscriptions.get(mutation.subscription_id or "")
            user_id = existing["user_id"] if existing else (correlation.user_id if correlation else None)
            if mutation.event_type == "transaction.completed":
                if user_id is None:
                    return EventProcessingResult(status="failed", reason="ownership_unmapped")
                return EventProcessingResult(status="processed", user_id=user_id)
            if mutation.event_type.startswith("subscription."):
                if user_id is None:
                    return EventProcessingResult(status="failed", reason="ownership_unmapped")
                if existing and existing["last_event_at"] >= mutation.occurred_at:
                    return EventProcessingResult(status="ignored", user_id=user_id, reason="out_of_order")
                self.subscriptions[mutation.subscription_id or ""] = {
                    "user_id": user_id,
                    "status": mutation.subscription_status,
                    "last_event_at": mutation.occurred_at,
                    "revoked": existing["revoked"] if existing else False,
                    "price_id": mutation.price_id,
                }
                return EventProcessingResult(status="processed", user_id=user_id)
            if mutation.event_type.startswith("adjustment."):
                if not existing:
                    return EventProcessingResult(status="failed", reason="adjustment_unmapped")
                if (
                    mutation.adjustment_status == "approved"
                    and mutation.adjustment_type == "full"
                    and mutation.adjustment_action in {"refund", "chargeback"}
                ):
                    existing["revoked"] = True
                if mutation.adjustment_action in {"chargeback_reverse", "credit_reverse"}:
                    existing["revoked"] = False
                return EventProcessingResult(status="processed", user_id=user_id)
            return EventProcessingResult(status="ignored", reason="unsupported_event")

    def list_subscriptions(self) -> list[LocalSubscription]:
        return [
            LocalSubscription(
                subscription_id=subscription_id,
                user_id=item["user_id"],
                status=item["status"],
                last_event_at=item["last_event_at"],
            )
            for subscription_id, item in self.subscriptions.items()
        ]


@pytest.fixture
def billing_settings(tmp_settings: Settings) -> Settings:
    values = tmp_settings.model_dump(by_alias=True)
    values.update(
        {
            "PADDLE_API_KEY": "pdl_sdbx_test",
            "PADDLE_ENVIRONMENT": "sandbox",
            "PADDLE_PRICE_ID": "pri_monthly",
            "PADDLE_ALLOWED_PRICE_IDS": "pri_monthly,pri_yearly",
            "PADDLE_RETURN_URL": "https://example.test/growth",
            "PADDLE_WEBHOOK_SECRET": SECRET,
            "PADDLE_API_URL": "https://sandbox-api.paddle.com",
            "PADDLE_WEBHOOK_TOLERANCE_SECONDS": 5,
        }
    )
    return Settings(**values)


@pytest.fixture
def repository() -> MemoryBillingRepository:
    repository = MemoryBillingRepository()
    correlation = CheckoutCorrelation(
        correlation_id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        user_id=USER_A,
        price_id="pri_monthly",
        paddle_transaction_id=TXN,
        status="linked",
        expires_at=datetime.fromtimestamp(NOW, timezone.utc) + timedelta(hours=1),
    )
    repository.correlations[correlation.correlation_id] = correlation
    return repository


@pytest.fixture
def service(
    repository: MemoryBillingRepository,
    billing_settings: Settings,
) -> BillingService:
    return BillingService(repository, billing_settings, clock=lambda: NOW)


def _subscription_data(status: str = "active", *, updated_at: int = NOW) -> dict[str, Any]:
    return {
        "id": SUB,
        "customer_id": CUSTOMER,
        "transaction_id": TXN,
        "status": status,
        "updated_at": datetime.fromtimestamp(updated_at, timezone.utc).isoformat(),
        "custom_data": {"thinkle_checkout_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"},
        "current_billing_period": {
            "starts_at": datetime.fromtimestamp(updated_at, timezone.utc).isoformat(),
            "ends_at": (
                datetime.fromtimestamp(updated_at, timezone.utc) + timedelta(days=30)
            ).isoformat(),
        },
        "scheduled_change": None,
        "items": [{"price": {"id": "pri_monthly"}}],
    }


def _event(
    event_id: str,
    event_type: str,
    data: dict[str, Any],
    *,
    occurred_at: int = NOW,
) -> bytes:
    return json.dumps(
        {
            "event_id": event_id,
            "notification_id": f"ntf_{event_id}",
            "event_type": event_type,
            "occurred_at": datetime.fromtimestamp(occurred_at, timezone.utc).isoformat(),
            "data": data,
        },
        separators=(",", ":"),
    ).encode()


def _signature(payload: bytes, *, timestamp: int = NOW, secret: str = SECRET) -> str:
    digest = hmac.new(
        secret.encode(),
        str(timestamp).encode() + b":" + payload,
        hashlib.sha256,
    ).hexdigest()
    return f"ts={timestamp};h1={digest}"


def test_valid_signature_and_duplicate_delivery_are_idempotent(
    service: BillingService,
    repository: MemoryBillingRepository,
) -> None:
    payload = _event("evt_active", "subscription.created", _subscription_data())
    first = service.handle_webhook(payload, _signature(payload))
    second = service.handle_webhook(payload, _signature(payload))
    assert first.status == "processed"
    assert second.status == "duplicate"
    assert len(repository.events) == 1


@pytest.mark.parametrize("signature", [None, "", "ts=nope;h1=bad", "ts=1800000000", "h1=bad"])
def test_missing_or_malformed_signatures_are_rejected(
    service: BillingService,
    signature: str | None,
) -> None:
    payload = _event("evt_bad", "subscription.created", _subscription_data())
    with pytest.raises(WebhookVerificationError):
        service.handle_webhook(payload, signature)


def test_altered_body_is_rejected(service: BillingService) -> None:
    payload = _event("evt_original", "subscription.created", _subscription_data())
    altered = payload.replace(b"active", b"paused")
    with pytest.raises(WebhookVerificationError):
        service.handle_webhook(altered, _signature(payload))


@pytest.mark.parametrize("timestamp", [NOW - 6, NOW + 6])
def test_stale_or_future_signature_is_rejected(service: BillingService, timestamp: int) -> None:
    payload = _event("evt_stale", "subscription.created", _subscription_data())
    with pytest.raises(WebhookVerificationError):
        service.handle_webhook(payload, _signature(payload, timestamp=timestamp))


def test_out_of_order_subscription_event_is_ignored(
    service: BillingService,
    repository: MemoryBillingRepository,
) -> None:
    newer = _event("evt_new", "subscription.updated", _subscription_data("active"), occurred_at=NOW)
    older = _event(
        "evt_old",
        "subscription.canceled",
        _subscription_data("canceled", updated_at=NOW - 60),
        occurred_at=NOW - 60,
    )
    service.handle_webhook(newer, _signature(newer))
    result = service.handle_webhook(older, _signature(older))
    assert result.status == "ignored"
    assert repository.subscriptions[SUB]["status"] == "active"


def test_payment_failure_keeps_past_due_state_and_recovery_restores_active(
    service: BillingService,
    repository: MemoryBillingRepository,
) -> None:
    past_due = _event("evt_due", "subscription.past_due", _subscription_data("past_due"))
    recovered = _event(
        "evt_recovered",
        "subscription.updated",
        _subscription_data("active", updated_at=NOW + 1),
        occurred_at=NOW + 1,
    )
    service.handle_webhook(past_due, _signature(past_due))
    assert repository.subscriptions[SUB]["status"] == "past_due"
    service.handle_webhook(recovered, _signature(recovered))
    assert repository.subscriptions[SUB]["status"] == "active"


@pytest.mark.parametrize("status,event_type", [("paused", "subscription.paused"), ("canceled", "subscription.canceled")])
def test_terminal_or_paused_state_is_recorded(
    service: BillingService,
    repository: MemoryBillingRepository,
    status: str,
    event_type: str,
) -> None:
    payload = _event(f"evt_{status}", event_type, _subscription_data(status))
    service.handle_webhook(payload, _signature(payload))
    assert repository.subscriptions[SUB]["status"] == status


def test_full_approved_refund_revokes_access(
    service: BillingService,
    repository: MemoryBillingRepository,
) -> None:
    active = _event("evt_active", "subscription.created", _subscription_data())
    service.handle_webhook(active, _signature(active))
    refund = _event(
        "evt_refund",
        "adjustment.updated",
        {
            "transaction_id": TXN,
            "subscription_id": SUB,
            "customer_id": CUSTOMER,
            "action": "refund",
            "type": "full",
            "status": "approved",
        },
    )
    service.handle_webhook(refund, _signature(refund))
    assert repository.subscriptions[SUB]["revoked"] is True


def test_concurrent_duplicate_deliveries_process_once(
    service: BillingService,
    repository: MemoryBillingRepository,
) -> None:
    payload = _event("evt_concurrent", "subscription.created", _subscription_data())
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: service.handle_webhook(payload, _signature(payload)), range(8)))
    assert [result.status for result in results].count("processed") == 1
    assert len(repository.events) == 1


def test_cross_account_transaction_confirmation_is_rejected_without_api_call(
    service: BillingService,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    called = False

    def fake_get(*args: Any, **kwargs: Any) -> httpx.Response:
        nonlocal called
        called = True
        return httpx.Response(500)

    monkeypatch.setattr(httpx, "get", fake_get)
    with pytest.raises(BillingRequestError, match="does not belong"):
        service.confirm_transaction(TXN, USER_B)
    assert called is False


def test_checkout_uses_server_correlation_not_user_custom_data(
    service: BillingService,
    repository: MemoryBillingRepository,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    def fake_post(url: str, **kwargs: Any) -> httpx.Response:
        captured.update(kwargs["json"])
        return httpx.Response(
            201,
            request=httpx.Request("POST", url),
            json={"data": {"id": "txn_new", "checkout": {"url": "https://pay.test/checkout"}}},
        )

    monkeypatch.setattr(httpx, "post", fake_post)
    url = service.create_checkout_session(USER_A, price_id="pri_yearly")
    assert url == "https://pay.test/checkout"
    assert "userId" not in captured["custom_data"]
    assert captured["checkout"] == {"url": "https://example.test/growth"}
    assert "return_url" not in captured
    assert "cancel_url" not in captured
    correlation_id = captured["custom_data"]["thinkle_checkout_id"]
    assert repository.correlations[correlation_id].user_id == USER_A


def test_staging_rejects_live_paddle_configuration(
    repository: MemoryBillingRepository,
    billing_settings: Settings,
) -> None:
    values = billing_settings.model_dump(by_alias=True)
    values.update(
        {
            "DEPLOYMENT_ENVIRONMENT": "staging",
            "PADDLE_ENVIRONMENT": "live",
            "PADDLE_API_URL": "https://api.paddle.com",
            "PADDLE_API_KEY": "pdl_live_test",
        }
    )
    service = BillingService(repository, Settings(**values), clock=lambda: NOW)
    with pytest.raises(BillingConfigError, match="Staging billing must use Paddle sandbox"):
        service.create_checkout_session(USER_A)


def test_paddle_environment_url_mismatch_fails_closed(
    repository: MemoryBillingRepository,
    billing_settings: Settings,
) -> None:
    values = billing_settings.model_dump(by_alias=True)
    values["PADDLE_API_URL"] = "https://api.paddle.com"
    service = BillingService(repository, Settings(**values), clock=lambda: NOW)
    with pytest.raises(BillingConfigError, match="environment and API URL"):
        service.create_checkout_session(USER_A)


def test_database_failure_fails_closed(
    service: BillingService,
    repository: MemoryBillingRepository,
) -> None:
    repository.fail = True
    payload = _event("evt_db_down", "subscription.created", _subscription_data())
    with pytest.raises(BillingConfigError):
        service.handle_webhook(payload, _signature(payload))


def test_reconciliation_dry_run_reports_drift_and_unmapped_subscriptions(
    service: BillingService,
    repository: MemoryBillingRepository,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    active = _event("evt_seed", "subscription.created", _subscription_data())
    service.handle_webhook(active, _signature(active))
    changed = _subscription_data("paused", updated_at=NOW + 60)
    unknown = dict(changed)
    unknown["id"] = "sub_unknown"

    def fake_get(url: str, **kwargs: Any) -> httpx.Response:
        return httpx.Response(
            200,
            request=httpx.Request("GET", url),
            json={
                "data": [changed, unknown],
                "meta": {"pagination": {"has_more": False, "next": url}},
            },
        )

    monkeypatch.setattr(httpx, "get", fake_get)
    report = service.reconcile_subscriptions(dry_run=True)
    assert f"drift:{SUB}:active->paused" in report.conflicts
    assert "unmapped_paddle_subscription:sub_unknown" in report.conflicts
    assert repository.subscriptions[SUB]["status"] == "active"
