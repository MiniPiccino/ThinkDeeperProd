from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from ..models.answer import AnswerCreate, AnswerResult
from .deps import get_answer_service, get_question_service
from ..services.answer_service import DuplicateAnswerError

router = APIRouter(prefix="/v1", tags=["v1"])


@router.get("/questions/daily")
async def fetch_daily_question(
    question_service=Depends(get_question_service),
    user_id: Optional[str] = Query(default=None, alias="userId"),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> dict:
    resolved_user = user_id or x_user_id
    return question_service.daily_question(date.today(), resolved_user)


@router.post("/answers", response_model=AnswerResult)
async def submit_answer(
    payload: AnswerCreate,
    answer_service=Depends(get_answer_service),
) -> AnswerResult:
    try:
        return answer_service.submit_answer(
            question_id=payload.question_id,
            answer=payload.answer,
            user_id=payload.user_id,
            duration_seconds=payload.duration_seconds,
        )
    except DuplicateAnswerError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already answered today's prompt. Come back tomorrow for a new question.",
        ) from exc
