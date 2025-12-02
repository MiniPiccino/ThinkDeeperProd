from datetime import datetime

from pydantic import BaseModel, Field


class Badge(BaseModel):
  id: str
  userId: str = Field(alias="user_id")
  weekIndex: int = Field(alias="week_index")
  theme: str
  name: str
  earnedAt: datetime = Field(alias="earned_at")

  class Config:
    populate_by_name = True
