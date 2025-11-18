import json
import logging
import re
from dataclasses import asdict, dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from ..integrations.supabase_client import SupabaseClient

logger = logging.getLogger(__name__)

@dataclass(slots=True)
class StoredAnswer:
    user_id: Optional[str]
    question_id: str
    answer: str
    feedback: str
    xp_awarded: int
    xp_total: int
    streak: int
    created_at: datetime
    duration_seconds: int
    week_index: Optional[int] = None


class AnswerRepository:
    """Persists evaluated answers to either JSONL storage or Supabase."""

    def __init__(
        self,
        storage_path: Path,
        supabase_client: Optional[SupabaseClient] = None,
        supabase_table: Optional[str] = None,
    ) -> None:
        self._storage_path = storage_path
        self._storage_path.parent.mkdir(parents=True, exist_ok=True)
        self._supabase = supabase_client if supabase_client and supabase_table else None
        self._supabase_table = supabase_table

    def save_answer(self, payload: StoredAnswer) -> None:
        """Append the answer to the storage file."""

        record: Dict[str, Any] = {**asdict(payload), "created_at": payload.created_at.isoformat()}
        if self._supabase:
            try:
                record["week_index"] = payload.week_index
                self._supabase.insert(self._supabase_table, record)  # type: ignore[arg-type]
                return
            except RuntimeError as exc:
                logger.warning("Supabase insert failed; falling back to file store: %s", exc)
                self._disable_supabase()

        with self._storage_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False))
            handle.write("\n")

    def latest_before(self, user_id: str, before_date: date) -> Optional[StoredAnswer]:
        """Return the most recent answer submitted before a given date for a user."""

        if self._supabase:
            threshold = datetime.combine(before_date, datetime.min.time(), tzinfo=timezone.utc).isoformat()
            try:
                rows = self._supabase.select(
                    self._supabase_table,
                    filters={"user_id": user_id, "created_at": ("lt", threshold)},
                    order=("created_at", "desc"),
                    limit=1,
                )
                if not rows:
                    return None
                return self._from_record(rows[0])
            except RuntimeError as exc:
                logger.warning("Supabase latest_before failed; falling back to file store: %s", exc)
                self._disable_supabase()

        for stored in reversed(list(self._iter_answers())):
            if stored.user_id != user_id:
                continue
            if stored.created_at.date() >= before_date:
                continue
            return stored
        return None

    def answers_for_week(self, user_id: str, week_index: int) -> List[StoredAnswer]:
        """Return all answers recorded for a specific user and week index."""

        if self._supabase:
            try:
                rows = self._supabase.select(
                    self._supabase_table,
                    filters={"user_id": user_id, "week_index": ("eq", week_index)},
                    order=("created_at", "asc"),
                )
                return [stored for stored in (self._from_record(row) for row in rows) if stored is not None]
            except RuntimeError as exc:
                logger.warning("Supabase answers_for_week failed; falling back to file store: %s", exc)
                self._disable_supabase()

        matches: List[StoredAnswer] = []
        for stored in self._iter_answers():
            if stored.user_id != user_id:
                continue
            stored_week = stored.week_index
            if stored_week is None:
                stored_week = self._week_from_question_id(stored.question_id)
            if stored_week != week_index:
                continue
            matches.append(stored)
        return matches

    def recent_answers(
        self,
        user_id: str,
        limit: Optional[int] = None,
    ) -> List[StoredAnswer]:
        """Return recent answers for a user ordered by newest first."""

        if self._supabase:
            try:
                rows = self._supabase.select(
                    self._supabase_table,
                    filters={"user_id": user_id},
                    order=("created_at", "desc"),
                    limit=limit,
                )
                answers = [stored for stored in (self._from_record(row) for row in rows) if stored is not None]
                return answers
            except RuntimeError as exc:
                logger.warning("Supabase recent_answers failed; falling back to file store: %s", exc)
                self._disable_supabase()

        answers = [stored for stored in self._iter_answers() if stored.user_id == user_id]
        answers.sort(key=lambda record: record.created_at, reverse=True)
        if limit is not None:
            return answers[:limit]
        return answers

    def _iter_answers(self) -> Iterable[StoredAnswer]:
        if not self._storage_path.exists():
            return iter(())
        def generator() -> Iterable[StoredAnswer]:
            with self._storage_path.open("r", encoding="utf-8") as handle:
                for line in handle:
                    stored = self._to_stored_answer(line)
                    if stored is not None:
                        yield stored
        return generator()

    @staticmethod
    def _week_from_question_id(question_id: str) -> Optional[int]:
        match = re.match(r"week-(\d+)-day-\d+", question_id)
        if not match:
            return None
        try:
            return int(match.group(1)) - 1
        except ValueError:
            return None

    @staticmethod
    def _to_stored_answer(raw_line: str) -> Optional[StoredAnswer]:
        raw_line = raw_line.strip()
        if not raw_line:
            return None
        try:
            record = json.loads(raw_line)
        except json.JSONDecodeError:
            return None
        return AnswerRepository._from_record(record)

    @staticmethod
    def _from_record(record: Dict[str, Any]) -> Optional[StoredAnswer]:
        created_at_raw = record.get("created_at")
        if not created_at_raw:
            return None
        try:
            created_at = datetime.fromisoformat(created_at_raw)
        except ValueError:
            return None

        try:
            return StoredAnswer(
                user_id=record.get("user_id"),
                question_id=record.get("question_id", ""),
                answer=record.get("answer", ""),
                feedback=record.get("feedback", ""),
                xp_awarded=int(record.get("xp_awarded", 0)),
                xp_total=int(record.get("xp_total", 0)),
                streak=int(record.get("streak", 0)),
                created_at=created_at,
                duration_seconds=int(record.get("duration_seconds", 0)),
                week_index=record.get("week_index"),
            )
        except Exception:
            return None

    def _disable_supabase(self) -> None:
        self._supabase = None
        self._supabase_table = None
