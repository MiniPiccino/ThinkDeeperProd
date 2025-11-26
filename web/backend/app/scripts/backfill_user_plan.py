from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Iterable, Set

from ..config import get_settings
from ..integrations.supabase_client import SupabaseClient
from ..repositories.user_repository import UserRepository


def _load_progress_users(progress_path: Path) -> Set[str]:
    if not progress_path.exists():
        return set()
    try:
        data = json.loads(progress_path.read_text(encoding="utf-8"))
        return set(data.keys())
    except Exception:
        return set()


def _load_answer_users(answers_path: Path) -> Set[str]:
    users: Set[str] = set()
    if not answers_path.exists():
        return users
    try:
        with answers_path.open("r", encoding="utf-8") as handle:
            for line in handle:
                try:
                    record = json.loads(line)
                    uid = record.get("user_id") or record.get("userId")
                    if isinstance(uid, str) and uid.strip():
                        users.add(uid.strip())
                except json.JSONDecodeError:
                    continue
    except Exception:
        return users
    return users


def _load_supabase_progress_users(
    supabase: SupabaseClient, table: str, batch_size: int = 1000
) -> Set[str]:
    """Fetch user ids from Supabase progress table."""
    users: Set[str] = set()
    try:
        rows = supabase.select(table, filters=None, limit=batch_size)
        for row in rows:
            uid = row.get("user_id")
            if isinstance(uid, str) and uid.strip():
                users.add(uid.strip())
    except RuntimeError:
        return users
    return users


def _build_user_repo(settings) -> UserRepository:
    supabase_client = None
    if settings.supabase_url and settings.supabase_service_key:
        supabase_client = SupabaseClient(settings.supabase_url, settings.supabase_service_key)
    return UserRepository(
        settings.user_metadata_path,
        supabase_client=supabase_client,
        supabase_table=settings.supabase_user_table if supabase_client else None,
    )


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Backfill user plans into Supabase user_plan table (or local store).")
    parser.add_argument(
        "--plan",
        default="free",
        help="Plan to assign when backfilling existing users (default: free).",
    )
    args = parser.parse_args(list(argv) if argv is not None else None)

    settings = get_settings()
    repo = _build_user_repo(settings)

    users = set()
    if settings.supabase_url and settings.supabase_service_key and settings.supabase_progress_table:
        supabase = SupabaseClient(settings.supabase_url, settings.supabase_service_key)
        users |= _load_supabase_progress_users(supabase, settings.supabase_progress_table)

    users |= _load_progress_users(settings.progress_store_path)
    users |= _load_answer_users(settings.answers_store_path)

    if not users:
        print("No users found to backfill.", file=sys.stdout)
        return 0

    for uid in sorted(users):
        repo.set_plan(uid, args.plan)

    print(f"Backfilled {len(users)} user(s) with plan '{args.plan}'.", file=sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
