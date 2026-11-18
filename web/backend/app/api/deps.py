from functools import lru_cache

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from openai import OpenAI

from ..config import Settings, get_settings
from ..integrations.supabase_client import SupabaseClient
from ..repositories import (
    AnswerRepository,
    BadgeRepository,
    BillingRepository,
    EntitlementStoreUnavailable,
    ProgressRepository,
    QuestionRepository,
    SupabaseBillingRepository,
    UnavailableBillingRepository,
    UserRepository,
)
from ..security import (
    AuthConfigurationError,
    AuthPrincipal,
    SupabaseTokenVerifier,
    TokenValidationError,
)
from ..services import (
    AnswerService,
    BadgeService,
    BillingService,
    EntitlementService,
    EvaluationService,
    EvaluationRateLimiter,
    PremiumAccess,
    QuestionService,
    ReflectionService,
)

_QUESTION_REPOSITORY: QuestionRepository | None = None
_PROGRESS_REPOSITORY: ProgressRepository | None = None
_ANSWER_REPOSITORY: AnswerRepository | None = None
_BADGE_REPOSITORY: BadgeRepository | None = None
_USER_REPOSITORY: UserRepository | None = None
_BILLING_REPOSITORY: BillingRepository | None = None
_ENTITLEMENT_SERVICE: EntitlementService | None = None
_OPENAI_CLIENT: OpenAI | None = None
_EVALUATION_SERVICE: EvaluationService | None = None
_EVALUATION_RATE_LIMITER: EvaluationRateLimiter | None = None
_QUESTION_SERVICE: QuestionService | None = None
_ANSWER_SERVICE: AnswerService | None = None
_REFLECTION_SERVICE: ReflectionService | None = None
_BADGE_SERVICE: BadgeService | None = None
_SUPABASE_CLIENT: SupabaseClient | None = None
_BILLING_SERVICE: BillingService | None = None
_BEARER_SCHEME = HTTPBearer(auto_error=False)


def _question_repository(settings: Settings) -> QuestionRepository:
    global _QUESTION_REPOSITORY
    if _QUESTION_REPOSITORY is None:
        _QUESTION_REPOSITORY = QuestionRepository(settings.question_source)
    return _QUESTION_REPOSITORY


def _supabase_client(settings: Settings) -> SupabaseClient | None:
    global _SUPABASE_CLIENT
    if settings.supabase_url and settings.supabase_service_key:
        if _SUPABASE_CLIENT is None:
            _SUPABASE_CLIENT = SupabaseClient(
                settings.supabase_url,
                settings.supabase_service_key,
            )
    return _SUPABASE_CLIENT


def _progress_repository(settings: Settings) -> ProgressRepository:
    global _PROGRESS_REPOSITORY
    if _PROGRESS_REPOSITORY is None:
        supabase = _supabase_client(settings)
        _PROGRESS_REPOSITORY = ProgressRepository(
            settings.progress_store_path,
            supabase_client=supabase,
            supabase_table=settings.supabase_progress_table if supabase else None,
        )
    return _PROGRESS_REPOSITORY


def _answer_repository(settings: Settings) -> AnswerRepository:
    global _ANSWER_REPOSITORY
    if _ANSWER_REPOSITORY is None:
        supabase = _supabase_client(settings)
        _ANSWER_REPOSITORY = AnswerRepository(
            settings.answers_store_path,
            supabase_client=supabase,
            supabase_table=settings.supabase_answers_table if supabase else None,
        )
    return _ANSWER_REPOSITORY


def _badge_repository(settings: Settings) -> BadgeRepository:
    global _BADGE_REPOSITORY
    if _BADGE_REPOSITORY is None:
        supabase = _supabase_client(settings)
        _BADGE_REPOSITORY = BadgeRepository(
            settings.badge_store_path,
            supabase_client=supabase,
            supabase_table=settings.supabase_badges_table if supabase else None,
        )
    return _BADGE_REPOSITORY


def _user_repository(settings: Settings) -> UserRepository:
    global _USER_REPOSITORY
    if _USER_REPOSITORY is None:
        supabase = _supabase_client(settings)
        _USER_REPOSITORY = UserRepository(
            settings.user_metadata_path,
            supabase_client=supabase,
            supabase_table=settings.supabase_user_table if supabase else None,
        )
    return _USER_REPOSITORY


def _entitlement_service(settings: Settings) -> EntitlementService:
    global _ENTITLEMENT_SERVICE
    if _ENTITLEMENT_SERVICE is None:
        _ENTITLEMENT_SERVICE = EntitlementService(_user_repository(settings))
    return _ENTITLEMENT_SERVICE


def _billing_repository(settings: Settings) -> BillingRepository:
    global _BILLING_REPOSITORY
    if _BILLING_REPOSITORY is None:
        supabase = _supabase_client(settings)
        _BILLING_REPOSITORY = (
            SupabaseBillingRepository(supabase)
            if supabase is not None
            else UnavailableBillingRepository()
        )
    return _BILLING_REPOSITORY


def _openai_client(settings: Settings) -> OpenAI:
    global _OPENAI_CLIENT
    if _OPENAI_CLIENT is None:
        _OPENAI_CLIENT = OpenAI(
            api_key=settings.openai_api_key,
            timeout=settings.evaluation_timeout_seconds,
            max_retries=1,
        )
    return _OPENAI_CLIENT


def _evaluation_service(settings: Settings) -> EvaluationService:
    global _EVALUATION_SERVICE
    if _EVALUATION_SERVICE is None:
        _EVALUATION_SERVICE = EvaluationService(
            _openai_client(settings), settings.evaluation_model
        )
    return _EVALUATION_SERVICE


