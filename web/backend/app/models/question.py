from datetime import date

from pydantic import BaseModel


class Question(BaseModel):
    """An immutable dated instance backed by one reusable catalog slot."""

    id: str
    catalog_id: str
    catalog_version: str
    prompt: str
    theme: str
    week_index: int
    day_index: int
    week_instance_id: str
    available_on: date
