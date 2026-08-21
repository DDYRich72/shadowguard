# Current State

ShadowGuard is being prepared as an Apache-2.0, fresh-install, self-hosted distribution. The application retains its governance, reporting, evidence, AgentGuard, MCP governance, discovery, policy, and export capabilities while removing commercial operation.

## Runtime

- Next.js 16 App Router application with server components and route handlers.
- Supabase Auth and Postgres with organization-scoped RLS.
- Role and MFA-aware mutations, same-origin checks, rate limits, source-key validation, encrypted integration secrets, and audit logging remain part of the security model.
- Core manual workflows do not require Google, Microsoft, Slack, Redis, Turnstile, or outbound exports.

## Distribution

- One clean initial migration is the supported database starting point.
- Supabase CLI configuration and deterministic local seed data are included for development.
- The production application is built as a standalone container; production Supabase is operated separately by the installer.
- `/api/health` validates core configuration and database reachability without exposing failure details.

## Identity and Organizations

- Every newly verified user receives an isolated organization and admin role.
- Email-domain matching never creates membership.
- Existing verified, bootstrapped users can be deliberately reassigned only by a database operator using the private membership procedure and the user's expected current organization.

## Operating Boundary

No hosted service, billing, paid assessment, operator fulfillment, support SLA, security SLA, telemetry, or maintenance commitment is included. Installers provide infrastructure, credentials, backups, upgrades, monitoring, email, and incident response.

## External Work Still Requiring Explicit Approval

- Secret rotation and retirement of live provider resources.
- Creation, visibility changes, tagging, release publication, and archival of a public Git repository.
- DNS/domain cancellation or any destructive production shutdown.
