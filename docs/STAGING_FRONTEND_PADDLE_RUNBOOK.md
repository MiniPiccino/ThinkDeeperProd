# Thinkle staging frontend and Paddle sandbox runbook

## Current code state

The staging branch now has a complete browser contract for Supabase Auth and the secured backend:

- protected requests use the current Supabase `access_token` as `Authorization: Bearer`;
- a 401 triggers one Supabase refresh and one retry, then signs out locally and fails closed;
- auth changes invalidate or clear user-scoped React Query data;
- daily question, submission, AI feedback, XP, streak, reflections/history, and persisted badges use backend endpoints;
- premium history remains enforced by `get_premium_user_id` on the backend;
- Paddle checkout is created server-side and linked to the JWT subject through a durable correlation;
- `/checkout` initializes official Paddle.js in sandbox and opens only the server-created transaction;
- checkout completion is confirmed against Paddle by the authenticated backend; the browser cannot grant premium.

No production configuration is read or changed by these instructions.

## Required staging database state

No new migration was introduced. Staging must already have
`supabase/migrations/202611120001_secure_paddle_billing.sql` applied, including:

- `billing_checkout_correlations`;
- `paddle_subscriptions`;
- `paddle_webhook_events`;
- `process_paddle_billing_event(jsonb)`;
- billing fields on `user_plan`;
- RLS enabled and browser roles revoked.

Verify metadata only before enabling checkout. If any object or grant differs, stop and rehearse the existing migration on an isolated staging clone; do not patch production.

## Vercel Preview deployment

Do this only after approving the commit and push. Create a Preview deployment from
`staging/clean-secured-backend`, never from `main`, with the frontend root set to
`web/frontend`.

Set these variables in the **Preview** environment only:

```text
NEXT_PUBLIC_APP_ENV=staging
NEXT_PUBLIC_API_BASE_URL=https://thinkdeeperprod-staging.up.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://<STAGING_PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<STAGING_PUBLIC_ANON_OR_PUBLISHABLE_KEY>
NEXT_PUBLIC_EXPECTED_SUPABASE_PROJECT_REF=<STAGING_PROJECT_REF>
NEXT_PUBLIC_USE_MOCKS=false
```

The Supabase anon/publishable key is a public browser credential. Leave all
`NEXT_PUBLIC_PADDLE_*` variables unset until the separate Paddle sandbox activation
step is approved. Once any Paddle variable is configured, the staging guard requires
the sandbox environment and a client token beginning with `test_`.
Never put the Supabase service key, Paddle API key, or webhook secret in Vercel.

Deploy once, then record the stable Vercel branch URL. Confirm the built app fails its
staging configuration guard if the Railway URL, Supabase project ref, sandbox marker,
or `test_` client token does not match.

In staging Supabase Auth, add the stable Preview origin and callback URL to the allowed
redirect URLs. Do not add it to production Supabase.

## Railway staging variables

Before deploying this backend change, set or verify these variables on the **staging
service only**, without printing their values:

```text
DEPLOYMENT_ENVIRONMENT=staging
ALLOWED_ORIGINS=["https://<STABLE_VERCEL_BRANCH_HOST>"]
```

Leave all `PADDLE_*` variables unset for the initial non-billing deployment. Add the
sandbox values only during the separately approved Paddle activation procedure.

The backend fails closed when staging is paired with the live Paddle environment, live
API URL, or a non-sandbox API key. `PADDLE_RETURN_URL` and `PADDLE_CANCEL_URL` are no
longer part of transaction creation and may remain unset in staging.

## Paddle sandbox configuration

Use a separate Paddle sandbox account:

1. Create sandbox monthly and yearly recurring prices. Copy only their IDs to the
   frontend selection variables and backend allowlist.
2. Create a sandbox client-side token (`test_...`) for Vercel Preview.
3. Create a sandbox API key containing `_sdbx` with transaction, subscription,
   customer, client-token, and read permissions required by the backend.
4. Set the sandbox default payment link to the stable Vercel branch `/checkout` URL.
5. Create a sandbox notification destination:
   `https://thinkdeeperprod-staging.up.railway.app/v1/billing/webhook`.
6. Subscribe at minimum to `transaction.completed`, all used `subscription.*` lifecycle
   events, `adjustment.created`, and `adjustment.updated`.
7. Put that destination's secret only in Railway staging.

Sandbox and live products, prices, credentials, destinations, and customers are
separate. Never copy a live ID or credential into this setup.

## Staging validation sequence

Use two synthetic staging Supabase users and sandbox payment data only.

1. Open the Vercel Preview. Register/sign in, refresh the page, and confirm the same
   account remains active. Sign out and verify protected calls stop.
2. Sign in again and exercise the daily question, five-minute timer, answer submission,
   AI feedback, XP, streak, badge retrieval, current reflection, and history gate.
3. As a free user, call/open history and confirm the backend returns `403`; hiding the
   UI alone is not sufficient.
4. Start monthly checkout. Confirm the browser goes to `/checkout?_ptxn=txn_...`, shows
   Paddle's Test Mode checkout, and never sends user identity as authoritative custom
   data.
5. Complete checkout with a Paddle sandbox test card. Confirm `transaction.completed`
   and subscription events return `2xx`, one correlation maps to the authenticated
   user, and premium history becomes available after refresh.
6. Replay the same notification. Confirm one event-ledger row and no duplicate grant.
7. Attempt confirmation from the second user. Confirm rejection and no entitlement
   change.
8. Use Paddle's sandbox webhook simulator for renewal success, renewal failure/past
   due, recovery, scheduled cancellation, effective cancellation, pause/resume, full
   refund, and chargeback reversal.
9. For each scenario, verify only aggregate/status results for the synthetic account:
   active/trialing grants access; past due follows the configured grace; paused,
   canceled, expired, full refund, or chargeback revoke as specified; recovery restores.
10. Deliver an older event after a newer event and confirm it is ignored. Run billing
    reconciliation in dry-run mode and require zero unexplained conflicts.
11. Remove the two synthetic users and related synthetic billing/application rows only
    after recording aggregate evidence. Report anything that cannot be safely removed.

Do not expose payloads, emails, tokens, provider IDs, answers, or webhook signatures in
test reports.

## Acceptance gates

- Vercel Preview is built from the approved staging commit and uses Preview-only vars.
- Browser config guard confirms the staging Railway URL, staging Supabase ref, and
  Paddle sandbox token/environment.
- Login, logout, refresh, expired-token recovery, and fail-closed behavior pass.
- Full reflection flow, persisted badges, and backend-enforced premium history pass.
- Checkout, webhook signature, ownership, idempotency, renewal, failure, recovery,
  cancellation, expiry, refund, and reversal pass with sandbox entities.
- Railway and Paddle logs contain no JWTs, credentials, authorization headers, claims,
  emails, answers, or payment details.
- No production Supabase, Railway service, Vercel Production environment, or live
  Paddle account records a request or deployment during the test window.

## Remaining approval gate

Actual UI and Paddle sandbox E2E cannot run until this code is committed, pushed,
deployed to Vercel Preview and Railway staging, and the sandbox credentials/destination
are configured. None of those external actions are authorized by this task.
