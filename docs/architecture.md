# Architecture

## System Shape

ShadowGuard is a self-hosted Next.js application backed by Supabase Auth and Postgres.

```text
Browser
  -> Next.js standalone application
       -> authenticated Supabase client (RLS enforced)
       -> service-role client in narrowly trusted server paths
       -> optional installer-owned providers
  -> Supabase Auth / Postgres
```

The application container and Supabase deployment are separate operational units. Supabase CLI is for local development; production operators should use the official Supabase self-hosting deployment or a Supabase project they control.

## Identity and Authorization

- Supabase proves mailbox ownership and manages sessions.
- The bootstrap helper creates one organization per verified user and stores the user's role in `public.users`.
- Domain strings are discovery inputs, never authorization boundaries.
- Organization membership is explicit; a private database-owner procedure requires the expected current organization and is unavailable to application/API roles.
- Route handlers preserve authentication, role, MFA, same-origin, rate-limit, and source-key checks according to operation risk.

## Data Isolation

- Application records carry an `org_id` or inherit organization ownership through a parent.
- Every application table in the exposed `public` schema has RLS enabled.
- Authenticated Data API privileges are explicit and remain bounded by RLS; anonymous table access is revoked.
- Security-definer helpers use fixed search paths and minimal execution grants; the private membership procedure grants no API role execution.
- Service-role access is limited to trusted server-only activities such as bootstrap, audited writes, and health verification.

## Configuration and Optional Integrations

- Application and Supabase origins are configuration-driven.
- Browser-visible Supabase values use `NEXT_PUBLIC_`; service-role and integration credentials remain server-only.
- Google Workspace, Microsoft 365, Turnstile, Redis/Upstash, Slack previews, and export destinations are optional.
- OAuth token encryption and export signing use installer-generated independent secrets.

## Runtime and Health

- Next.js emits standalone output for the production container.
- Security headers and CSP are generated from configured origins.
- `GET /api/health` is dynamic and non-cacheable. It returns only `{"status":"ok"}` or `{"status":"unavailable"}`.
- The endpoint reports healthy only when required core settings are valid and the database responds.
