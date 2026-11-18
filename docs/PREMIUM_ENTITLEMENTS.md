# Premium authorization and entitlement security

## Capability inventory

The only implemented premium-only backend operation is `GET /v1/reflections/history`.
It returns historical reflection excerpts and now requires both a verified Supabase
user principal and an active entitlement for that same user.

The reflection overview is available to every authenticated user. Its server response
decides whether historical timeline content is present: free users receive only the
current-day entry plus teasers, while active premium users receive the unlocked weekly
timeline. Frontend values such as `plan=premium`, `timelineUnlocked`, pricing return
URLs, and component props are display state only and do not authorize an API request.

Pricing copy also mentions exports, and the clients contain focus-tool UI, but no
export or premium focus-tool API exists in this repository. A future server operation
for either feature must use the same premium dependency before reading user data.

## Authorization flow

1. FastAPI validates the Supabase bearer token and derives the user ID exclusively
   from its `sub` claim.
2. The premium dependency asks `EntitlementService` for that exact user's record.
3. The record must have `plan=premium`, an allowed status (`active`, `trialing`, or
   grandfathered `legacy`), and no elapsed `expires_at` value.
4. The history query receives the user ID from the successful authorization result;
   query parameters and headers cannot select a different account.

Missing or invalid authentication returns `401`. A known non-premium, inactive,
canceled, or expired record returns `403`. An unreadable configured entitlement source
returns `503` for premium-only operations and never falls back to a second store.
Non-sensitive premium display state fails closed to the free presentation.

## Current source of truth

When Supabase is configured, the configured user-plan table is the sole entitlement
source. Read or write failures do not switch to the local JSON store. The JSON store is
used only when no Supabase-backed repository is configured, primarily for local
development and tests. Existing records are read in place and are not migrated,
deleted, or rewritten by this phase.

Entitlements with explicit status and expiry fields are evaluated when those fields
exist. Existing production records historically contained only a `plan` string. Code
history shows that premium writes came from Paddle transaction confirmation, the
Paddle webhook handler, or an operator backfill script; older endpoints did not expose
a direct plan-update API. Phase 1 bound transaction confirmation to the authenticated
JWT subject, and Phase 2 does not accept plan or entitlement fields from clients.

To avoid revoking existing paid users without billing reconciliation, a plan-only
premium record is treated as a grandfathered `legacy` entitlement. This is a
compatibility decision, not proof that the subscription is currently paid.

## Phase 3 billing integration

Phase 3 adds verified webhook processing, durable subscription state, and server-owned
checkout correlation. See [`BILLING_SECURITY.md`](BILLING_SECURITY.md) for the event
policy, migration, reconciliation, sandbox testing, and deployment requirements.

Legacy plan-only premium records remain grandfathered until the reviewed migration
process is explicitly approved. They are not silently converted or revoked by the
Phase 3 migration.
