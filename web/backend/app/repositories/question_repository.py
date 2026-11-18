import json
import re
from datetime import date, timedelta
from pathlib import Path
from typing import Iterator, List

from ..models.question import Question


class QuestionRepository:
    """Maps application dates to versioned catalog slots and immutable instances."""

    CATALOG_EPOCH_YEAR = 2024

    def __init__(self, source_path: Path) -> None:
        self._source_path = source_path
        self._cache: List[Question] | None = None
        self._week_themes: List[str] | None = None
        self._catalog_version: str | None = None

    @property
    def catalog_version(self) -> str:
        self._load_questions()
        return self._catalog_version or "legacy-364-v1"

    def get_daily_question(self, target_date: date) -> Question:
        catalog = self._load_questions()
        if not catalog or not self._week_themes:
            raise RuntimeError("Question bank is empty")
        week_start = target_date - timedelta(days=target_date.weekday())
        schedule_year = week_start.year
        first_week = date(schedule_year, 1, 1)
        first_week -= timedelta(days=first_week.weekday())
        calendar_week = (week_start - first_week).days // 7
        rotation = (schedule_year - self.CATALOG_EPOCH_YEAR) % len(self._week_themes)
        catalog_week = (calendar_week + rotation) % len(self._week_themes)
        day_index = target_date.weekday()
        base = catalog[catalog_week * 7 + day_index]
        version = self.catalog_version
        return Question(
            id=f"question:{target_date.isoformat()}",
            catalog_id=base.catalog_id,
            catalog_version=version,
            prompt=base.prompt,
            theme=base.theme,
            week_index=catalog_week,
            day_index=day_index,
            week_instance_id=f"week:{week_start.isoformat()}",
            available_on=target_date,
        )

    def get_by_id(self, question_id: str) -> Question:
        if question_id.startswith("question:"):
            parts = question_id.split(":", 1)
            if len(parts) == 2:
                try:
                    question = self.get_daily_question(date.fromisoformat(parts[1]))
                except ValueError as exc:
                    raise KeyError(f"Question {question_id} not found") from exc
                return question
        for question in self._load_questions():
            if question.catalog_id == question_id:
                return question
        raise KeyError(f"Question {question_id} not found")

    def _load_questions(self) -> List[Question]:
        if self._cache is not None:
            return self._cache
        data = json.loads(self._source_path.read_text(encoding="utf-8"))
        version = str(data.get("catalogVersion") or "legacy-364-v1").strip()
        if not re.fullmatch(r"[a-zA-Z0-9._-]{1,40}", version):
            raise RuntimeError("Invalid catalog version")
        weeks = data.get("weeks", [])
        if len(weeks) != 52:
            raise RuntimeError("Question catalog must contain exactly 52 weeks")
        questions: List[Question] = []
        themes: List[str] = []
        for week_index, week in enumerate(weeks):
            theme = str(week.get("theme", f"Week {week_index + 1}"))
            prompts = week.get("questions", [])
            if len(prompts) != 7:
                raise RuntimeError(
                    f"Catalog week {week_index + 1} must contain seven questions"
                )
            themes.append(theme)
            for day_index, prompt in enumerate(prompts):
                catalog_id = f"week-{week_index + 1}-day-{day_index + 1}"
                questions.append(
                    Question(
                        id=catalog_id,
                        catalog_id=catalog_id,
                        catalog_version=version,
                        prompt=str(prompt),
                        theme=theme,
                        week_index=week_index,
                        day_index=day_index,
                        week_instance_id="",
                        available_on=date(1970, 1, 1),
                    )
                )
        self._catalog_version = version
        self._week_themes = themes
        self._cache = questions
        return questions

    def iter_all(self) -> Iterator[Question]:
        yield from self._load_questions()

    def total_weeks(self) -> int:
        self._load_questions()
        return len(self._week_themes or [])

    def week_theme(self, week_index: int) -> str:
        self._load_questions()
        if not self._week_themes or not 0 <= week_index < len(self._week_themes):
            raise IndexError("Week index out of range")
        return self._week_themes[week_index]
