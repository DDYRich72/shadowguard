import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT,
  AGENT_GUARD_CUSTOMER_WRAPPER_ENV_GROUP,
  AGENT_GUARD_INGEST_REQUEST_FIELDS,
  AGENT_GUARD_INGEST_RESPONSE_FIELDS,
  SHADOWGUARD_BACKUP_RESTORE_NOTES,
  SHADOWGUARD_INCIDENT_RESPONSE_ACTIONS,
  SHADOWGUARD_PRODUCTION_BASE_URL,
  SHADOWGUARD_PRODUCTION_ENDPOINTS,
  SHADOWGUARD_PRODUCTION_ENV_GROUPS,
  SHADOWGUARD_PRODUCTION_MIGRATIONS,
  SHADOWGUARD_PRODUCTION_OPERATIONS_COPY,
  SHADOWGUARD_SUPABASE_AUTH_URL_CONFIGURATION,
  SHADOWGUARD_ROLLBACK_ACTIONS,
  buildShadowGuardProductionOperationsRunbook,
  productionOperationsCounts,
} from "../production-operations";

describe("production operations catalog", () => {
  it("defines the canonical AgentGuard activity ingest endpoint", () => {
    expect(SHADOWGUARD_PRODUCTION_BASE_URL).toMatch(/^https?:\/\//);
    expect(AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.method).toBe("POST");
    expect(AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.path).toBe(
      "/api/agent-guard/activity"
    );
    expect(AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.url).toBe(
      `${SHADOWGUARD_PRODUCTION_BASE_URL}/api/agent-guard/activity`
    );
    expect(AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.auth).toContain(
      "Authorization: Bearer <source-key>"
    );
    expect(AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.boundary).toContain(
      "not a browser collector"
    );
  });

  it("keeps request, response, and wrapper environment fields explicit", () => {
    expect(AGENT_GUARD_INGEST_REQUEST_FIELDS).toEqual([
      "toolName",
      "userEmail",
      "activityType",
      "content",
      "metadata",
    ]);
    expect(AGENT_GUARD_INGEST_RESPONSE_FIELDS).toEqual([
      "id",
      "blocked",
      "reason",
      "riskLevel",
      "policyId",
      "policyActions",
    ]);
    expect(AGENT_GUARD_CUSTOMER_WRAPPER_ENV_GROUP.variables).toEqual([
      "SHADOWGUARD_APP_URL",
      "AGENTGUARD_INGEST_TOKEN",
    ]);
  });

  it("documents the important production endpoint set", () => {
    const endpointIds = SHADOWGUARD_PRODUCTION_ENDPOINTS.map(
      (endpoint) => endpoint.id
    );

    expect(endpointIds).toContain("agentguard-activity-ingest");
    expect(endpointIds).toContain("health");
    expect(endpointIds).toContain("password-reset");
    expect(endpointIds).toContain("google-auth-callback");
    expect(endpointIds).toContain("microsoft-auth-callback");
  });

  it("documents Supabase Auth URL settings for password reset", () => {
    expect(SHADOWGUARD_SUPABASE_AUTH_URL_CONFIGURATION.siteUrl).toBe(
      SHADOWGUARD_PRODUCTION_BASE_URL
    );
    expect(SHADOWGUARD_SUPABASE_AUTH_URL_CONFIGURATION.redirectUrls).toContain(
      `${SHADOWGUARD_PRODUCTION_BASE_URL}/login/reset-password`
    );
    expect(
      SHADOWGUARD_SUPABASE_AUTH_URL_CONFIGURATION.recoveryTemplateLink
    ).toContain("token_hash");
  });

  it("documents required production environment groups", () => {
    const allVars = SHADOWGUARD_PRODUCTION_ENV_GROUPS.flatMap(
      (group) => group.variables
    );

    expect(allVars).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(allVars).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(allVars).toContain("APP_BASE_URL");
    expect(allVars).toContain("NEXT_PUBLIC_APP_URL");
    expect(allVars).toContain("TOKEN_ENCRYPTION_KEY");
    expect(allVars).toContain("AGENT_GUARD_EXPORT_SECRET_KEY");
    expect(allVars).toContain("UPSTASH_REDIS_REST_URL");
    expect(allVars).not.toContain("STRIPE_WEBHOOK_SECRET");
  });

  it("keeps the Supabase migration checklist in sync with migration files", () => {
    const migrationDir = path.join(process.cwd(), "supabase", "migrations");
    const files = readdirSync(migrationDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    const catalog = SHADOWGUARD_PRODUCTION_MIGRATIONS.map(
      (migration) => migration.file
    ).sort();

    expect(catalog).toEqual(files);
  });

  it("builds a runbook with rollback, backup, and incident-response sections", () => {
    const runbook = buildShadowGuardProductionOperationsRunbook({
      generatedAt: "2026-05-18T00:00:00.000Z",
    });

    expect(runbook).toContain(`Application base URL: ${SHADOWGUARD_PRODUCTION_BASE_URL}`);
    expect(runbook).toContain(
      `Endpoint: POST ${SHADOWGUARD_PRODUCTION_BASE_URL}/api/agent-guard/activity`
    );
    expect(runbook).toContain("## Application environment inventory");
    expect(runbook).toContain("## Supabase Auth URL configuration");
    expect(runbook).toContain(`${SHADOWGUARD_PRODUCTION_BASE_URL}/login/reset-password`);
    expect(runbook).toContain("## Supabase migration checklist");
    expect(runbook).toContain("## Rollback and recovery");
    expect(runbook).toContain("## Backup and restore notes");
    expect(runbook).toContain("## Incident response handoff");
    expect(runbook).toContain("20260820183952_initial_schema.sql");
    expect(runbook).toContain("managed connector");
  });

  it("keeps operations guidance bounded and non-automated", () => {
    const text = [
      SHADOWGUARD_PRODUCTION_OPERATIONS_COPY.boundary,
      ...SHADOWGUARD_ROLLBACK_ACTIONS.map((action) => action.boundary),
      ...SHADOWGUARD_BACKUP_RESTORE_NOTES,
      ...SHADOWGUARD_INCIDENT_RESPONSE_ACTIONS.map((action) => action.boundary),
    ].join("\n");

    expect(text).toContain("not legal advice");
    expect(text).toContain("not a certification");
    expect(text).toContain("not a compliance determination");
    expect(text).toContain("not a security warranty");
    expect(text).toContain("not incident-response automation");
    expect(text).toContain("Do not run destructive database rollback commands");
    expect(text).toContain("Never export or share service-role keys");
  });

  it("reports catalog counts for UI and docs drift checks", () => {
    const counts = productionOperationsCounts();

    expect(counts.endpoints).toBeGreaterThanOrEqual(4);
    expect(counts.envGroups).toBeGreaterThanOrEqual(4);
    expect(counts.appEnvVars).toBeGreaterThan(15);
    expect(counts.customerWrapperEnvVars).toBe(2);
    expect(counts.migrations).toBe(SHADOWGUARD_PRODUCTION_MIGRATIONS.length);
    expect(counts.rollbackActions).toBe(SHADOWGUARD_ROLLBACK_ACTIONS.length);
    expect(counts.incidentActions).toBe(
      SHADOWGUARD_INCIDENT_RESPONSE_ACTIONS.length
    );
  });
});
