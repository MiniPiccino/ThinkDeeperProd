# Deployment runbook

This runbook is a procedure only. Phase 6 did not deploy, merge, push, access production data, or alter subscriptions.

## Pre-deployment

1. Obtain approval and schedule a maintenance/release window with backend, database, billing, and rollback owners.
2. Confirm a successful database backup and restore it to an isolated clone. Record table counts/checksums for `user_plan`, `answers`, `user_progress`, and `badges`.
3. On the clone, verify user IDs are valid unique Auth UUIDs, review legacy answer counts, apply migrations in order, and run the SQL/API regression set.
4. Explicitly record the existing production host/product date boundary. Set `APPLICATION_TIMEZONE` to preserve it. Do not assume Europe/Zagreb or UTC.
5. Complete Supabase Auth/JWKS and Paddle sandbox validation. Use synthetic users and sandbox instruments only.
6. Configure secrets in the deployment secret manager and public frontend variables separately. Verify no secret appears in build output or client bundles.
7. Establish shared rate limiting for multi-instance deployment and verify alerts/dashboards.
8. Build immutable backend/frontend artifacts from the approved commit; run pytest, Vitest, TypeScript, ESLint, Ruff, production build, and dependency audit.

## Production sequence

1. Enable heightened monitoring and pause new rollout activity; do not modify existing subscriptions manually.
2. Take/verify the final backup and capture pre-migration counts/checksums.
3. Apply `202611120001_secure_paddle_billing.sql`. Verify constraints, RLS, grants, function ownership, and event RPC with synthetic/approved smoke data only.
4. Apply `202611120002_secure_ai_evaluation.sql`. Verify service-role RPC access and concurrent reservation behavior.
5. Apply `202611120003_question_calendar.sql`. Verify indexes/function definition and inspect `legacy_answer_calendar_review`; do not backfill ambiguous rows.
6. Deploy backend and frontend as one coordinated compatibility release. Keep mocks disabled and verify Auth issuer/audience/JWKS configuration.
7. Configure/verify the Paddle production notification destination only after the backend is healthy. Do not replay or reconcile with `--apply` without separate approval.
8. Smoke test health, public daily question, one approved synthetic authenticated account, free history denial, and privacy-safe error behavior.
9. Monitor 401/403/409/422/429/503 rates, OpenAI fallbacks/latency, webhook signature failures/unmapped events/retries, entitlement transitions, and database errors.
10. Run Paddle reconciliation in dry-run only and review every conflict. Production apply and legacy entitlement migration are separate approvals.

## Rollback

1. If authentication, submission, entitlement, or date-boundary behavior is unsafe, stop the rollout and restore the previous application artifacts first.
2. Disable the Paddle notification destination temporarily only if processing itself is unsafe; retain provider events for later reviewed replay.
3. Keep additive tables, columns, snapshots, reservations, indexes, and event ledger. Do not drop audit data or rewrite question instance IDs during emergency rollback.
4. If a migration caused proven data corruption, isolate writes and restore affected rows from the verified backup only after impact review. Do not overwrite unrelated post-backup data blindly.
5. Reconcile provider/database state in dry-run, document event IDs and affected synthetic/approved accounts, and require approval before any apply operation.
6. Confirm old application health, compare counts/checksums, and keep monitoring elevated until stable.

## Post-deployment acceptance

Mark each item PASS, FAIL, or NOT TESTED in the release record: Auth registration/refresh, public question, atomic answer/XP, duplicate race, free/premium history, sandbox evidence carried forward, webhook retry/replay, cancellation/refund/past-due, reconciliation dry-run, year-boundary/date behavior, alerts, backup restore, and rollback timing.
