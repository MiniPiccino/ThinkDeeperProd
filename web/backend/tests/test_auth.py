from __future__ import annotations

from datetime import datetime, timedelta, timezone
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_answer_service, get_question_service, get_settings_dependency
from app.api.routes import router as api_router
from app.config import Settings
from app.repositories import ProgressRepository
from app.security import SupabaseTokenVerifier
from app.services import AnswerService, QuestionService


JWT_SECRET = "test-only-secret-that-is-long-enough-for-hs256-and-hs384-validation"
ISSUER = "https://test-project.supabase.co/auth/v1"
AUDIENCE = "authenticated"
USER_A = "11111111-1111-4111-8111-111111111111"
USER_B = "22222222-2222-4222-8222-222222222222"


def _token(
    user_id: str = USER_A,
    *,
    expires_delta: timedelta = timedelta(minutes=10),
    secret: str = JWT_SECRET,
    audience: str = AUDIENCE,
    issuer: str = ISSUER,
    algorithm: str = "HS256",
) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": user_id,
            "role": "authenticated",
            "aud": audience,
            "iss": issuer,
            "iat": now,
            "exp": now + expires_delta,
        },
        secret,
        algorithm=algorithm,
    )


@pytest.fixture
def auth_settings(tmp_settings: Settings) -> Settings:
    values = tmp_settings.model_dump(by_alias=True)
    values.update(
        {
            "SUPABASE_URL": "https://test-project.supabase.co",
            "SUPABASE_JWT_ISSUER": ISSUER,
            "SUPABASE_JWT_AUDIENCE": AUDIENCE,
            "SUPABASE_JWT_SECRET": JWT_SECRET,
        }
    )
    return Settings(**values)


@pytest.fixture
def auth_client(
    auth_settings: Settings,
    question_service: QuestionService,
    answer_service: AnswerService,
) -> TestClient:
    app = FastAPI()
    app.include_router(api_router)
    app.dependency_overrides[get_settings_dependency] = lambda: auth_settings
    app.dependency_overrides[get_question_service] = lambda: question_service
    app.dependency_overrides[get_answer_service] = lambda: answer_service
    return TestClient(app)


def _auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_private_endpoint_rejects_unauthenticated_request(auth_client: TestClient) -> None:
    response = auth_client.post(
        "/v1/answers",
        json={"questionId": "week-1-day-1", "answer": "Thoughtful", "durationSeconds": 60},
    )
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [
        ("post", "/v1/answers", {"questionId": "week-1-day-1", "answer": "A", "durationSeconds": 1}),
        ("get", "/v1/reflections/overview", None),
        ("get", "/v1/reflections/history", None),
        ("get", "/v1/badges", None),
        ("post", "/v1/billing/checkout", {}),
        ("post", "/v1/billing/client-token", {}),
        ("post", "/v1/billing/confirm", {"transactionId": "txn_test"}),
    ],
)
def test_all_private_routes_require_authentication(
    auth_client: TestClient,
    method: str,
    path: str,
    payload: dict[str, object] | None,
) -> None:
    response = auth_client.request(method, path, json=payload)
    assert response.status_code == 401


def test_private_endpoint_rejects_invalid_signature(auth_client: TestClient) -> None:
    response = auth_client.post(
        "/v1/answers",
        headers=_auth_header(_token(secret="different-test-secret-that-is-long-enough")),
        json={"questionId": "week-1-day-1", "answer": "Thoughtful", "durationSeconds": 60},
    )
    assert response.status_code == 401


def test_private_endpoint_rejects_expired_token(auth_client: TestClient) -> None:
    response = auth_client.post(
        "/v1/answers",
        headers=_auth_header(_token(expires_delta=timedelta(minutes=-1))),
        json={"questionId": "week-1-day-1", "answer": "Thoughtful", "durationSeconds": 60},
    )
    assert response.status_code == 401


@pytest.mark.parametrize(
    "token",
    [
        _token(audience="another-audience"),
        _token(issuer="https://another-project.supabase.co/auth/v1"),
        _token(algorithm="HS384"),
    ],
)
def test_private_endpoint_rejects_wrong_audience_issuer_or_algorithm(
    auth_client: TestClient,
    token: str,
) -> None:
    response = auth_client.post(
        "/v1/answers",
        headers=_auth_header(token),
        json={"questionId": "week-1-day-1", "answer": "Thoughtful", "durationSeconds": 60},
    )
    assert response.status_code == 401


def test_valid_token_uses_verified_subject(
    auth_client: TestClient,
    progress_repository: ProgressRepository,
    question_repository,
) -> None:
    question_id = question_repository.get_daily_question(datetime.now(timezone.utc).date()).id
    response = auth_client.post(
        "/v1/answers",
        headers=_auth_header(_token()),
        json={"questionId": question_id, "answer": "Thoughtful", "durationSeconds": 60},
    )
    assert response.status_code == 200
    assert progress_repository.fetch(USER_A)["xp_total"] > 0
    assert progress_repository.fetch(USER_B)["xp_total"] == 0


def test_client_supplied_user_id_is_rejected(
    auth_client: TestClient,
    progress_repository: ProgressRepository,
) -> None:
    response = auth_client.post(
        "/v1/answers",
        headers=_auth_header(_token()),
        json={
            "questionId": "week-1-day-1",
            "answer": "Thoughtful",
            "durationSeconds": 60,
            "userId": USER_B,
        },
    )
    assert response.status_code == 422
    assert progress_repository.fetch(USER_A)["xp_total"] == 0
    assert progress_repository.fetch(USER_B)["xp_total"] == 0


def test_query_user_id_cannot_select_another_users_progress(
    auth_client: TestClient,
    progress_repository: ProgressRepository,
) -> None:
    now = datetime.now(timezone.utc)
    progress_repository.update(USER_A, 5, now)
    progress_repository.update(USER_B, 19, now)

    response = auth_client.get(
        f"/v1/questions/daily?userId={USER_B}",
        headers=_auth_header(_token(USER_A)),
    )
    assert response.status_code == 200
    assert response.json()["xpTotal"] == 5


def test_public_daily_question_allows_no_session(auth_client: TestClient) -> None:
    response = auth_client.get("/v1/questions/daily")
    assert response.status_code == 200
    assert response.json()["xpTotal"] == 0


def test_token_subject_must_be_supabase_uuid(auth_client: TestClient) -> None:
    response = auth_client.post(
        "/v1/answers",
        headers=_auth_header(_token("attacker-controlled-id")),
        json={"questionId": "week-1-day-1", "answer": "Thoughtful", "durationSeconds": 60},
    )
    assert response.status_code == 401


def test_asymmetric_token_uses_jwks_signing_key() -> None:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": USER_A,
            "role": "authenticated",
            "aud": AUDIENCE,
            "iss": ISSUER,
            "iat": now,
            "exp": now + timedelta(minutes=10),
        },
        private_key,
        algorithm="RS256",
        headers={"kid": "test-key"},
    )
    verifier = SupabaseTokenVerifier(
        issuer=ISSUER,
        audience=AUDIENCE,
        jwks_url="https://test-project.supabase.co/auth/v1/.well-known/jwks.json",
    )
    verifier._jwks_client = type(  # type: ignore[attr-defined]
        "StaticJwksClient",
        (),
        {"get_signing_key_from_jwt": lambda self, raw: type("Key", (), {"key": private_key.public_key()})()},
    )()

    principal = verifier.verify(token)

    assert principal.user_id == USER_A
