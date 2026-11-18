import argparse
import json
import re
from difflib import SequenceMatcher
from pathlib import Path


def find_collisions(path: Path, threshold: float = 0.92) -> list[dict[str, object]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    prompts: list[tuple[str, str]] = []
    for week_index, week in enumerate(data.get("weeks", [])):
        for day_index, prompt in enumerate(week.get("questions", [])):
            catalog_id = f"week-{week_index + 1}-day-{day_index + 1}"
            normalized = re.sub(r"[^a-z0-9]+", " ", str(prompt).lower()).strip()
            prompts.append((catalog_id, normalized))
    collisions: list[dict[str, object]] = []
    for index, (left_id, left) in enumerate(prompts):
        for right_id, right in prompts[index + 1 :]:
            similarity = SequenceMatcher(None, left, right).ratio()
            if similarity >= threshold:
                collisions.append(
                    {
                        "left": left_id,
                        "right": right_id,
                        "similarity": round(similarity, 4),
                    }
                )
    return collisions


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Reject exact and near-duplicate catalog questions."
    )
    parser.add_argument("path", type=Path)
    parser.add_argument("--threshold", type=float, default=0.92)
    args = parser.parse_args()
    collisions = find_collisions(args.path, args.threshold)
    print(json.dumps(collisions, indent=2))
    return 1 if collisions else 0


if __name__ == "__main__":
    raise SystemExit(main())
