import json

import pytest

from app.services.evaluation_service import EvaluationService


class EchoClient:
    def __init__(self, payload: str) -> None:
        self._payload = payload
        self.chat = self.Chat(self)

    class Chat:
        def __init__(self, outer: "EchoClient") -> None:
            self.completions = EchoClient.Completions(outer)

    class Completions:
        def __init__(self, outer: "EchoClient") -> None:
            self._outer = outer

        def create(self, *_, **__) -> object:  # type: ignore[override]
            return type(
                "Response",
                (),
                {
                    "choices": [
                        type(
                            "Choice",
                            (),
                            {"message": type("Message", (), {"content": self._outer._payload})},
                        )()
                    ]
                },
            )()


def test_evaluation_service_parses_payload() -> None:
    payload = json.dumps({"feedback": "Good job", "xp": 18})
    service = EvaluationService(EchoClient(payload), "fake-model")
    feedback, xp = service.evaluate("Question?", "Answer.", 200)
    assert feedback == "Good job"
    assert xp == 18


def test_evaluation_service_clamps_xp() -> None:
    payload = json.dumps({"feedback": "Overachiever", "xp": 999})
    service = EvaluationService(EchoClient(payload), "fake-model")
    _, xp = service.evaluate("Q", "A", 20)
    assert xp == 20


def test_evaluation_service_minimum_xp() -> None:
    payload = json.dumps({"feedback": "Needs work", "xp": 0})
    service = EvaluationService(EchoClient(payload), "fake-model")
    _, xp = service.evaluate("Q", "A", 0)
    assert xp == 1


def test_evaluation_service_raises_on_invalid_json() -> None:
    service = EvaluationService(EchoClient("not-json"), "fake-model")
    with pytest.raises(RuntimeError):
        service.evaluate("Q", "A", 10)
