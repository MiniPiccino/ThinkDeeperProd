from fastapi import Depends
from openai import OpenAI

from ..config import Settings, get_settings
from ..integrations.supabase_client import SupabaseClient
from ..repositories import AnswerRepository, ProgressRepository, QuestionRepository
from ..services import AnswerService, EvaluationService, QuestionService

_QUESTION_REPOSITORY: QuestionRepository | None = None
_PROGRESS_REPOSITORY: ProgressRepository | None = None
_ANSWER_REPOSITORY: AnswerRepository | None = None
_OPENAI_CLIENT: OpenAI | None = None
_EVALUATION_SERVICE: EvaluationService | None = None
_QUESTION_SERVICE: QuestionService | None = None
_ANSWER_SERVICE: AnswerService | None = None
_SUPABASE_CLIENT: SupabaseClient | None = None


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
        )
    return _ANSWER_SERVICE


def get_settings_dependency() -> Settings:
    return get_settings()


def get_question_service(settings: Settings = Depends(get_settings_dependency)) -> QuestionService:
    return _question_service(settings)


def get_answer_service(settings: Settings = Depends(get_settings_dependency)) -> AnswerService:
    return _answer_service(settings)
