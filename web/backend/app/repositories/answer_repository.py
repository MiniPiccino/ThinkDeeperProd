import json
import logging
import re
from threading import RLock
from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta, timezone
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
    question_instance_id: Optional[str] = None
    catalog_question_id: Optional[str] = None
    question_date: Optional[date] = None
    question_text: Optional[str] = None
    question_theme: Optional[str] = None
    difficulty_label: Optional[str] = None
    difficulty_score: Optional[int] = None
    difficulty_multiplier: Optional[float] = None
    catalog_version: Optional[str] = None
    week_instance_id: Optional[str] = None


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
        self._reservation_lock = RLock()
        self._reservations: set[tuple[str, str]] = set()

    def reserve_submission(self, user_id: str, question_id: str) -> bool:
        """Claim a question before provider work; the durable RPC owns production races."""
        if self._supabase:
            result = self._supabase.rpc(
                "reserve_answer_submission",
                {"p_user_id": user_id, "p_question_id": question_id},
            )
            return bool(result)
        key = (user_id, question_id)
        with self._reservation_lock:
            if key in self._reservations:
                return False
            if any(
                item.user_id == user_id and item.question_id == question_id
                for item in self._iter_answers()
            ):
                return False
            self._reservations.add(key)
            return True

    def release_submission(self, user_id: str, question_id: str) -> None:
        if self._supabase:
            self._supabase.rpc(
                "release_answer_submission",
                {"p_user_id": user_id, "p_question_id": question_id},
            )
            return
        with self._reservation_lock:
            self._reservations.discard((user_id, question_id))

    def finalize_submission(self, payload: StoredAnswer) -> Optional[Dict[str, Any]]:
        """Atomically finalize answer and progress in PostgreSQL; local mode uses legacy stores."""
        if not self._supabase:
            return None
        answer_record = asdict(payload)
        answer_record["created_at"] = payload.created_at.isoformat()
        answer_record["question_date"] = (
            payload.question_date.isoformat() if payload.question_date else None
        )
        result = self._supabase.rpc(
            "finalize_answer_submission",
            {"p_answer": answer_record},
        )
        if not isinstance(result, dict):
            raise RuntimeError("Invalid answer finalization result")
        return result

    def save_answer(self, payload: StoredAnswer) -> None:
        """Append the answer to the storage file."""

        record: Dict[str, Any] = {
            **asdict(payload),
            "created_at": payload.created_at.isoformat(),
            "question_date": payload.question_date.isoformat()
            if payload.question_date
            else None,
        }
        if self._supabase:
            try:
                record["week_index"] = payload.week_index
                self._supabase.insert(self._supabase_table, record)  # type: ignore[arg-type]
                return
            except RuntimeError as exc:
                logger.error("Supabase answer insert failed")
                raise RuntimeError("Answer persistence unavailable") from exc

        with self._storage_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False))
            handle.write("\n")
        with self._reservation_lock:
            self._reservations.discard((str(payload.user_id), payload.question_id))

    def latest_before(self, user_id: str, before_date: date) -> Optional[StoredAnswer]:
        """Return the most recent answer submitted before a given date for a user."""

        if self._supabase:
            threshold = datetime.combine(
                before_date, datetime.min.time(), tzinfo=timezone.utc
            ).isoformat()
            try:
                dated_rows = self._supabase.select(
                    self._supabase_table,
                    filters={"user_id": user_id, "question_date": ("lt", before_date.isoformat())},
                    order=("question_date", "desc"),
                    limit=1,
                )
                legacy_rows = self._supabase.select(
                    self._supabase_table,
                    filters={"user_id": user_id, "question_date": ("is", "null"), "created_at": ("lt", threshold)},
                    order=("created_at", "desc"),
                    limit=1,
                )
                candidates = [
                    stored
                    for stored in (
                        self._from_record(row) for row in dated_rows + legacy_rows
                    )
                    if stored is not None
                ]
                return max(candidates, key=lambda item: item.question_date or item.created_at.date()) if candidates else None
            except RuntimeError as exc:
                logger.error("Supabase answer read failed")
                raise RuntimeError("Answer persistence unavailable") from exc

        for stored in reversed(list(self._iter_answers())):
            if stored.user_id != user_id:
                continue
            if (stored.question_date or stored.created_at.date()) >= before_date:
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
                return [
                    stored
                    for stored in (self._from_record(row) for row in rows)
                    if stored is not None
                ]
            except RuntimeError as exc:
                logger.error("Supabase weekly answer read failed")
                raise RuntimeError("Answer persistence unavailable") from exc

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

    def answers_for_week_instance(
        self, user_id: str, week_instance_id: str, legacy_week_index: int
    ) -> List[StoredAnswer]:
        """Return a dated week while retaining read compatibility for legacy rows."""
        try:
            week_start = date.fromisoformat(week_instance_id.removeprefix("week:"))
        except ValueError as exc:
            raise RuntimeError("Invalid week instance") from exc
        week_end = week_start + timedelta(days=7)
        if self._supabase:
            try:
                rows = self._supabase.select(
                    self._supabase_table,
                    filters={"user_id": user_id, "week_instance_id": week_instance_id},
                    order=("created_at", "asc"),
                )
                dated = [
                    stored
                    for stored in (self._from_record(row) for row in rows)
                    if stored is not None
                ]
                legacy_rows = self._supabase.select(
                    self._supabase_table,
                    filters={"user_id": user_id, "week_index": legacy_week_index},
                    order=("created_at", "asc"),
                )
                legacy = [
                    stored
                    for stored in (self._from_record(row) for row in legacy_rows)
                    if stored is not None
                    and stored.week_instance_id is None
                    and week_start <= stored.created_at.date() < week_end
                ]
                return dated + legacy
            except RuntimeError as exc:
                logger.error("Supabase dated weekly answer read failed")
                raise RuntimeError("Answer persistence unavailable") from exc
        dated = [
            stored
            for stored in self._iter_answers()
            if stored.user_id == user_id and stored.week_instance_id == week_instance_id
        ]
        legacy = [
            stored
            for stored in self._iter_answers()
            if stored.user_id == user_id
            and stored.week_instance_id is None
            and week_start <= stored.created_at.date() < week_end
            and (
                stored.week_index
                if stored.week_index is not None
                else self._week_from_question_id(stored.question_id)
            )
            == legacy_week_index
        ]
        return dated + legacy

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
                answers = [
                    stored
                    for stored in (self._from_record(row) for row in rows)
                    if stored is not None
                ]
                return answers
            except RuntimeError as exc:
                logger.error("Supabase recent answer read failed")
                raise RuntimeError("Answer persistence unavailable") from exc

        answers = [
            stored for stored in self._iter_answers() if stored.user_id == user_id
        ]
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
            question_date_raw = record.get("question_date")
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
                question_instance_id=record.get("question_instance_id"),
                catalog_question_id=record.get("catalog_question_id"),
                question_date=date.fromisoformat(question_date_raw)
                if question_date_raw
                else None,
                question_text=record.get("question_text"),
                question_theme=record.get("question_theme"),
                difficulty_label=record.get("difficulty_label"),
                difficulty_score=(
                    int(record["difficulty_score"])
                    if record.get("difficulty_score") is not None
                    else None
                ),
                difficulty_multiplier=(
                    float(record["difficulty_multiplier"])
                    if record.get("difficulty_multiplier") is not None
                    else None
                ),
                catalog_version=record.get("catalog_version"),
                week_instance_id=record.get("week_instance_id"),
            )
        except Exception:
            return None

    def _disable_supabase(self) -> None:
        self._supabase = None
        self._supabase_table = None
