# Question calendar and historical integrity

## Findings

The previous selector converted each date into a year-relative Monday-aligned number and searched optional catalog offsets. After the last offset it wrapped to the first question. Reusable `week-X-day-Y` catalog IDs were also submission IDs, so another year's use could be rejected as a duplicate. Weekly progress queried only catalog week number, history re-read current catalog text, and client/server dates relied on implicit host time.

The catalog contains 52 seven-question weeks (364 slots). It also contains one existing exact duplicate: `week-25-day-6` and `week-51-day-2`, “What do you want to leave behind?”. Phase 5 preserves the curated catalog and reports the collision rather than silently editing product content.

## Deterministic scheduling

For application date `D`:

1. `week_start = D - weekday(D)`, always Monday.
2. `schedule_year = week_start.year`, so a week spanning New Year stays one weekly instance.
3. Count Monday weeks from the Monday on or before January 1 of `schedule_year`.
4. Rotate the catalog start by `(schedule_year - 2024) mod 52`.
5. Select `(calendar_week + rotation) mod 52`; select the day's question by `D.weekday()`.

This handles 365/366 days and a 53rd Monday week without creating a 365th question. The annual rotation prevents the overflow slot and the next year's first slot from being identical. Monday always has day index 0 and the easiest multiplier; Sunday always has day index 6 and the hardest multiplier.

Every user receives the same question for the same application date. The application timezone is the IANA `APPLICATION_TIMEZONE`, default `UTC`. No prior timezone policy existed in the repository beyond host-local `date.today()`. Before rollout, operations must identify the production host timezone and set `APPLICATION_TIMEZONE` to preserve the current user boundary; do not accept the default silently if production was not UTC.

## IDs and snapshots

- Catalog ID: reusable `week-<1-52>-day-<1-7>`.
- Question instance ID: immutable `question:<YYYY-MM-DD>`.
- Week instance ID: `week:<Monday YYYY-MM-DD>`.

New answers store the instance/catalog IDs, application date, week instance, exact prompt, theme, difficulty label/score/multiplier, and catalog version. Reflection views prefer this snapshot, so future catalog edits cannot rewrite history.

Catalog JSON requires an explicit `catalogVersion`, exactly 52 weeks, and seven questions per week. A new yearly set must receive a new immutable version and pass `python -m app.scripts.audit_question_catalog <path>`, which fails on exact or near duplicates at a configurable similarity threshold. Version files must remain available for audit; never edit a released version in place.

## Legacy migration strategy

Migration `202611120003_question_calendar.sql` is additive:

- adds nullable snapshot/instance columns to `answers`;
- adds `last_answered_date` to progress and dated week identity to new badges;
- adds a partial unique index for new `(user_id, question_instance_id)` values;
- adds a dated-week query index;
- replaces atomic finalization to require and persist the snapshot;
- creates `legacy_answer_calendar_review` for rows lacking an instance.

Existing rows are not rewritten. A legacy `week-X-day-Y` plus `created_at` is ambiguous because the old application timezone was not explicit, delayed writes may cross midnight, and a catalog slot can occur every year. Reconciliation must export review rows, determine the historical application timezone and catalog version, classify unambiguous/ambiguous records, and obtain explicit approval before backfilling. Ambiguous rows remain readable through their original ID and current legacy lookup; they must never be assigned a guessed instance ID merely to satisfy the new schema.

## Streak and weekly integrity

New streak calculations use the stored application `question_date`, not UTC submission time. A new `last_answered_date` preserves consecutive December 31/January 1 participation. Weekly completion uses `week_instance_id`, so a New Year week remains one Monday-Sunday arc while identical catalog week numbers in another year do not collide. Existing XP, streak, answers, badges, and progress rows are preserved.

## Rollout

1. Complete and verify Phase 3 and Phase 4 schema migrations on a disposable clone.
2. Determine the production host/product date boundary and set `APPLICATION_TIMEZONE` explicitly.
3. Apply Phase 5 migration to a clone; inspect legacy review counts and index/function definitions.
4. Test UTC and configured-timezone midnight boundaries with two backend workers.
5. Verify web clients submit the returned dated `id` unchanged.
6. Deploy backend atomically with the migration; monitor `422`, duplicate `409`, streak changes, and finalization failures without logging reflection text.
7. Keep legacy records nullable. Run any backfill only as a separately reviewed, dry-run-first operation.

Rollback the application first. Retain additive columns, snapshots, and review view. Do not drop the unique index or rewrite new instance IDs; doing so would weaken duplicate guarantees and historical auditability.

## Remaining risks

- The migration has not run against a disposable Supabase schema.
- Production's former implicit host timezone is unknown and must be verified.
- The legacy catalog contains one known exact duplicate; content remediation was intentionally out of scope.
- Near-duplicate detection is lexical and requires editorial review, especially across languages.
- Ambiguous legacy rows require manual reconciliation.
- Phase 3/4 migrations, Paddle sandbox tests, and end-to-end integration remain incomplete.
