# ThinkDeeper Backend

FastAPI application that powers the Thinkle production frontend. It provides:

- `GET /v1/questions/daily` to fetch the current prompt, theme, and timer metadata.
- `POST /v1/answers` to evaluate a submitted response, award XP, and persist the session.

Private endpoints require a Supabase access token in the `Authorization: Bearer` header. See [`../../docs/AUTHENTICATION.md`](../../docs/AUTHENTICATION.md) for the trust model and rollout requirements.
Paddle Billing architecture, lifecycle policy, migration requirements, and sandbox testing are documented in [`../../docs/BILLING_SECURITY.md`](../../docs/BILLING_SECURITY.md).

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
| `APPLICATION_TIMEZONE` | IANA timezone defining the shared product date; defaults to `UTC`. |
| `EVALUATION_MODEL` | Model used for structured reflection feedback. |
| `EVALUATION_TIMEOUT_SECONDS` | Provider request timeout; defaults to 12 seconds. |
| `EVALUATION_USER_REQUESTS_PER_5_MINUTES` | Per-process user attempt budget; defaults to 3. |
| `EVALUATION_GLOBAL_REQUESTS_PER_MINUTE` | Per-process global attempt budget; defaults to 60. |
| `EVALUATION_MAX_CONCURRENCY` | Per-process concurrent provider-call cap; defaults to 8. |
| `QUESTION_SOURCE` | Path or URL to question data. Defaults to the bundled JSON file. |
| `GOOGLE_SHEETS_ID` | Optional Sheet ID if you want to log answers to Google Sheets. |
| `SUPABASE_URL` | Optional Supabase project URL. When set with the service key, answers/progress are stored in Supabase instead of JSON files. |
| `SUPABASE_SERVICE_KEY` | Service role key used for authenticated Supabase REST calls. |
| `SUPABASE_JWT_ISSUER` | Expected access-token issuer. Defaults to `$SUPABASE_URL/auth/v1`. |
| `SUPABASE_JWT_AUDIENCE` | Expected access-token audience. Defaults to `authenticated`. |
| `SUPABASE_JWKS_URL` | Optional JWKS override. Defaults to the project's Supabase Auth JWKS endpoint. |
| `SUPABASE_JWT_SECRET` | Legacy HS256 signing secret. Required only for projects still using symmetric JWT signing. |
| `SUPABASE_ANSWERS_TABLE` | Table name for persisted answers (defaults to `answers`). |
| `SUPABASE_PROGRESS_TABLE` | Table name for user progress rows (defaults to `user_progress`). |
| `PADDLE_API_KEY` | Secret Paddle Billing API key. Use a sandbox key outside production. |
| `PADDLE_API_URL` | Sandbox or production Paddle Billing API base URL. |
| `PADDLE_PRICE_ID` | Default recurring price accepted by server-created checkout. |
| `PADDLE_ALLOWED_PRICE_IDS` | Comma-separated recurring price allowlist; browser price IDs grant no authority. |
| `PADDLE_WEBHOOK_SECRET` | Endpoint secret for the exact Paddle notification destination. |
| `PADDLE_WEBHOOK_TOLERANCE_SECONDS` | Signature timestamp tolerance; defaults to 5 seconds. |
| `PADDLE_PAST_DUE_GRACE_DAYS` | Premium grace period after past-due status; defaults to 7 days. |

Values are loaded via Pydantic settings (`app/config.py`) so they can be injected through environment variables or cloud secret managers.

Do not use `SUPABASE_ANON_KEY` or `SUPABASE_SERVICE_KEY` as `SUPABASE_JWT_SECRET`.

## Tests

```bash
poetry run pytest
```
