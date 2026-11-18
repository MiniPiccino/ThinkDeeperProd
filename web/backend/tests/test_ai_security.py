import json
from pathlib import Path

import pytest

from app.services.evaluation_rate_limiter import (
    EvaluationRateLimitError,
    EvaluationRateLimiter,
)


def test_user_and_global_rate_limits() -> None:
    now = 1000.0
    limiter = EvaluationRateLimiter(2, 3, 3, clock=lambda: now)
    limiter.acquire("a")
    limiter.release()
    limiter.acquire("a")
    limiter.release()
    with pytest.raises(EvaluationRateLimitError):
        limiter.acquire("a")
    limiter.acquire("b")
    limiter.release()
    with pytest.raises(EvaluationRateLimitError):
        limiter.acquire("c")


def test_benchmark_is_synthetic_and_covers_required_classes() -> None:
    fixture = Path(__file__).parent / "fixtures" / "evaluation_benchmark.json"
    rows = json.loads(fixture.read_text(encoding="utf-8"))
    kinds = {row["kind"] for row in rows}
    assert {
        "thoughtful_short",
        "meaningless_long",
        "contradictory",
        "strong_argument",
        "weak_argument",
        "non_english",
        "prompt_injection",
        "invalid_empty",
        "invalid_malformed",
    } <= kinds
    assert all("user_id" not in row and "email" not in row for row in rows)
