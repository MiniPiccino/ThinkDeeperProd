from __future__ import annotations

import stripe

from ..config import Settings
from ..repositories.user_repository import UserRepository


class BillingConfigError(RuntimeError):
    """Raised when Stripe configuration is missing."""


class BillingService:
    """Creates checkout sessions and processes Stripe webhooks."""

    def __init__(self, user_repository: UserRepository, settings: Settings) -> None:
        self._users = user_repository
        self._settings = settings
        self._enabled = bool(
            settings.stripe_secret_key and settings.stripe_price_id and settings.stripe_success_url
        )
        if settings.stripe_secret_key:
            stripe.api_key = settings.stripe_secret_key

    def _ensure_enabled(self) -> None:
        if not self._enabled:
            raise BillingConfigError("Stripe billing is not configured.")

    def create_checkout_session(
        self,
        user_id: str,
        success_url: str | None = None,
        cancel_url: str | None = None,
    ) -> str:
        """Create a Stripe Checkout session and return the URL."""
        self._ensure_enabled()
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": self._settings.stripe_price_id, "quantity": 1}],
            success_url=success_url or self._settings.stripe_success_url,
            cancel_url=cancel_url or self._settings.stripe_cancel_url or (success_url or self._settings.stripe_success_url),
            allow_promotion_codes=True,
            billing_address_collection="auto",
            automatic_tax={"enabled": True},
            customer_creation="always",
            metadata={"userId": user_id},
        )
        return session.url

    def handle_webhook(self, payload: bytes, signature: str | None) -> None:
        """Handle Stripe webhook events and upgrade user to premium on checkout completion."""
        self._ensure_enabled()
        if not self._settings.stripe_webhook_secret:
            raise BillingConfigError("Stripe webhook secret missing.")
        if signature is None:
            raise BillingConfigError("Stripe signature header missing.")

        event = stripe.Webhook.construct_event(
            payload=payload, sig_header=signature, secret=self._settings.stripe_webhook_secret
        )
        if event["type"] in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
            session = event["data"]["object"]
            user_id = (session.get("metadata") or {}).g