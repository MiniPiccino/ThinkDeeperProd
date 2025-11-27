from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from pydantic import BaseModel

from ..models.answer import AnswerCreate, AnswerResult
from ..models.reflection import ReflectionHistoryItem, ReflectionOverview
from .deps import get_answer_service, get_billing_service, get_question_service, get_reflection_service
from ..services import BillingConfigError
from ..services.answer_service import DuplicateAnswerError

router = APIRouter(prefix="/v1", tags=["v1"])


class CheckoutRequest(BaseModel):
    userId: str
    successUrl: str | None = None
    cancelUrl: str | None = None


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


@router.get("/reflections/overview", response_model=ReflectionOverview)
async def reflections_overview(
    reflection_service=Depends(get_reflection_service),
    user_id: Optional[str] = Query(default=None, alias="userId"),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    timezone_offset_minutes: int = Query(default=0, alias="timezoneOffsetMinutes"),
) -> ReflectionOverview:
    resolved_user = user_id or x_user_id
    if not resolved_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User identifier required.")
    return reflection_service.overview(resolved_user, timezone_offset_minutes)


@router.get("/reflections/history", response_model=List[ReflectionHistoryItem])
async def reflections_history(
    reflection_service=Depends(get_reflection_service),
    user_id: Optional[str] = Query(default=None, alias="userId"),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    limit: int = Query(default=50, ge=1, le=200),
    search: Optional[str] = Query(default=None, alias="q"),
) -> List[ReflectionHistoryItem]:
    resolved_user = user_id or x_user_id
    if not resolved_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User identifier required.")
    return reflection_service.history(resolved_user, limit=limit, search=search)


@router.post("/billing/checkout")
async def create_checkout_session(
    payload: CheckoutRequest,
    billing_service=Depends(get_billing_service),
) -> dict:
    try:
        url = billing_service.create_checkout_session(
            user_id=payload.userId,
            success_url=payload.successUrl,
            cancel_url=payload.cancelUrl,
        )
        return {"checkoutUrl": url}
    except BillingConfigError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - surface Stripe errors
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/billing/webhook")
async def stripe_webhook(
    request: Request,
    billing_service=Depends(get_billing_service),
    stripe_signature: Optional[str] = Header(default=None, alias="Stripe-Signature"),
) -> dict:
    payload = await request.body()
    try:
        billing_service.handle_webhook(payload, stripe_signature)
        return {"received": True}
    except BillingConfigError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - Stripe validation errors
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
