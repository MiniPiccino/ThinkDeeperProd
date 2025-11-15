# ThinkDeeper Frontend

Next.js application that delivers the Thinkle experience in production. It consumes the FastAPI backend to serve daily prompts, capture answers, and display progress.

## Getting started

```bash
npm install
npm run dev
```

The app expects `NEXT_PUBLIC_API_BASE_URL` to point at the backend instance:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### Tests

```bash
npm test
```

### Key features

- Daily prompt retrieval with React Query caching.
- Five-minute timer with local persistence per session.
- Answer submission routed to the FastAPI evaluator.
- XP meter, streak tracking, and feedback surfaces mirroring the MVP.

## Project layout

| Path | Description |
| --- | --- |
| `app/page.tsx` | Main dashboard experience with timer, question, and submission flow. |
| `app/providers.tsx` | React Query provider setup for client components. |
| `components/` | Presentational components such as timer, XP meter, and feedback card. |
| `lib/api.ts` | API client helpers for the backend contract. |

The UI relies on Tailwind (via Next.js 16 template) and keeps logic in client components while server components handle document structure.
