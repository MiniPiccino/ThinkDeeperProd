from pathlib import Path

from app.scripts.audit_question_catalog import find_collisions


def test_legacy_catalog_duplicate_is_visible_not_silently_changed() -> None:
    source = Path(__file__).parents[1] / "data" / "questions.json"
    collisions = find_collisions(source)
    assert any(
        {item["left"], item["right"]} == {"week-25-day-6", "week-51-day-2"}
        for item in collisions
    )
