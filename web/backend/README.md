# ThinkDeeper Backend

FastAPI application that powers the Thinkle production frontend. It provides:

- `GET /v1/questions/daily` to fetch the current prompt, theme, and timer metadata.
- `POST /v1/answers` to evaluate a submitted response, award XP, and persist the session.

## Quick start

```bash
poetry install
poetry run uvicorn app.main:app --reload
```

Create a `.env` file (or configure environment variables through your platform) with:

```
OPENAI_API_KEY=sk-...
GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account", ...}'  # optional if using Sheets
```

## Configuration

| Variable | Description |
| --- | --- |
| `OPENAI_API_KEY` | Required key for the evaluation service. |
| `QUESTION_SOURCE` | Path or URL to question data. Defaults to the bundled JSON file. |
| `GOOGLE_SHEETS_ID` | Optional Sheet ID if you want to log answers to Google Sheets. |
| `SUPABASE_URL` | Optional Supabase project URL. When set with the service key, answers/progress are stored in Supabase instead of JSON files. |
| `SUPABASE_SERVICE_KEY` | Service role key used for authenticated Supabase REST calls. |
| `SUPABASE_ANSWERS_TABLE` | Table name for persisted answers (defaults to `answers`). |
| `SUPABASE_PROGRESS_TABLE` | Table name for user progress rows (defaults to `user_progress`). |

Values are loaded via Pydantic settings (`app/config.py`) so they can be injected through environment variables or cloud secret managers.

## Tests

```bash
poetry run pytest
```
