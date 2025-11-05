import json
from datetime import date
from pathlib import Path
from typing import Iterator, List

from ..models.question import Question


class QuestionRepository:
    """Loads question content from a JSON source."""

    def __init__(self, source_path: Path) -> None:
        self._source_path = source_path
        self._cache: List[Question] | None = None

    def get_daily_question(self, target_date: date) -> Question:
        """Return the question assigned for the provided date."""

        questions = self._load_questions()
        if not questions:
            raise RuntimeError("Question bank is empty")

        index = (target_date.timetuple().tm_yday - 1) % len(questions)
        base = questions[index]
        return Question(
            id=base.id,
            prompt=base.prompt,
            theme=base.theme,
            week_index=base.week_index,
            day_index=base.day_index,
            available_on=target_date,
        )

    def get_by_id(self, question_id: str) -> Question:
        questions = self._load_questions()
        for question in questions:
            if question.id == question_id:
                return question
        raise KeyError(f"Question {question_id} not found")

    def _load_questions(self) -> List[Question]:
        if self._cache is not None:
            return self._cache

        data = json.loads(self._source_path.read_text(encoding="utf-8"))
        weeks = data.get("weeks", [])
        questions: List[Question] = []
        for week_index, week in enumerate(weeks):
            theme = week.get("theme", f"Week {week_index + 1}")
            for day_index, prompt in enumerate(week.get("questions", [])):
                questions.append(
                    Question(
                        id=f"week-{week_index + 1}-day-{day_index + 1}",
                        prompt=prompt,
                        theme=theme,
                        week_index=week_index,
                        day_index=day_index,
                        available_on=date.today(),  # placeholder overwritten later
                    )
                )
        self._cache = questions
        return questions

    def iter_all(self) -> Iterator[Question]:
        """Yield every question in the bank."""

        yield from self._load_questions()
