# ThinkDeeper Production Stack

This repository contains the production rework of the Thinkle MVP. The Streamlit prototype has been split into a Next.js frontend (`frontend/`) and a FastAPI backend (`backend/`) so the product can ship on Vercel (frontend) and a container service (backend).

## Services

| Folder | Tech | Purpose |
| --- | --- | --- |
| `frontend/` | Next.js 16 (React 19) | Daily thinking interface, timer, XP meter, and feedback presentation. |
| `backend/` | FastAPI (Python 3.11) | Exposes questions, evaluates answers via OpenAI, and tracks progress. |
| `MVPApp/` | Streamlit | Original prototype kept for reference. |

## Local development

### Backend

```bash
cd backend
poetry install
poetry run uvicorn app.main:app --reload --port 8000
```

Populate `.env` (see `.env.example`) with your `OPENAI_API_KEY` and any custom config.

Run unit tests with:

```bash
poetry run pytest
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_BASE_URL` to the backend URL (defaults to `http://localhost:8000`).

Run component/unit tests with:

```bash
npm test
```

## Deployment flow

1. **Backend**: Build the FastAPI app into a container (Dockerfile TBD) and deploy to your platform of choice (e.g., Railway, Render, Fly.io). Configure environment variables and secrets (OpenAI key, storage paths, etc.).
2. **Frontend**: Deploy to Vercel. Configure the project environment variables so it reaches the backend (production/staging URLs).
3. Add CI (GitHub Actions) to lint, type-check, test, and build both services. Deploy staging first, then promote to production.

## Next steps

- Replace JSON/flat-file persistence with PostgreSQL + Alembic migrations.
- Swap local progress tracking for a durable store (Redis + database) when multi-device sync is required.
- Integrate authentication (Clerk, Auth0, Supabase) so user IDs are secure rather than client-generated.
- Add automated tests: backend unit tests around services and repositories, frontend component/integration tests with Playwright.
