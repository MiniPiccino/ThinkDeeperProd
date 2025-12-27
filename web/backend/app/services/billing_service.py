from __future__ import annotations

import json
from typing import Any

import httpx

from ..config import Settings
from ..repositories.user_repository import UserRepository


class BillingConfigError(RuntimeError):
    """Raised when Paddle configuration is missing or invalid."""


class BillingService:
    """Creates checkout sessions and processes Paddle webhooks."""

    def __init__(self, user_repository: UserRepository, settings: Settings) -> None:
        self._users = user_repository
        self._settings = settings
        self._base_url = settings.paddle_api_url.rstrip("/") if settings.paddle_api_url else "https://api.paddle.com"
        # Paddle uses separate hosted domains for sandbox vs live.
        # Paddle Billing hosted checkout domains (not the API host).
        self._hosted_checkout_base = (
            "https://sandbox-checkout.paddle.com" if "sandbox" in self._base_url else "https://checkout.paddle.com"
        )
        self._legacy_base_url = (
            "https://sandbox-vendors.paddle.com/api/2.0"
            if settings.paddle_classic_sandbox
            else "https://vendors.paddle.com/api/2.0"
        )
        self._v2_enabled = bool(
            settings.paddle_api_key
            and settings.paddle_price_id
            and settings.paddle_return_url
        )
        self._classic_enabled = bool(
            settings.paddle_classic_vendor_id
            and settings.paddle_classic_auth_code
            and settings.paddle_classic_product_id
        )

    def _ensure_enabled(self) -> None:
        if not (self._v2_enabled or self._classic_enabled):
            raise BillingConfigError("Paddle billing is not configured.")

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._settings.paddle_api_key}",
            "Content-Type": "application/json",
        }

    def create_checkout_session(
        self,
        user_id: str,
        success_url: str | None = None,
        cancel_url: str | None = None,
    ) -> str:
        """Create a Paddle transaction and return its checkout URL."""
        self._ensure_enabled()
        if self._classic_enabled:
            return self._create_classic_checkout_session(user_id, success_url, cancel_url)
        # Default to Paddle v2 when classic config is absent.
        payload: dict[str, Any] = {
            "items": [
                {
                    "price_id": self._settings.paddle_price_id,
                    "quantity": 1,
                }
            ],
            "custom_data": {"userId": user_id},
            "return_url": success_url or self._settings.paddle_return_url,
            "cancel_url": cancel_url or self._settings.paddle_cancel_url or (success_url or self._settings.paddle_return_url),
        }
        response = httpx.post(
            f"{self._base_url}/transactions",
            json=payload,
            headers=self._headers(),
            timeout=15,
        )
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:  # pragma: no cover - network failure
            raise BillingConfigError(f"Paddle transaction failed: {exc.response.text}") from exc
        data = response.json()
        error_payload = data.get("error") or data.get("errors") or data.get("message")
        if error_payload:
            raise BillingConfigError(f"Paddle transaction failed: {error_payload}")
        body = data.get("data", {}) or {}
        attributes = body.get("attributes") or {}
        transaction_id = body.get("id") or attributes.get("id")
        checkout_url = (
            body.get("checkout_url")
            or attributes.get("checkout_url")
            or (attributes.get("checkout") or {}).get("url")
            or (attributes.get("links") or {}).get("checkout_url")
            or (body.get("checkout") or {}).get("url")
            or (body.get("links") or {}).get("checkout_url")
        )
        if not checkout_url and transaction_id:
            checkout_url = f"{self._hosted_checkout_base}/checkout/{transaction_id}"
        # If Paddle returned our own return URL (with _ptxn) instead of the hosted checkout,
        # fall back to the hosted checkout link built from the transaction ID.
        if checkout_url and transaction_id:
            if isinstance(checkout_url, str) and "_ptxn=" in checkout_url and "paddle.com" not in checkout_url:
                checkout_url = f"{self._hosted_checkout_base}/checkout/{transaction_id}"
            # Normalize domains: if sandbox and we got a live domain (pay/checkout), rewrite to sandbox checkout.
            if "sandbox" in self._base_url and isinstance(checkout_url, str):
                if checkout_url.startswith("https://pay.paddle.com/checkout/") or checkout_url.startswith("https://checkout.paddle.com/checkout/"):
                    checkout_url = checkout_url.replace("https://pay.paddle.com", self._hosted_checkout_base, 1)
                    checkout_url = checkout_url.replace("https://checkout.paddle.com", self._hosted_checkout_base, 1)
        if not checkout_url:
            raise BillingConfigError(f"Paddle response missing checkout URL. Payload: {json.dumps(data)}")
        return checkout_url

    def _create_classic_checkout_session(
        self,
        user_id: str,
        success_url: str | None,
        cancel_url: str | None,
    ) -> str:
        payload = {
            "vendor_id": self._settings.paddle_classic_vendor_id,
            "vendor_auth_code": self._settings.paddle_classic_auth_code,
            "product_id": self._settings.paddle_classic_product_id,
            "quantity": 1,
            "passthrough": json.dumps({"userId": user_id}),
            "return_url": success_url or self._settings.paddle_return_url,
            "cancel_url": cancel_url or self._settings.paddle_cancel_url or (success_url or self._settings.paddle_return_url),
        }
        response = httpx.post(
            f"{self._legacy_base_url}/product/generate_pay_link",
            data=payload,
            timeout=15,
        )
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise BillingConfigError(f"Paddle transaction failed: {exc.response.text}") from exc
        data = response.json()
        if not data.get("success"):
            raise BillingConfigError(f"Paddle transaction failed: {response.text}")
        checkout_url = data.get("response", {}).get("url") or data.get("response", {}).get("checkout_url")
        if not checkout_url:
            raise BillingConfigError("Paddle response missing checkout URL.")
        return checkout_url

    def handle_webhook(self, payload: bytes, signature: str | None) -> None:
        """Handle Paddle webhook events and upgrade the user on completed transactions."""
        self._ensure_enabled()
        if not self._settings.paddle_webhook_secret:
            raise BillingConfigError("Paddle webhook secret missing.")
        if not signature:
            raise BillingConfigError("Paddle signature header missing.")
        if signature != self._settings.paddle_webhook_secret:
            raise BillingConfigError("Invalid Paddle signature.")
        try:
            event = json.loads(payload.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise BillingConfigError("Invalid webhook payload.") from exc
        event_type = event.get("event_type") or event.get("type")
        if event_type in {"transaction.completed", "order.completed"}:
            data = event.get("data") or {}
            custom_data = data.get("custom_data") or {}
            user_id = custom_data.get("userId") or data.get("customer_id")
            if user_id:
                self._users.set_plan(user_id, "premium")
