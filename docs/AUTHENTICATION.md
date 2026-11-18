# Authentication architecture

## Trust boundary

The FastAPI service treats a validated Supabase access token as the only user identity source. A request cannot select a user through query parameters, headers such as `X-User-Id`, or JSON fields such as `userId`.

The frontend sends the current Supabase session access token as `Authorization: Bearer <token>`. The backend validates the JWT locally and derives the repository key from its `sub` claim.

## Validation rules

`app/security/auth.py` enforces:

- an explicitly allowed signing algorithm (`RS256` or `ES256` through Supabase JWKS; legacy `HS256` only with `SUPABASE_JWT_SECRET`);
- a valid signature from the configured project signing key;
- exact issuer and audience;
- required and valid `exp` and `iat` claims, plus `nbf` when present;
- a UUID `sub` claim;
- `role=authenticated`, which rejects project API keys and other non-user JWTs.

The default issuer is `$SUPABASE_URL/auth/v1`, the default audience is `authenticated`, and the default JWKS URL is `$SUPABASE_URL/auth/v1/.well-known/jwks.json`. Deployments should explicitly set and verify these values against the Supabase project before rollout.

## Route policy

| Route | Policy |
| --- | --- |
| `GET /healthz` | Public |
| `GET /v1/questions/daily` | Public prompt; valid bearer token optionally adds that user's progress/feedback |
| `POST /v1/answers` | Authenticated user; today's question only, one durable submission |
| `GET /v1/reflections/overview` | Authenticated user |
| `GET /v1/reflections/history` | Authenticated user with an active server-side premium entitlement |
| `GET /v1/badges` | Authenticated user |
| Billing checkout/client-token/confirm | Authenticated user; checkout identity is the JWT subject |
| `POST /v1/billing/webhook` | Public transport endpoint; requires a fresh Paddle timestamped HMAC signature |

## Guest decision

The old web client generated an arbitrary UUID in local storage. Those identifiers were not authenticated and are no longer accepted for private operations. Unauthenticated visitors may read the public daily prompt but must sign in before submitting or reading personal data.

Supabase anonymous sign-in can provide cryptographically authenticated guest identities, but it is not enabled automatically in this change because:

1. enabling anonymous auth is a production project configuration decision;
2. automatically replacing legacy local IDs would orphan or incorrectly link existing guest data;
3. converting anonymous users to email/password accounts requires an explicit account-linking UX and migration policy.

If guest submissions remain a product requirement, enable Supabase anonymous auth deliberately, use `signInAnonymously()`, retain the same Supabase user while linking credentials, and provide a reviewed mapping process for legacy guest IDs. Never restore client-generated IDs as authorization credentials.

## Rollout requirements

1. Determine whether the Supabase project uses asymmetric signing keys or legacy HS256.
2. Configure URL, issuer, audience, and (for HS256 only) the JWT secret through the deployment secret manager.
3. Confirm the JWKS endpoint is reachable from the backend when asymmetric signing is used.
4. Deploy the frontend and backend together because private API request shapes are intentionally breaking.
5. Test with a non-production Supabase project first, including token refresh and revoked/deleted users.
6. Decide how legacy unauthenticated guest records will be retained, claimed, or expired before offering guest persistence again.

No database schema change is required for this phase; existing authenticated Supabase user IDs remain unchanged.

Premium capability rules and the remaining billing limitations are documented in
[`PREMIUM_ENTITLEMENTS.md`](PREMIUM_ENTITLEMENTS.md).
