from datetime import date

from app.repositories import ProgressRepository, QuestionRepository
from fastapi.testclient import TestClient


def _expected_prompt(question_repository: QuestionRepository, target_date: date) -> str:
    questions = list(question_repository.iter_all())
    index = (target_date.timetuple().tm_yday - 1) % len(questions)
    return questions[index].prompt


def test_fetch_daily_question(
    test_client: TestClient,
    question_repository: QuestionRepository,
) -> None:
    response = test_client.get("/v1/questions/daily")
    assert response.status_code == 200
    body = response.json()
    expected = _expected_prompt(question_repository, date.today())
    assert body["prompt"] == expected
    assert body["timerSeconds"] == 300
    assert body["weekProgress"]["completedDays"] == 0
    assert "difficulty" in body
    assert "dopamine" in body
    assert body["dopamine"]["curiosityHook"]
    assert "priming" in body
    assert body["priming"]["teaserQuestion"]


def test_submit_answer_updates_progress(
    test_client: TestClient,
    progress_repository: ProgressRepository,
) -> None:
    payload = {
        "questionId": "week-1-day-1",
        "answer": "Thoughtful answer",
        "durationSeconds": 180,
    }
    response = test_client.post("/v1/answers", json=payload)
    assert response.status_code == 200

    body = response.json()
    assert body["xpAwarded"] == 12
    assert body["xpTotal"] == 12
    assert body["bonusXp"] == 0
    assert body["weekCompletedDays"] == 1
    assert body["weekBadgeEarned"] is False
    assert body["level"] == 1

    stored = progress_repository.fetch("anonymous")
    assert stored["xp_total"] == 12
