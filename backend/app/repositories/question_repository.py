import json
import bisect
from datetime import date, datetime
from pathlib import Path
from typing import Iterator, List, Optional

from ..models.question import Question


class QuestionRepository:
    """Loads question content from a JSON source."""

    def __init__(self, source_path: Path) -> None:
        self._source_path = source_path
        self._cache: List[Question] | None = None
        self._offsets: List[int] | None = None

    def get_daily_question(self, target_date: date) -> Question:
        """Return the question assigned for the provided date."""

        questions = self._load_questions()
        if not questions:
            raise RuntimeError("Question bank is empty")

        base = self._question_for_date(target_date, questions)
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
        offsets: List[int] = []
        sequential_day = 1

        for week_index, week in enumerate(weeks):
            theme = week.get("theme", f"Week {week_index + 1}")
            start_str = week.get("startDate")
            if start_str:
                try:
                    start_dt = datetime.strptime(start_str, "%Y-%m-%d").date()
                    week_start_day = start_dt.timetuple().tm_yday
                except ValueError:
                    week_start_day = sequential_day
            else:
                week_start_day = sequential_day

            questions_this_week = week.get("questions", [])
            for day_index, prompt in enumerate(questions_this_week):
                offsets.append(week_start_day + day_index)
                questions.append(
                    Question(
                        id=f"week-{week_index + 1}-day-{day_index + 1}",
                        prompt=prompt,
                        theme=theme,
                        week_index=week_index,
                        day_index=day_index,
                        available_on=date.today(),
                    )
                )

            sequential_day = week_start_day + max(len(questions_this_week), 1)

        self._cache = questions
        self._offsets = offsets
        return questions

    def iter_all(self) -> Iterator[Question]:
        """Yield every question in the bank."""

        yield from self._load_questions()

    def _question_for_date(self, target_date: date, questions: List[Question]) -> Question:
        """Map the requested date to the correct week/day entry based on configured start dates."""

        offsets = self._offsets or list(range(1, len(questions) + 1))
        if not offsets:
            raise RuntimeError("Question schedule is empty")

        day_of_year = target_date.timetuple().tm_yday
        insert_pos = bisect.bisect_right(offsets, day_of_year)
        if insert_pos == 0:
            index = len(offsets) - 1
        elif insert_pos == len(offsets) and day_of_year > offsets[-1]:
            index = 0
        else:
            index = insert_pos - 1

        index = min(max(index, 0), len(questions) - 1)
        return questions[index]
