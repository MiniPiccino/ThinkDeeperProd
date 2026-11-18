# Paddle Billing security and subscription lifecycle

## Architecture

Thinkle uses a durable subscription cache rather than calling Paddle during premium authorization:

1. An authenticated user requests checkout from the backend.
2. The backend stores an unpredictable checkout correlation, creates the Paddle transaction, and links its transaction ID.
3. The browser follows the hosted checkout URL. Browser custom data and plan indicators never identify the entitled user.
4. The webhook endpoint verifies the untouched request body as HMAC-SHA256 over `timestamp:raw_body`, using the notification destination secret and a five-second default tolerance.
5. One PostgreSQL RPC atomically records the unique event, resolves ownership, rejects stale snapshots, updates subscription state, and recomputes entitlement.

This follows Paddle's [signature algorithm](https://developer.paddle.com/webhooks/about/signature-verification/), [at-least-once delivery and ordering model](https://developer.paddle.com/webhooks/about/how-webhooks-work/), and recommended [`subscription.created`/`subscription.updated` cache](https://developer.paddle.com/build/subscriptions/provision-access-webhooks/).

No raw webhook body, signature, secret, customer email, address, or payment instrument is stored. The ledger contains provider IDs, timestamps, status, a SHA-256 body digest, and stable reason codes.

## Database migration

`supabase/migrations/202611120001_secure_paddle_billing.sql`:

- extends `user_plan` with status, expiry, source, Paddle subscription, and verification fields;
- adds server-owned checkout correlations, normalized subscriptions, and an event ledger keyed by `event_id`;
- enables RLS and removes browser-role access to billing tables;
- adds a service-role-only `process_paddle_billing_event(jsonb)` RPC.

The RPC uses an event-scoped PostgreSQL advisory transaction lock. Ledger insertion, ownership checks, ordering, subscription mutation, and entitlement mutation commit or roll back together. Failed unmapped events may be retried after mapping repair; processed and ignored events are idempotent duplicates.

Test the migration against a schema clone before production. Verify existing `user_plan.user_id` values are unique, valid Supabase Auth UUIDs before applying the unique index and foreign-key-dependent tables.

## Event-to-entitlement transitions

| Paddle snapshot/event | Stored state | Premium policy |
| --- | --- | --- |
| Created/trialing | `trialing` | Grant through current period end |
| Activated/updated active | `active` | Grant through current period end |
| Successful renewal | Updated active period | Extend through new period end |
| Scheduled cancellation/pause while active | Store action/effective date | Keep access until Paddle reports effective state |
| Payment failure | `past_due` | Keep access through later of period end or configured 7-day grace |
| Payment recovery/resume | `active` | Restore from authoritative period |
| Effective pause | `paused` | Revoke premium; preserve records |
| Effective cancellation/termination | `canceled` | Revoke premium; preserve records |
| Plan change | Update price and period | Access follows subscription status, not price text |
| Pending/rejected or partial refund | Ledger only | No automatic entitlement change |
| Approved full refund/chargeback | `access_revoked=true` | Revoke pending review/reconciliation |
| Chargeback/credit reversal | Clear adjustment revocation | Recompute from subscription state |
| Unknown event | `ignored` | No entitlement change |
| Older `occurred_at` snapshot | `ignored` | Never roll back newer state |

Paddle statuses are `trialing`, `active`, `past_due`, `paused`, and `canceled`. Scheduled cancellation remains active until effective. The seven-day past-due grace is Thinkle's explicit, configurable policy; failed payment does not immediately revoke access.

## Ownership rules

- New checkout uses authenticated `POST /v1/billing/checkout`; direct Paddle.js custom data is not authoritative.
- Only a server-created correlation UUID can establish initial ownership.
- Each Paddle transaction ID links to one correlation/user.
- Existing subscription ownership cannot be replaced by later event metadata. Conflicts fail without changing entitlement.
- Confirmation first resolves the transaction against the JWT subject, then fetches Paddle transaction/subscription snapshots. It is a reconciliation accelerator, not an independent grant.
- Missing mappings fail closed and remain visible for repair.

## Reconciliation

From `web/backend`:

```bash
poetry run python -m app.scripts.reconcile_paddle_subscriptions
```

Dry-run is default. It paginates at 200 subscriptions per page using `has_more` and Paddle's returned `next` URL. It reports drift, invalid snapshots, unknown Paddle subscriptions, and local IDs missing from Paddle. Unknown subscriptions are never mapped from custom data.

