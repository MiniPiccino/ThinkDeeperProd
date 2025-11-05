import json
from typing import Tuple

from openai import OpenAI


class EvaluationService:
    """Talks to OpenAI to score answers and produce feedback."""

    def __init__(self, client: OpenAI, model: str) -> None:
        self._client = client
        self._model = model

    def evaluate(self, question: str, answer: str, duration_seconds: int) -> Tuple[str, int]:
        prompt = (
            "You are a critical thinking coach. Evaluate the answer for depth, clarity, "
            "and originality. Consider how long the user spent writing—more time hints at "
            "reflection but does not guarantee quality. Provide a JSON object with 'feedback' "
            "and 'xp' (integer 1-20). In the feedback string, first celebrate the strongest part of "
            "the answer, then—after the phrase ' Improve:'—offer one short suggestion. Reward mindful, "
            "well-structured answers that match the time investment; penalise shallow responses written quickly. "
            "Keep feedback under 200 characters."
        )
        try:
            response = self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": prompt},
                    {
                        "role": "user",
                        "content": (
                            f"Question: {question}\n"
                            f"Answer: {answer}\n"
                            f"Seconds spent writing: {duration_seconds}"
                        ),
                    },
                ],
                temperature=0.6,
            )
        except Exception as exc:  # pragma: no cover - network failure path
            raise RuntimeError(f"OpenAI evaluation failed: {exc}") from exc

        text = response.choices[0].message.content if response.choices else ""
        if not text:
            raise RuntimeError("Empty response from evaluation service")
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Failed to parse evaluation payload: {text}") from exc

        feedback = data.get("feedback", "").strip()
        xp = int(data.get("xp", 0))
        xp = max(1, min(xp, 20))
        return feedback, xp
