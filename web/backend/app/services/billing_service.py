from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Callable
from urllib.parse import urlparse
from uuid import uuid4

import httpx

from ..config import Settings
from ..repositories import (
    BillingOwnershipError,
    BillingRepository,
    BillingStoreUnavailable,
    CheckoutCorrelation,
    EventProcessingResult,
    PaddleEventMutation,
)


class BillingConfigError(RuntimeError):
    """Raised when Paddle or durable billing storage is not configured."""


class BillingRequestError(RuntimeError):
    """Raised for a safe-to-report invalid billing request."""


class WebhookVerificationError(RuntimeError):
    """Raised when a webhook cannot be authenticated as a fresh Paddle delivery."""


@dataclass(frozen=True, slots=True)
class ReconciliationReport:
    dry_run: bool
    paddle_count: int
    local_count: int
    applied: int
    unchanged: int
    conflicts: tuple[str, ...]


class BillingService:
    """Secure Paddle Billing checkout, confirmation, and webhook processing."""

    SUPPORTED_SUBSCRIPTION_EVENTS = {
        "subscription.created",
        "subscription.updated",
        "subscription.activated",
        "subscription.trialing",
        "subscription.past_due",
        "subscription.paused",
        "subscription.resumed",
        "subscription.canceled",
    }
    SUPPORTED_ADJUSTMENT_EVENTS = {"adjustment.created", "adjustment.updated"}

    def __init__(
        self,
        billing_repository: BillingRepository,
        settings: Settings,
        *,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self._billing = billing_repository
        self._settings = settings
        self._clock = clock
        self._base_url = settings.paddle_api_url.rstrip("/")

    def _ensure_billing_enabled(self) -> None:
        if not self._settings.paddle_api_key:
            raise BillingConfigError("Paddle Billing is not configured.")
        environment = self._settings.paddle_environment
        expected_url = (
            "https://sandbox-api.paddle.com"
            if environment == "sandbox"
            else "https://api.paddle.com"
        )
        if self._base_url != expected_url:
            raise BillingConfigError("Paddle environment and API URL do not match.")
        is_sandbox_key = "_sdbx" in self._settings.paddle_api_key
        if (environment == "sandbox") != is_sandbox_key:
            raise BillingConfigError("Paddle credential and environment do not match.")
        if (
            self._settings.deployment_environment == "staging"
            and environment != "sandbox"
        ):
            raise BillingConfigError("Staging billing must use Paddle sandbox.")

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._settings.paddle_api_key}",
            "Content-Type": "application/json",
        }

    def _allowed_price_ids(self) -> set[str]:
        configured = self._settings.paddle_allowed_price_ids or ""
        allowed = {value.strip() for value in configured.split(",") if value.strip()}
        if self._settings.paddle_price_id:
            allowed.add(self._settings.paddle_price_id)
        return allowed

    def create_checkout_session(
        self,
        user_id: str,
        price_id: str | None = None,
    ) -> str:
        """Create a server-owned Paddle transaction and durable ownership correlation."""
        self._ensure_billing_enabled()
        selected_price = price_id or self._settings.paddle_price_id
        if not selected_price or selected_price not in self._allowed_price_ids():
            raise BillingRequestError("The requested billing price is not available.")
        checkout_url = (
            self._settings.paddle_checkout_url or self._settings.paddle_return_url
        )
        if not checkout_url:
            raise BillingConfigError("Paddle checkout URL is not configured.")
        parsed_checkout_url = urlparse(checkout_url)
        if parsed_checkout_url.scheme != "https" or not parsed_checkout_url.netloc:
            raise BillingConfigError("Paddle checkout URL must be HTTPS.")

        now = datetime.fromtimestamp(self._clock(), tz=timezone.utc)
        correlation = CheckoutCorrelation(
            correlation_id=str(uuid4()),
            user_id=user_id,
            price_id=selected_price,
            paddle_transaction_id=None,
            status="pending",
            expires_at=now + timedelta(minutes=self._settings.paddle_checkout_correlation_ttl_minutes),
        )
        try:
            self._billing.create_checkout_correlation(correlation)
        except BillingStoreUnavailable as exc:
            raise BillingConfigError("Billing is temporarily unavailable.") from exc

        payload: dict[str, Any] = {
            "items": [{"price_id": selected_price, "quantity": 1}],
            "custom_data": {"thinkle_checkout_id": correlation.correlation_id},
            "checkout": {"url": checkout_url},
        }
        response = httpx.post(
            f"{self._base_url}/transactions",
            json=payload,
            headers=self._headers(),
            timeout=15,
        )
        self._raise_provider_error(response, "Paddle checkout could not be created.")
        body = (response.json().get("data") or {}) if response.content else {}
        transaction_id = body.get("id")
        checkout_url = (body.get("checkout") or {}).get("url") or body.get("checkout_url")
        if not isinstance(transaction_id, str) or not isinstance(checkout_url, str):
            raise BillingRequestError("Paddle checkout returned an incomplete response.")
        try:
            self._billing.link_checkout_transaction(correlation.correlation_id, transaction_id)
        except (BillingStoreUnavailable, BillingOwnershipError) as exc:
            raise BillingConfigError("Checkout ownership could not be persisted.") from exc
        return checkout_url

    def create_client_token(self) -> str:
        """Retained for non-authoritative Paddle.js uses; it never creates ownership."""
        self._ensure_billing_enabled()
        response = httpx.post(
            f"{self._base_url}/client-tokens",
            json={"name": "thinkle-web"},
            headers=self._headers(),
            timeout=15,
        )
        self._raise_provider_error(response, "Paddle client token could not be created.")
        data = response.json()
        token = (data.get("data") or {}).get("token") or data.get("token")
        if not isinstance(token, str) or not token:
            raise BillingRequestError("Paddle client token was unavailable.")
        return token

    def confirm_transaction(self, transaction_id: str, expected_user_id: str) -> None:
        """Reconcile a completed checkout without trusting Paddle custom data as identity."""
        self._ensure_billing_enabled()
        if not transaction_id:
            raise BillingRequestError("Transaction ID is required.")
        try:
            correlation = self._billing.get_checkout_by_transaction(transaction_id)
        except BillingStoreUnavailable as exc:
            raise BillingConfigError("Billing is temporarily unavailable.") from exc
        if correlation is None or correlation.user_id != expected_user_id:
            raise BillingRequestError("Transaction does not belong to the authenticated user.")
        if correlation.expires_at <= datetime.fromtimestamp(self._clock(), tz=timezone.utc):
            raise BillingRequestError("Checkout ownership correlation has expired.")

        transaction = self._get_paddle_entity(f"transactions/{transaction_id}")
        if transaction.get("status") != "completed":
            raise BillingRequestError("Transaction is not completed.")
        custom_data = transaction.get("custom_data") or {}
        if custom_data.get("thinkle_checkout_id") != correlation.correlation_id:
            raise BillingRequestError("Transaction ownership metadata is invalid.")
        subscription_id = transaction.get("subscription_id")
        if not isinstance(subscription_id, str):
            raise BillingRequestError("Completed transaction has no subscription.")

        subscription = self._get_paddle_entity(f"subscriptions/{subscription_id}")
        occurred_at = self._parse_datetime(subscription.get("updated_at"), "subscription updated_at")
        synthetic_event = {
            "event_id": f"confirmation:{transaction_id}",
            "notification_id": f"confirmation:{transaction_id}",
            "event_type": "subscription.updated",
            "occurred_at": occurred_at.isoformat(),
            "data": subscription,
        }
        mutation = self._normalize_event(
            synthetic_event,
            payload_sha256=hashlib.sha256(transaction_id.encode("utf-8")).hexdigest(),
        )
        self._persist_event(mutation)

    def handle_webhook(self, payload: bytes, signature: str | None) -> EventProcessingResult:
        """Verify the untouched body, normalize the Paddle event, and persist it atomically."""
        self._ensure_billing_enabled()
        self._verify_webhook_signature(payload, signature)
        try:
            event = json.loads(payload)
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise BillingRequestError("Webhook payload is invalid JSON.") from exc
        if not isinstance(event, dict):
            raise BillingRequestError("Webhook payload must be an object.")
        mutation = self._normalize_event(event, hashlib.sha256(payload).hexdigest())
        return self._persist_event(mutation)

    def reconcile_subscriptions(self, *, dry_run: bool = True) -> ReconciliationReport:
        """Compare Paddle snapshots with mapped subscriptions; mutate only when explicitly enabled."""
        self._ensure_billing_enabled()
        try:
            local = {item.subscription_id: item for item in self._billing.list_subscriptions()}
        except BillingStoreUnavailable as exc:
            raise BillingConfigError("Billing is temporarily unavailable.") from exc

        paddle: dict[str, dict[str, Any]] = {}
        url = f"{self._base_url}/subscriptions"
        params: dict[str, str] | None = {"per_page": "200"}
        for _page in range(self._settings.paddle_reconciliation_max_pages):
            response = httpx.get(url, params=params, headers=self._headers(), timeout=30)
            if response.status_code == 429:
                raise BillingRequestError("Paddle rate limited reconciliation; retry later.")
            self._raise_provider_error(response, "Paddle subscriptions could not be listed.")
            body = response.json()
            rows = body.get("data")
            pagination = (body.get("meta") or {}).get("pagination") or {}
            if not isinstance(rows, list):
                raise BillingRequestError("Paddle subscription list was invalid.")
            for row in rows:
                if isinstance(row, dict) and isinstance(row.get("id"), str):
                    paddle[row["id"]] = row
            if not pagination.get("has_more"):
                break
            next_url = pagination.get("next")
            if not isinstance(next_url, str) or not next_url.startswith(f"{self._base_url}/"):
                raise BillingRequestError("Paddle pagination URL was invalid.")
            url = next_url
            params = None
        else:
            raise BillingRequestError("Paddle reconciliation page limit was reached.")

        conflicts: list[str] = []
        applied = 0
        unchanged = 0
        for subscription_id, snapshot in paddle.items():
            known = local.get(subscription_id)
            if known is None:
                conflicts.append(f"unmapped_paddle_subscription:{subscription_id}")
                continue
            updated_at = self._optional_datetime(snapshot.get("updated_at"))
            if updated_at is None:
                conflicts.append(f"invalid_paddle_subscription:{subscription_id}")
                continue
            if updated_at <= known.last_event_at and snapshot.get("status") == known.status:
                unchanged += 1
                continue
            if dry_run:
                conflicts.append(f"drift:{subscription_id}:{known.status}->{snapshot.get('status')}")
                continue
            synthetic = {
                "event_id": f"reconcile:{subscription_id}:{updated_at.isoformat()}",
                "notification_id": f"reconcile:{subscription_id}",
                "event_type": "subscription.updated",
                "occurred_at": updated_at.isoformat(),
                "data": snapshot,
            }
            mutation = self._normalize_event(
                synthetic,
                hashlib.sha256(
                    json.dumps(snapshot, sort_keys=True, separators=(",", ":")).encode("utf-8")
                ).hexdigest(),
            )
            result = self._persist_event(mutation)
            if result.status in {"processed", "duplicate", "ignored"}:
                applied += 1
            else:
                conflicts.append(f"apply_failed:{subscription_id}:{result.reason or result.status}")

        for missing_id in sorted(set(local) - set(paddle)):
            conflicts.append(f"missing_from_paddle_list:{missing_id}")
        return ReconciliationReport(
            dry_run=dry_run,
            paddle_count=len(paddle),
            local_count=len(local),
            applied=applied,
            unchanged=unchanged,
            conflicts=tuple(conflicts),
        )

    def _verify_webhook_signature(self, payload: bytes, signature: str | None) -> None:
        secret = self._settings.paddle_webhook_secret
        if not secret:
            raise BillingConfigError("Paddle webhook verification is not configured.")
        if not signature:
            raise WebhookVerificationError("Paddle signature is missing.")

        parts: dict[str, list[str]] = {}
        for item in signature.split(";"):
            key, separator, value = item.strip().partition("=")
            if separator and key and value:
                parts.setdefault(key, []).append(value)
        timestamps = parts.get("ts", [])
        signatures = parts.get("h1", [])
        if len(timestamps) != 1 or not signatures:
            raise WebhookVerificationError("Paddle signature is malformed.")
        try:
            timestamp = int(timestamps[0])
        except ValueError as exc:
            raise WebhookVerificationError("Paddle signature timestamp is malformed.") from exc

        tolerance = self._settings.paddle_webhook_tolerance_seconds
        if tolerance <= 0:
            raise BillingConfigError("Paddle webhook timestamp tolerance must be positive.")
        if abs(self._clock() - timestamp) > tolerance:
            raise WebhookVerificationError("Paddle signature timestamp is outside tolerance.")
        signed_payload = str(timestamp).encode("ascii") + b":" + payload
        expected = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
        if not any(hmac.compare_digest(expected, candidate) for candidate in signatures):
            raise WebhookVerificationError("Paddle signature is invalid.")

    def _normalize_event(self, event: dict[str, Any], payload_sha256: str) -> PaddleEventMutation:
        event_id = event.get("event_id")
        notification_id = event.get("notification_id")
        event_type = event.get("event_type")
        if not all(isinstance(value, str) and value for value in (event_id, notification_id, event_type)):
            raise BillingRequestError("Webhook event metadata is incomplete.")
        occurred_at = self._parse_datetime(event.get("occurred_at"), "event occurred_at")
        data = event.get("data")
        if not isinstance(data, dict):
            raise BillingRequestError("Webhook event data is invalid.")

        common = {
            "event_id": event_id,
            "notification_id": notification_id,
            "event_type": event_type,
            "occurred_at": occurred_at,
            "payload_sha256": payload_sha256,
        }
        if event_type in self.SUPPORTED_SUBSCRIPTION_EVENTS:
            return self._subscription_mutation(common, data)
        if event_type == "transaction.completed":
            custom_data = data.get("custom_data") or {}
            return PaddleEventMutation(
                **common,
                transaction_id=self._optional_string(data.get("id")),
                subscription_id=self._optional_string(data.get("subscription_id")),
                customer_id=self._optional_string(data.get("customer_id")),
                correlation_id=self._optional_string(custom_data.get("thinkle_checkout_id")),
            )
        if event_type in self.SUPPORTED_ADJUSTMENT_EVENTS:
            return PaddleEventMutation(
                **common,
                transaction_id=self._optional_string(data.get("transaction_id")),
                subscription_id=self._optional_string(data.get("subscription_id")),
                customer_id=self._optional_string(data.get("customer_id")),
                adjustment_action=self._optional_string(data.get("action")),
                adjustment_type=self._optional_string(data.get("type")),
                adjustment_status=self._optional_string(data.get("status")),
            )
        return PaddleEventMutation(**common)

    def _subscription_mutation(
        self,
        common: dict[str, Any],
        data: dict[str, Any],
    ) -> PaddleEventMutation:
        custom_data = data.get("custom_data") or {}
        period = data.get("current_billing_period") or {}
        scheduled = data.get("scheduled_change") or {}
        items = data.get("items") or []
        price_id = None
        if items and isinstance(items[0], dict):
            price = items[0].get("price") or {}
            price_id = self._optional_string(price.get("id"))
        return PaddleEventMutation(
            **common,
            subscription_id=self._optional_string(data.get("id")),
            transaction_id=self._optional_string(data.get("transaction_id")),
            customer_id=self._optional_string(data.get("customer_id")),
            correlation_id=self._optional_string(custom_data.get("thinkle_checkout_id")),
            subscription_status=self._optional_string(data.get("status")),
            price_id=price_id,
            current_period_start=self._optional_datetime(period.get("starts_at")),
            current_period_end=self._optional_datetime(period.get("ends_at")),
            scheduled_change_action=self._optional_string(scheduled.get("action")),
            scheduled_change_at=self._optional_datetime(scheduled.get("effective_at")),
        )

    def _persist_event(self, mutation: PaddleEventMutation) -> EventProcessingResult:
        try:
            return self._billing.process_event(
                mutation,
                past_due_grace_days=self._settings.paddle_past_due_grace_days,
            )
        except BillingOwnershipError as exc:
            raise BillingRequestError("Paddle ownership mapping is invalid.") from exc
        except BillingStoreUnavailable as exc:
            raise BillingConfigError("Billing event persistence is unavailable.") from exc

    def _get_paddle_entity(self, path: str) -> dict[str, Any]:
        response = httpx.get(
            f"{self._base_url}/{path}",
            headers=self._headers(),
            timeout=15,
        )
        self._raise_provider_error(response, "Paddle record could not be retrieved.")
        body = response.json().get("data") if response.content else None
        if not isinstance(body, dict):
            raise BillingRequestError("Paddle returned an incomplete record.")
        return body

    @staticmethod
    def _raise_provider_error(response: httpx.Response, public_message: str) -> None:
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise BillingRequestError(public_message) from exc

    @staticmethod
    def _parse_datetime(value: Any, field_name: str) -> datetime:
        parsed = BillingService._optional_datetime(value)
        if parsed is None:
            raise BillingRequestError(f"Paddle {field_name} is invalid.")
        return parsed

    @staticmethod
    def _optional_datetime(value: Any) -> datetime | None:
        if value is None:
            return None
        if not isinstance(value, str):
            return None
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
        if parsed.tzinfo is None:
            return None
        return parsed.astimezone(timezone.utc)

    @staticmethod
    def _optional_string(value: Any) -> str | None:
        return value if isinstance(value, str) and value else None