`--apply` is restricted to the sandbox API. Applied snapshots use the webhook event processor. Paddle's [platform limit is 240 requests per minute](https://developer.paddle.com/api-reference/about/rate-limiting/); the job stops on 429 and should be retried after `Retry-After`. Output contains IDs and state conflicts, not personal/payment data.

Before production apply is enabled, add reviewed scheduling/authentication, bounded `Retry-After` handling, alerting, and an explicit production safety switch.

## Legacy premium migration plan (not executed)

1. Back up and classify `user_plan`: `source=paddle` is verified; plan-only premium is legacy/unverified.
2. List Paddle subscriptions with cursor pagination in dry-run.
3. Match legacy rows only with reviewed evidence such as an existing server transaction correlation, authenticated support record, or verified Paddle customer mapping. Old client custom data alone is insufficient.
4. Produce verified, ambiguous, and unmatched review sets.
5. After explicit approval, replay authoritative Paddle snapshots for verified matches through the event processor.
6. Manually review ambiguous legitimate customers and provide a communicated, time-bounded grace period.
7. Only after separate approval and that grace period, expire unresolved legacy records. Preserve all user, event, and subscription records.

This phase does not migrate or modify production entitlement records.

## Required environment

- `PADDLE_API_KEY`, `PADDLE_API_URL`
- `PADDLE_PRICE_ID` and/or `PADDLE_ALLOWED_PRICE_IDS`
- `PADDLE_RETURN_URL`, optionally `PADDLE_CANCEL_URL`
- `PADDLE_WEBHOOK_SECRET` for the exact notification destination
- `PADDLE_WEBHOOK_TOLERANCE_SECONDS` (default 5)
- `PADDLE_CHECKOUT_CORRELATION_TTL_MINUTES` (default 60)
- `PADDLE_PAST_DUE_GRACE_DAYS` (default 7)
- `PADDLE_RECONCILIATION_MAX_PAGES` (default 100)
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

Frontend price IDs are selection/display values only; the backend allowlist is authoritative.

## Sandbox procedure

1. Apply the migration to a disposable Supabase project; verify RLS and service-role RPC access.
2. Configure sandbox API credentials, sandbox price IDs, and the sandbox destination secret.
3. Subscribe to `subscription.created`, `subscription.updated`, `transaction.completed`, `adjustment.created`, and `adjustment.updated`.
4. Use Paddle's simulator for active, past-due, recovery, pause, resume, cancel, refund, and chargeback scenarios.
5. Complete monthly/yearly hosted checkouts as two Supabase test users; verify cross-account confirmation fails.
6. Replay notifications and deliver older events after newer ones; verify no duplicate or rollback mutation.
7. Run reconciliation dry-run, then sandbox `--apply`; verify convergence.
8. Exercise database outage, Paddle 429/5xx, and migration rollback on the disposable project.

## Production deployment and rollback

1. Back up the database and record `user_plan` counts/checksums.
2. Apply the SQL migration separately; verify constraints, indexes, RLS, and grants.
3. Deploy backend/frontend together after sandbox end-to-end approval so all new checkouts are server-created.
4. Configure the production notification destination secret only in the backend secret manager.
5. Monitor failed/unmapped events, ownership conflicts, webhook latency, and entitlement changes. Run reconciliation dry-run only.
6. For rollback, restore the prior application version and disable the destination if processing is unsafe. Keep new tables/columns as audit data; do not drop them during emergency rollback.
7. Restore entitlement rows only from the pre-deployment backup after reviewed impact analysis.
8. Approve production reconciliation and legacy migration as separate changes.

## Remaining risks and readiness gate

- The migration/RPC has not been run against the deployed schema.
- No Paddle sandbox end-to-end checkout/webhook run occurred in this local phase.
- Clock skew must be monitored; widen signature tolerance only deliberately.
- Full-refund/chargeback policy may need support/legal exceptions.
- Production reconciliation apply intentionally remains disabled.
- Legacy premium provenance remains unresolved until separately approved migration.
- Paddle contract changes require monitoring and fixture refreshes.

Unit tests do not make billing production-ready. Readiness requires sandbox end-to-end testing, schema-clone migration verification, security review, observability, and reviewed deployment/migration approval.
