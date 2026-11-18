from __future__ import annotations

import argparse
import json
from collections.abc import Iterable

from ..config import get_settings
from ..integrations.supabase_client import SupabaseClient
from ..repositories import SupabaseBillingRepository
from ..services import BillingService


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Compare durable subscription state with Paddle (dry-run by default)."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply authoritative Paddle snapshots to already-mapped subscriptions.",
    )
    args = parser.parse_args(list(argv) if argv is not None else None)
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_key:
        parser.error("Supabase service configuration is required.")
    if args.apply and "sandbox" not in settings.paddle_api_url:
        parser.error("Apply mode is restricted to Paddle sandbox in this release.")

    client = SupabaseClient(settings.supabase_url, settings.supabase_service_key)
    service = BillingService(SupabaseBillingRepository(client), settings)
    report = service.reconcile_subscriptions(dry_run=not args.apply)
    print(
        json.dumps(
            {
                "dry_run": report.dry_run,
                "paddle_count": report.paddle_count,
                "local_count": report.local_count,
                "applied": report.applied,
                "unchanged": report.unchanged,
                "conflicts": list(report.conflicts),
            },
            indent=2,
        )
    )
    return 2 if report.conflicts else 0


if __name__ == "__main__":
    raise SystemExit(main())
