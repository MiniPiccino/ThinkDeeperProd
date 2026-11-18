# ThinkDeeper Frontend

Next.js application that delivers the Thinkle experience in production. It consumes the FastAPI backend to serve daily reflections, capture answers, and display progress.

## Getting started

```bash
npm install
npm run dev
```

The app expects `NEXT_PUBLIC_API_BASE_URL` to point at the backend instance:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
```

The API client attaches the active Supabase access token to authenticated requests. The daily prompt remains public, but answers, progress, reflections, badges, and billing actions require a signed-in user. Browser-generated guest IDs are intentionally no longer supported; see [`../../docs/AUTHENTICATION.md`](../../docs/AUTHENTICATION.md).

### Tests

```bash
npm test
```

### Key features

- Daily reflection retrieval with React Query caching.
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
