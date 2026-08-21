# Changelog

## 1.0.0 - 2026-08-20

### Changed

- Converted ShadowGuard into an Apache-2.0, self-hosted distribution.
- Made the full ShadowGuard, AgentGuard, MCP governance, evidence, reporting, policy, and export feature set available to every authenticated organization.
- Changed signup bootstrap so every verified user receives an isolated organization; organization membership is now deliberate and admin-assigned.
- Replaced accumulated database history with one fresh-install migration, explicit Data API grants, organization-scoped RLS, local Supabase configuration, and deterministic seed data.
- Added a standalone production container, configuration-driven security policy, and a database-backed health endpoint.

### Removed

- Payments, subscriptions, product plans, upgrade gates, paid assessment orders, and operator fulfillment.
- Hosted-service commitments, owner-operated telemetry, and production-provider assumptions.
- Compatibility promises for the retired commercial database history.

ShadowGuard 1.0.0 is provided as-is. Installers own infrastructure, credentials, backups, upgrades, monitoring, incident response, and optional provider costs.
