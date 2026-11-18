from collections.abc import Callable

import httpx
import pytest

from app.integrations.supabase_client import SupabaseClient


MODERN_SECRET_KEY = "sb_secret_test-only-placeholder"
LEGACY_SERVICE_ROLE_KEY = "legacy.test-only.jwt"


def _client_with_capture(
    monkeypatch: pytest.MonkeyPatch,
    response_json: object,
) -> tuple[SupabaseClient, list[httpx.Request]]:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json=response_json)

    transport = httpx.MockTransport(handler)
    httpx_client = httpx.Client
    monkeypatch.setattr(
        "app.integrations.supabase_client.httpx.Client",
        lambda *, timeout: httpx_client(transport=transport, timeout=timeout),
    )
    return SupabaseClient("https://staging-test.supabase.co", MODERN_SECRET_KEY), requests


@pytest.mark.parametrize(
    "operation,response_json",
    [
        (lambda client: client.insert("answers", {"id": "synthetic"}), []),
        (
            lambda client: client.upsert(
                "user_progress", {"user_id": "synthetic"}, "user_id"
            ),
            [],
        ),
        (
            lambda client: client.update(
                "badges", {"earned": True}, {"user_id": "synthetic"}
            ),
            [],
        ),
        (lambda client: client.select("user_plan", limit=1), []),
        (lambda client: client.rpc("synthetic_security_rpc", {}), {}),
    ],
)
def test_modern_secret_key_is_apikey_only_for_every_request_type(
    monkeypatch: pytest.MonkeyPatch,
    operation: Callable[[SupabaseClient], object],
    response_json: object,
) -> None:
    client, requests = _client_with_capture(monkeypatch, response_json)

    operation(client)

    assert len(requests) == 1
    assert requests[0].headers["apikey"] == MODERN_SECRET_KEY
    assert "authorization" not in requests[0].headers


def test_legacy_service_role_key_retains_bearer_header(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json=[])

    transport = httpx.MockTransport(handler)
    httpx_client = httpx.Client
    monkeypatch.setattr(
        "app.integrations.supabase_client.httpx.Client",
        lambda *, timeout: httpx_client(transport=transport, timeout=timeout),
    )
    client = SupabaseClient(
        "https://staging-test.supabase.co", LEGACY_SERVICE_ROLE_KEY
    )

    client.select("answers", limit=1)

    assert requests[0].headers["apikey"] == LEGACY_SERVICE_ROLE_KEY
    assert requests[0].headers["authorization"] == (
        f"Bearer {LEGACY_SERVICE_ROLE_KEY}"
    )


@pytest.mark.parametrize("missing_key", ["", "   "])
def test_missing_server_api_key_is_rejected(missing_key: str) -> None:
    with pytest.raises(ValueError, match="server API key is required"):
        SupabaseClient("https://staging-test.supabase.co", missing_key)
