from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import (
    get_entitlement_service,
    get_reflection_service,
    get_settings_dependency,
)
from app.api.routes import router as api_router
from app.config import Settings
from app.repositories import AnswerRepository, QuestionRepository, StoredAnswer, UserRepository
from app.services import EntitlementService, ReflectionService


JWT_SECRET = "premium-test-secret-that-is-long-enough-for-hs256-validation"
FORGED_SECRET = "forged-test-secret-that-is-long-enough-for-hs256-validation"
ISSUER = "https://premium-test.supabase.co/auth/v1"
AUDIENCE = "authenticated"
USER_A = "11111111-1111-4111-8111-111111111111"
USER_B = "22222222-2222-4222-8222-222222222222"


def _token(user_id: str, *, secret: str = JWT_SECRET) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": user_id,
            "role": "authenticated",
            "aud": AUDIENCE,
            "iss": ISSUER,
            "iat": now,
            "exp": now + timedelta(minutes=10),
        },
        secret,
        algorithm="HS256",
    )


def _headers(user_id: str = USER_A, *, secret: str = JWT_SECRET) -> dict[str, str]:
    return {"Authorization": f"Bearer {_token(user_id, secret=secret)}"}


def _write_entitlements(settings: Settings, records: dict[str, dict[str, str]]) -> None:
    settings.user_metadata_path.write_text(json.dumps(records), encoding="utf-8")


def _store_answer(repository: AnswerRepository, user_id: str, answer: str) -> None:
    repository.save_answer(
        StoredAnswer(
            user_id=user_id,
            question_id="week-1-day-1",
            answer=answer,
            feedback="Keep going",
            xp_awarded=10,
            xp_total=10,
            streak=1,
            created_at=datetime.now(timezone.utc),
            duration_seconds=120,
            week_index=0,
        )
    )


def _client(
    settings: Settings,
    answer_repository: AnswerRepository,
    question_repository: QuestionRepository,
) -> TestClient:
    values = settings.model_dump(by_alias=True)
    values.update(
        {
            "SUPABASE_URL": "https://premium-test.supabase.co",
            "SUPABASE_JWT_ISSUER": ISSUER,
            "SUPABASE_JWT_AUDIENCE": AUDIENCE,
            "SUPABASE_JWT_SECRET": JWT_SECRET,
        }
    )
    auth_settings = Settings(**values)
    users = UserRepository(settings.user_metadata_path)
    entitlements = EntitlementService(users)
    reflections = ReflectionService(answer_repository, question_repository, entitlements)

    app = FastAPI()
    app.include_router(api_router)
    app.dependency_overrides[get_settings_dependency] = lambda: auth_settings
    app.dependency_overrides[get_entitlement_service] = lambda: entitlements
    app.dependency_overrides[get_reflection_service] = lambda: reflections
    return TestClient(app)


def test_history_rejects_missing_token(
    tmp_settings: Settings,
    answer_repository: AnswerRepository,
    question_repository: QuestionRepository,
) -> None:
    response = _client(tmp_settings, answer_repository, question_repository).get(
        "/v1/reflections/history"
    )
    assert response.status_code == 401


def test_history_rejects_free_user_even_with_premium_query_indicator(
    tmp_settings: Settings,
    answer_repository: AnswerRepository,
    question_repository: QuestionRepository,
) -> None:
    _write_entitlements(tmp_settings, {USER_A: {"plan": "free"}})
    response = _client(tmp_settings, answer_repository, question_repository).get(
        "/v1/reflections/history?plan=premium&timelineUnlocked=true",
        headers=_headers(),
    )
    assert response.status_code == 403


def test_history_allows_active_premium_user(
    tmp_settings: Settings,
    answer_repository: AnswerRepository,
    question_repository: QuestionRepository,
) -> None:
    _write_entitlements(
        tmp_settings,
        {USER_A: {"plan": "premium", "status": "active", "source": "paddle"}},
    )
    _store_answer(answer_repository, USER_A, "Premium reflection")
    response = _client(tmp_settings, answer_repository, question_repository).get(
        "/v1/reflections/history",
        headers=_headers(),
    )
    assert response.status_code == 200
    assert response.json()[0]["excerpt"] == "Premium reflection"


def test_history_rejects_expired_entitlement(
    tmp_settings: Settings,
    answer_repository: AnswerRepository,
    question_repository: QuestionRepository,
) -> None:
    expired = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
    _write_entitlements(
        tmp_settings,
        {USER_A: {"plan": "premium", "status": "active", "expires_at": expired}},
    )
    response = _client(tmp_settings, answer_repository, question_repository).get(
        "/v1/reflections/history",
        headers=_headers(),
    )
    assert response.status_code == 403


def test_history_rejects_forged_identity(
    tmp_settings: Settings,
    answer_repository: AnswerRepository,
    question_repository: QuestionRepository,
) -> None:
    _write_entitlements(tmp_settings, {USER_A: {"plan": "premium"}})
    response = _client(tmp_settings, answer_repository, question_repository).get(
        "/v1/reflections/history",
        headers=_headers(secret=FORGED_SECRET),
    )
    assert response.status_code == 401


def test_history_is_scoped_to_authenticated_premium_user(
    tmp_settings: Settings,
    answer_repository: AnswerRepository,
    question_repository: QuestionRepository,
) -> None:
    _write_entitlements(
        tmp_settings,
        {
            USER_A: {"plan": "premium", "status": "active"},
            USER_B: {"plan": "premium", "status": "active"},
        },
    )
    _store_answer(answer_repository, USER_A, "Owned by A")
    _store_answer(answer_repository, USER_B, "Private to B")
    response = _client(tmp_settings, answer_repository, question_repository).get(
        f"/v1/reflections/history?userId={USER_B}",
        headers=_headers(USER_A),
    )
    assert response.status_code == 200
    excerpts = [item["excerpt"] for item in response.json()]
    assert excerpts == ["Owned by A"]


def test_history_fails_closed_when_entitlement_store_is_unavailable(
    tmp_settings: Settings,
    answer_repository: AnswerRepository,
    question_repository: QuestionRepository,
) -> None:
    tmp_settings.user_metadata_path.write_text("not-json", encoding="utf-8")
    response = _client(tmp_settings, answer_repository, question_repository).get(
        "/v1/reflections/history",
        headers=_headers(),
    )
    assert response.status_code == 503


def test_overview_hides_premium_capabilities_when_entitlement_store_is_unavailable(
    tmp_settings: Settings,
    answer_repository: AnswerRepository,
    question_repository: QuestionRepository,
) -> None:
    tmp_settings.user_metadata_path.write_text("not-json", encoding="utf-8")
    response = _client(tmp_settings, answer_repository, question_repository).get(
        "/v1/reflections/overview",
        headers=_headers(),
    )
    assert response.status_code == 200
    assert response.json()["plan"] == "free"
    assert response.json()["timelineUnlocked"] is False
