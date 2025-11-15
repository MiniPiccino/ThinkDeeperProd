import json
from pathlib import Path
from typing import Callable, Generator

import pytest

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import router as api_router
from app.api.deps import get_answer_service, get_question_service
from app.config import Settings
from app.repositories import AnswerRepository, ProgressRepository, QuestionRepository
from app.services import AnswerService, EvaluationService, QuestionService


@pytest.fixture
def tmp_settings(tmp_path: Path) -> Settings:
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    question_source = data_dir / "questions.json"
    question_source.write_text(
        json.dumps(
            {
                "weeks": [
                    {
                        "theme": "Week 1",
                        "questions": ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7"],
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    return Settings(
        OPENAI_API_KEY="test",
        QUESTION_SOURCE=question_source,
        ANSWERS_STORE_PATH=data_dir / "answers.jsonl",
        PROGRESS_STORE_PATH=data_dir / "progress.json",
        ALLOWED_ORIGINS=["http://testserver"],
    )


@pytest.fixture
def question_repository(tmp_settings: Settings) -> QuestionRepository:
    return QuestionRepository(tmp_settings.question_source)


@pytest.fixture
def progress_repository(tmp_settings: Settings) -> ProgressRepository:
    return ProgressRepository(tmp_settings.progress_store_path)


@pytest.fixture
def answer_repository(tmp_settings: Settings) -> AnswerRepository:
    return AnswerRepository(tmp_settings.answers_store_path)


class DummyCompletionResponse:
    def __init__(self, payload: str) -> None:
        self.choices = [
            type(
                "Choice",
                (),
                {
                    "message": type("Message", (), {"content": payload}),
                },
            )()
        ]


class DummyCompletions:
    def __init__(self, handler: Callable[[str, str], str]) -> None:
        self._handler = handler

    def create(self, *, messages, model, temperature) -> DummyCompletionResponse:  # type: ignore[override]
        question_line = messages[1]["content"].split("\n")[0].replace("Question: ", "")
        answer_line = messages[1]["content"].split("\n")[1].replace("Answer: ", "")
        payload = self._handler(question_line, answer_line)
        return DummyCompletionResponse(payload)


class DummyChat:
    def __init__(self, handler: Callable[[str, str], str]) -> None:
        self.completions = DummyCompletions(handler)


class DummyClient:
    def __init__(self, handler: Callable[[str, str], str]) -> None:
        self.chat = DummyChat(handler)


@pytest.fixture
def evaluation_service(tmp_settings: Settings) -> EvaluationService:
    handler = lambda question, answer: json.dumps({"feedback": f"Tight {question}", "xp": 12})
    client = DummyClient(handler)
    return EvaluationService(client, tmp_settings.evaluation_model)


@pytest.fixture
def question_service(
    question_repository: QuestionRepository,
    progress_repository: ProgressRepository,
    answer_repository: AnswerRepository,
    tmp_settings: Settings,
) -> QuestionService:
    return QuestionService(
        question_repository,
        progress_repository,
        answer_repository,
        tmp_settings,
    )


@pytest.fixture
def answer_service(
    question_repository: QuestionRepository,
    evaluation_service: EvaluationService,
    answer_repository: AnswerRepository,
    progress_repository: ProgressRepository,
) -> AnswerService:
    return AnswerService(
        question_repository,
        evaluation_service,
        answer_repository,
        progress_repository,
    )


@pytest.fixture
def test_client(
    question_service: QuestionService,
    answer_service: AnswerService,
) -> Generator[TestClient, None, None]:
    app = FastAPI()
    app.include_router(api_router)
    app.dependency_overrides[get_question_service] = lambda: question_service
    app.dependency_overrides[get_answer_service] = lambda: answer_service

    with TestClient(app) as client:
        yield client
