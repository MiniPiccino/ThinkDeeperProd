import json
import re
from dataclasses import asdict, dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


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


class AnswerRepository:
    """Persists evaluated answers to a JSONL file for auditability."""

    def __init__(self, storage_path: Path) -> None:
        self._storage_path = storage_path
        self._storage_path.parent.mkdir(parents=True, exist_ok=True)

    def save_answer(self, payload: StoredAnswer) -> None:
        """Append the answer to the storage file."""

        record: Dict[str, Any] = {
            **asdict(payload),
            "created_at": payload.created_at.isoformat(),
        }
        with self._storage_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False))
            handle.write("\n")

    def latest_before(self, user_id: str, before_date: date) -> Optional[StoredAnswer]:
        """Return the most recent answer submitted before a given date for a user."""

        for stored in reversed(list(self._iter_answers())):
            if stored.user_id != user_id:
                continue
            if stored.created_at.date() >= before_date:
                continue
            return stored
        return None

    def answers_for_week(self, user_id: str, week_index: int) -> List[StoredAnswer]:
        """Return all answers recorded for a specific user and week index."""

        matches: List[StoredAnswer] = []
        for stored in self._iter_answers():
            if stored.user_id != user_id:
                continue
            if self._week_from_question_id(stored.question_id) != week_index:
                continue
            matches.append(stored)
        return matches

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
            )
        except Exception:
            return None
