from datetime import date

from pydantic import BaseModel


class Question(BaseModel):
    """Represents a single daily question."""

    id: str
    prompt: str
    theme: str
    week_index: int
    day_index: int
    available_on: date
