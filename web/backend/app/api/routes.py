from typing import Optional, List

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict

from ..models.answer import AnswerCreate, AnswerResult
from ..models.badge import Badge
from ..models.reflection import ReflectionHistoryItem, ReflectionOverview
from ..repositories import EntitlementStoreUnavailable
from .deps import (
    get_answer_service,
    get_badge_service,
    get_billing_service,
    get_entitlement_service,
    get_authenticated_user_id,
    get_optional_user_id,
    get_premium_user_id,
    get_question_service,
    get_reflection_service,
)
from ..services import (
    BillingConflictError,
    BillingConfigError,
    BillingProcessingRetryableError,
    BillingRequestError,
    WebhookVerificationError,
)
from ..services.answer_service import (
    AnswerPersistenceError,
    DuplicateAnswerError,
    InvalidAnswerError,
    InvalidDailyQuestionError,
)
from ..services.evaluation_rate_limiter import EvaluationRateLimitError

router = APIRouter(prefix="/v1", tags=["v1"])


class CheckoutRequest(BaseModel):
    priceId: str | None = None

    model_config = ConfigDict(extra="forbid")


class ClientTokenResponse(BaseModel):
    token: str


class TransactionConfirmRequest(BaseModel):
    transactionId: str


class BillingStatusResponse(BaseModel):
    plan: str
    status: str
    premiumActive: bool
    expiresAt: str | None
    cancelAtPeriodEnd: bool
    managementAvailable: bool


@router.get("/questions/daily")
async def fetch_daily_question(
    question_service=Depends(get_question_service),
    user_id: Optional[str] = Depends(get_optional_user_id),
) -> dict:
    return question_service.daily_question(
        question_service.current_application_date(), user_id
    )


@router.post("/answers", response_model=AnswerResult)
async def submit_answer(
    request: Request,
    payload: AnswerCreate,
    answer_service=Depends(get_answer_service),
    user_id: str = Depends(get_authenticated_user_id),
) -> AnswerResult:
    content_length = request.headers.get("content-length")
    if content_length and (
        not content_length.isdigit() or int(content_length) > 16_384
    ):
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Request body is too large.",
        )
    try:
        return answer_service.submit_answer(
            question_id=payload.question_id,
            answer=payload.answer,
            user_id=user_id,
            duration_seconds=payload.duration_seconds,
        )
    except DuplicateAnswerError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already answered today's prompt. Come back tomorrow for a new question.",
        ) from exc
    except (InvalidAnswerError, InvalidDailyQuestionError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    except EvaluationRateLimitError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Please wait before trying again.",
        ) from exc
    except AnswerPersistenceError as exc:
        cause = exc.__cause__
        if isinstance(cause, EvaluationRateLimitError):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Please wait before trying again.",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Your reflection could not be saved safely.",
        ) from exc


@router.get("/reflections/overview", response_model=ReflectionOverview)
async def reflections_overview(
    reflection_service=Depends(get_reflection_service),
    user_id: str = Depends(get_authenticated_user_id),
    timezone_offset_minutes: int = Query(default=0, alias="timezoneOffsetMinutes"),
) -> ReflectionOverview:
    return reflection_service.overview(user_id, timezone_offset_minutes)


@router.get("/reflections/history", response_model=List[ReflectionHistoryItem])
async def reflections_history(
    reflection_service=Depends(get_reflection_service),
    user_id: str = Depends(get_premium_user_id),
    limit: int = Query(default=50, ge=1, le=200),
    search: Optional[str] = Query(default=None, alias="q"),
) -> List[ReflectionHistoryItem]:
    return reflection_service.history(user_id, limit=limit, search=search)


@router.get("/badges", response_model=List[Badge])
async def list_badges(
    badge_service=Depends(get_badge_service),
    user_id: str = Depends(get_authenticated_user_id),
) -> List[Badge]:
    return badge_service.list_badges(user_id)


@router.post("/billing/checkout")
async def create_checkout_session(
    payload: CheckoutRequest,
    billing_service=Depends(get_billing_service),
    user_id: str = Depends(get_authenticated_user_id),
) -> dict:
    try:
        url = billing_service.create_checkout_session(
            user_id=user_id,
            price_id=payload.priceId,
        )
        return {"checkoutUrl": url}
    except BillingConfigError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is unavailable.",
        ) from exc
    except BillingConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc
    except BillingRequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.get("/billing/status", response_model=BillingStatusResponse)
async def billing_status(
    billing_service=Depends(get_billing_service),
    entitlement_service=Depends(get_entitlement_service),
    user_id: str = Depends(get_authenticated_user_id),
) -> BillingStatusResponse:
    try:
        entitlement = entitlement_service.entitlement_for(user_id)
    except EntitlementStoreUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Premium access cannot be verified right now.",
        ) from exc
    premium_active = entitlement.is_active()
    try:
        subscription = billing_service.get_subscription(user_id)
    except BillingConfigError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing status is unavailable.",
        ) from exc
    scheduled_cancel = bool(
        subscription and subscription.scheduled_change_action == "cancel" and premium_active
    )
    expires_at = (
        subscription.scheduled_change_at
        if scheduled_cancel and subscription
        else entitlement.expires_at
    )
    return BillingStatusResponse(
        plan="premium" if premium_active else "free",
        status=entitlement.status,
        premiumActive=premium_active,
        expiresAt=expires_at.isoformat() if expires_at else None,
        cancelAtPeriodEnd=scheduled_cancel,
        managementAvailable=bool(subscription and not subscription.access_revoked),
    )


@router.post("/billing/manage")
async def manage_subscription(
    billing_service=Depends(get_billing_service),
    user_id: str = Depends(get_authenticated_user_id),
) -> dict:
    try:
        return {"portalUrl": billing_service.create_customer_portal_session(user_id)}
    except BillingConfigError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Subscription management is unavailable.",
        ) from exc
    except BillingRequestError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/billing/client-token", response_model=ClientTokenResponse)
async def create_paddle_client_token(
    billing_service=Depends(get_billing_service),
    _user_id: str = Depends(get_authenticated_user_id),
) -> ClientTokenResponse:
    try:
        token = billing_service.create_client_token()
        return ClientTokenResponse(token=token)
    except BillingConfigError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is unavailable.",
        ) from exc
    except BillingRequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.post("/billing/confirm")
async def confirm_paddle_transaction(
    payload: TransactionConfirmRequest,
    billing_service=Depends(get_billing_service),
    user_id: str = Depends(get_authenticated_user_id),
) -> dict:
    try:
        billing_service.confirm_transaction(
            payload.transactionId, expected_user_id=user_id
        )
        return {"confirmed": True}
    except BillingConfigError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is unavailable.",
        ) from exc
    except BillingProcessingRetryableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing activation is still processing.",
        ) from exc
    except BillingRequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.post("/billing/webhook")
async def paddle_webhook(
    request: Request,
    billing_service=Depends(get_billing_service),
    paddle_signature: Optional[str] = Header(default=None, alias="Paddle-Signature"),
) -> dict:
    payload = await request.body()
    try:
        billing_service.handle_webhook(payload, paddle_signature)
        return {"received": True}
    except WebhookVerificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature."
        ) from exc
    except BillingConfigError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is unavailable.",
        ) from exc
    except BillingProcessingRetryableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook processing should be retried.",
        ) from exc
    except BillingRequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook event."
        ) from exc
