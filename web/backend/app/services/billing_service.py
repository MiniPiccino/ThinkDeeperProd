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
        self._enabled = bool(
            settings.paddle_api_key
            and settings.paddle_price_id
            and settings.paddle_return_url
            and settings.paddle_business_id
        )

    def _ensure_enabled(self) -> None:
        if not self._enabled:
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
        payload: dict[str, Any] = {
            "business_id": self._settings.paddle_business_id,
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
        checkout_url = data.get("data", {}).get("checkout_url") or data.get("data", {}).get("url")
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
