from fastapi import Depends
from openai import OpenAI

from ..config import Settings, get_settings
from ..integrations.supabase_client import SupabaseClient
from ..repositories import AnswerRepository, BadgeRepository, ProgressRepository, QuestionRepository, UserRepository
from ..services import AnswerService, BadgeService, BillingService, EvaluationService, QuestionService, ReflectionService

_QUESTION_REPOSITORY: QuestionRepository | None = None
_PROGRESS_REPOSITORY: ProgressRepository | None = None
_ANSWER_REPOSITORY: AnswerRepository | None = None
_BADGE_REPOSITORY: BadgeRepository | None = None
_USER_REPOSITORY: UserRepository | None = None
_OPENAI_CLIENT: OpenAI | None = None
_EVALUATION_SERVICE: EvaluationService | None = None
_QUESTION_SERVICE: QuestionService | None = None
_ANSWER_SERVICE: AnswerService | None = None
_REFLECTION_SERVICE: ReflectionService | None = None
_BADGE_SERVICE: BadgeService | None = None
_SUPABASE_CLIENT: SupabaseClient | None = None
_BILLING_SERVICE: BillingService | None = None


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


def _openai_client(settings: Settings) -> OpenAI:
    global _OPENAI_CLIENT
    if _OPENAI_CLIENT is None:
        _OPENAI_CLIENT = OpenAI(api_key=settings.openai_api_key)
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
    global _ANSWER_SERVICE
    if _ANSWER_SERVICE is None:
        _ANSWER_SERVICE = AnswerService(
            _question_repository(settings),
            _evaluation_service(settings),
            _answer_repository(settings),
            _progress_repository(settings),
            _badge_repository(settings),
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
            _user_repository(settings),
        )
    return _REFLECTION_SERVICE


def _billing_service(settings: Settings) -> BillingService:
    global _BILLING_SERVICE
    if _BILLING_SERVICE is None:
        _BILLING_SERVICE = BillingService(
            _user_repository(settings),
            settings,
        )
    return _BILLING_SERVICE


def get_settings_dependency() -> Settings:
    return get_settings()


def get_question_service(settings: Settings = Depends(get_settings_dependency)) -> QuestionService:
    return _question_service(settings)


def get_answer_service(settings: Settings = Depends(get_settings_dependency)) -> AnswerService:
    return _answer_service(settings)


def get_reflection_service(settings: Settings = Depends(get_settings_dependency)) -> ReflectionService:
    return _reflection_service(settings)


def get_badge_service(settings: Settings = Depends(get_settings_dependency)) -> BadgeService:
    return _badge_service(settings)


def get_billing_service(settings: Settings = Depends(get_settings_dependency)) -> BillingService:
    return _billing_service(settings)
