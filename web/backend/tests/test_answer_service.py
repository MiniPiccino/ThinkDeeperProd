from concurrent.futures import ThreadPoolExecutor
from datetime import date

import pytest

from app.models.answer import AnswerResult
from app.services import AnswerService
from app.services.answer_service import (
    DuplicateAnswerError,
    InvalidAnswerError,
    InvalidDailyQuestionError,
)
from app.services.evaluation_service import EvaluationUnavailable


def daily_id(service: AnswerService) -> str:
    return service._question_repository.get_daily_question(date.today()).id


def test_answer_submission_persists_with_deterministic_xp(
    answer_service: AnswerService,
) -> None:
    result = answer_service.submit_answer(
        daily_id(answer_service), "Brief but thoughtful.", "tester", 99999
    )
    assert isinstance(result, AnswerResult)
    assert result.feedback.startswith("Tight")
    assert result.base_xp >= AnswerService.PARTICIPATION_XP
    assert result.xp_total == result.xp_awarded
    assert result.streak == 1


def test_wrong_daily_question_rejected_before_model(
    answer_service: AnswerService,
) -> None:
    with pytest.raises(InvalidDailyQuestionError):
        answer_service.submit_answer("not-today", "Thoughtful", "tester", 10)


def test_whitespace_rejected(answer_service: AnswerService) -> None:
    with pytest.raises(InvalidAnswerError):
        answer_service.submit_answer(daily_id(answer_service), "   ", "tester", 10)


def test_duplicate_is_rejected(answer_service: AnswerService) -> None:
    question_id = daily_id(answer_service)
    answer_service.submit_answer(question_id, "First", "same-user", 10)
    with pytest.raises(DuplicateAnswerError):
        answer_service.submit_answer(question_id, "Second", "same-user", 10)


def test_concurrent_duplicate_evaluates_only_once(
    answer_service: AnswerService,
) -> None:
    question_id = daily_id(answer_service)
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [
            pool.submit(
                answer_service.submit_answer, question_id, "Answer", "race-user", 10
            )
            for _ in range(2)
        ]
    outcomes = []
    for future in futures:
        try:
            outcomes.append(type(future.result()).__name__)
        except DuplicateAnswerError:
            outcomes.append("duplicate")
    assert sorted(outcomes) == ["AnswerResult", "duplicate"]


def test_model_failure_saves_neutral_participation_result(
    answer_service: AnswerService, monkeypatch: pytest.MonkeyPatch
) -> None:
    def unavailable(*args: object, **kwargs: object) -> None:
        raise EvaluationUnavailable("timeout")

    monkeypatch.setattr(answer_service._evaluation_service, "evaluate", unavailable)
    result = answer_service.submit_answer(
        daily_id(answer_service), "A real reflection", "fallback-user", 10
    )
    assert result.feedback.startswith("Reflection saved")
    assert result.base_xp >= AnswerService.PARTICIPATION_XP