def _question_service(settings: Settings) -> QuestionService:
    global _QUESTION_SERVICE
    if _QUESTION_SERVICE is None:
        _QUESTION_SERVICE = QuestionService(
            _question_repository(settings),
            _progress_repository(settings),
            _answer_repository(settings),
            settings,
        )
    return _QUESTION_SERVICE


def _answer_service(settings: Settings) -> AnswerService:
    global _ANSWER_SERVICE, _EVALUATION_RATE_LIMITER
    if _ANSWER_SERVICE is None:
        if _EVALUATION_RATE_LIMITER is None:
            _EVALUATION_RATE_LIMITER = EvaluationRateLimiter(
                settings.evaluation_user_requests_per_5_minutes,
                settings.evaluation_global_requests_per_minute,
                settings.evaluation_max_concurrency,
            )
        _ANSWER_SERVICE = AnswerService(
            _question_repository(settings),
            _evaluation_service(settings),
            _answer_repository(settings),
            _progress_repository(settings),
            _badge_repository(settings),
            _EVALUATION_RATE_LIMITER,
            application_timezone=settings.application_timezone,
        )
    return _ANSWER_SERVICE


def _badge_service(settings: Settings) -> BadgeService:
    global _BADGE_SERVICE
    if _BADGE_SERVICE is None:
        _BADGE_SERVICE = BadgeService(_badge_repository(settings))
    return _BADGE_SERVICE


def _reflection_service(settings: Settings) -> ReflectionService:
    global _REFLECTION_SERVICE
    if _REFLECTION_SERVICE is None:
        _REFLECTION_SERVICE = ReflectionService(
            _answer_repository(settings),
            _question_repository(settings),
            _entitlement_service(settings),
        )
    return _REFLECTION_SERVICE


def _billing_service(settings: Settings) -> BillingService:
    global _BILLING_SERVICE
    if _BILLING_SERVICE is None:
        _BILLING_SERVICE = BillingService(
            _billing_repository(settings),
            settings,
        )
    return _BILLING_SERVICE


def get_settings_dependency() -> Settings:
    return get_settings()


@lru_cache(maxsize=8)
def _token_verifier(
    issuer: str,
    audience: str,
    jwks_url: str,
    legacy_jwt_secret: str | None,
) -> SupabaseTokenVerifier:
    return SupabaseTokenVerifier(
        issuer=issuer,
        audience=audience,
        jwks_url=jwks_url,
        legacy_jwt_secret=legacy_jwt_secret,
    )


def get_token_verifier(
    settings: Settings = Depends(get_settings_dependency),
) -> SupabaseTokenVerifier:
    if not settings.supabase_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured.",
        )
    auth_base = f"{settings.supabase_url.rstrip('/')}/auth/v1"
    issuer = (settings.supabase_jwt_issuer or auth_base).rstrip("/")
    jwks_url = settings.supabase_jwks_url or f"{auth_base}/.well-known/jwks.json"
    return _token_verifier(
        issuer,
        settings.supabase_jwt_audience,
        jwks_url,
        settings.supabase_jwt_secret.get_secret_value()
        if settings.supabase_jwt_secret
        else None,
    )


def get_optional_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(_BEARER_SCHEME),
    settings: Settings = Depends(get_settings_dependency),
) -> AuthPrincipal | None:
    """Return a verified user principal, or None only when no credentials were supplied."""
    if credentials is None:
        return None
    if credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization must use the Bearer scheme.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        verifier = get_token_verifier(settings)
        return verifier.verify(credentials.credentials)
    except AuthConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured for this token type.",
        ) from exc
    except TokenValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def require_principal(
    principal: AuthPrincipal | None = Depends(get_optional_principal),
) -> AuthPrincipal:
    if principal is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in to continue.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return principal


def get_optional_user_id(
    principal: AuthPrincipal | None = Depends(get_optional_principal),
) -> str | None:
    return principal.user_id if principal else None


def get_authenticated_user_id(
    principal: AuthPrincipal = Depends(require_principal),
) -> str:
    return principal.user_id


def get_entitlement_service(
    settings: Settings = Depends(get_settings_dependency),
) -> EntitlementService:
    return _entitlement_service(settings)


def require_premium_access(
    principal: AuthPrincipal = Depends(require_principal),
    entitlement_service: EntitlementService = Depends(get_entitlement_service),
) -> PremiumAccess:
    try:
        access = entitlement_service.premium_access_for(principal.user_id)
    except EntitlementStoreUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Premium access cannot be verified right now.",
        ) from exc
    if access is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="An active premium entitlement is required.",
        )
    return access


def get_premium_user_id(access: PremiumAccess = Depends(require_premium_access)) -> str:
    return access.user_id


def get_question_service(
    settings: Settings = Depends(get_settings_dependency),
) -> QuestionService:
    return _question_service(settings)


def get_answer_service(
    settings: Settings = Depends(get_settings_dependency),
) -> AnswerService:
    return _answer_service(settings)


def get_reflection_service(
    settings: Settings = Depends(get_settings_dependency),
) -> ReflectionService:
    return _reflection_service(settings)


def get_badge_service(
    settings: Settings = Depends(get_settings_dependency),
) -> BadgeService:
    return _badge_service(settings)


def get_billing_service(
    settings: Settings = Depends(get_settings_dependency),
) -> BillingService:
    return _billing_service(settings)
