# ShadowGuard Project Constitution

## Product

- Name: ShadowGuard
- Description: Self-hosted AI governance, discovery, evidence, policy, AgentGuard, and MCP governance workspace.
- Build type: Open-source web application distributed under Apache-2.0.

## Mission

Preserve the completed governance tooling as a useful public resource without operating a hosted service or creating an ongoing financial or support obligation for the original publisher.

## Users

- Primary: security, governance, IT, and risk teams operating their own instance.
- Secondary: engineers integrating customer-controlled AgentGuard sources and export destinations.
- Administrator: the installer and organization admins they appoint.

## Product Scope

### Must Have

- Authenticated, organization-isolated ShadowGuard, AgentGuard, and MCP governance workflows.
- Role-based authorization, MFA gates, RLS, audit logging, encryption, rate limiting, same-origin checks, and source-key controls.
- Manual governance workflows that work without optional external integrations.
- Fresh Supabase schema, local development configuration, production container, health endpoint, and self-hosting documentation.

### Nice To Have

- Optional Google Workspace, Microsoft 365, Turnstile, Redis/Upstash, Slack preview, and HTTPS export integrations supplied by the installer.

### Out Of Scope

- Hosted ShadowGuard accounts, payments, subscriptions, paid assessments, operator fulfillment, telemetry, SLA-backed support, or guaranteed maintenance.
- Compatibility with the retired commercial database history.
- RLS-funded hosting, domains, credentials, monitoring, email, backups, or third-party services.

## Success Criteria

- A clean clone can be configured and operated using installer-owned infrastructure.
- Every organization can use all product features without plan or billing state.
- Matching email domains never grant organization membership.
- Team membership reassignment is a reviewed database-operator action; application and API roles cannot execute the private procedure.
- Security controls remain effective across authentication, roles, MFA, RLS, source keys, and organization boundaries.
- The repository contains no live secrets, owner-operated endpoints, commercial implementation, or support promise.

## Stack Decisions

- Frontend/backend: Next.js 16 App Router and React 19.
- Database/auth: Supabase/Postgres with RLS.
- Development: Node.js 22+, npm, Supabase CLI, and Docker.
- Production: Next.js standalone container plus an operator-managed Supabase deployment.
- Integrations: optional and installer-owned.

## Security and Data Rules

- Never expose the Supabase service-role key or integration secrets to browser code.
- Never authorize with user-editable metadata.
- All exposed application tables require RLS and explicit Data API grants.
- Privileged organization mutations require role checks and AAL2 where specified.
- Installers own retention, backups, upgrades, incident response, and regulatory decisions.

## Agent Guardrails

- Do not add monetization, owner-operated telemetry, or paid dependencies.
- Do not deploy, publish, rotate secrets, or touch production resources without explicit approval.
- Do not weaken authentication, organization isolation, roles, MFA, RLS, rate limits, source-key controls, encryption, or audit logging.
- Implement only against approved specs and record verification in the validation report.
