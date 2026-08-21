import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT,
} from "../production-operations";
import {
  AGENT_GUARD_INTEGRATION_DIAGNOSTIC_CHECKS,
  AGENT_GUARD_INTEGRATION_DIAGNOSTIC_COMMANDS,
  AGENT_GUARD_INTEGRATION_DIAGNOSTIC_FAILURES,
  AGENT_GUARD_INTEGRATION_DIAGNOSTICS_COPY,
  buildAgentGuardIntegrationDiagnostics,
} from "../integration-diagnostics";

describe("AgentGuard integration diagnostics", () => {
  it("anchors diagnostics to the canonical AgentGuard activity endpoint", () => {
    const diagnostics = buildAgentGuardIntegrationDiagnostics();

    expect(diagnostics.endpoint).toBe(AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT);
    expect(diagnostics.diagnosticsText).toContain(
      `Endpoint: POST ${AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.url}`
    );
    expect(diagnostics.diagnosticsText).toContain(
      AGENT_GUARD_INTEGRATION_DIAGNOSTICS_COPY.overview
    );
  });

  it("covers the common source-wrapper failure paths", () => {
    const failures = AGENT_GUARD_INTEGRATION_DIAGNOSTIC_FAILURES.map(
      (failure) => [failure.status, failure.code]
    );

    expect(failures).toEqual([
      [400, "invalid_json"],
      [400, "validation_failed"],
      [401, "invalid_ingest_token"],
      [403, "tool_not_allowed_for_source"],
      [429, "rate_limited"],
    ]);

    for (const failure of AGENT_GUARD_INTEGRATION_DIAGNOSTIC_FAILURES) {
      expect(failure.label).toBeTruthy();
      expect(failure.signal).toBeTruthy();
      expect(failure.likelyCause).toBeTruthy();
      expect(failure.checkNext.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the operator next-check sequence practical and linked", () => {
    const checkIds = AGENT_GUARD_INTEGRATION_DIAGNOSTIC_CHECKS.map(
      (check) => check.id
    );

    expect(checkIds).toEqual([
      "source-active",
      "server-side-secret",
      "tool-scope-match",
      "safe-test-event",
      "monitoring-visible",
      "policy-outcome",
    ]);
    expect(
      AGENT_GUARD_INTEGRATION_DIAGNOSTIC_CHECKS.map((check) => check.href)
    ).toEqual([
      "/dashboard/agent-guard/ingestion",
      "/dashboard/agent-guard/guide",
      "/dashboard/agent-guard/ingestion",
      "/dashboard/agent-guard/ingestion",
      "/dashboard/agent-guard/monitoring",
      "/dashboard/agent-guard/policies",
    ]);
  });

  it("provides safe trusted-terminal and server-side commands", () => {
    const commandIds = AGENT_GUARD_INTEGRATION_DIAGNOSTIC_COMMANDS.map(
      (command) => command.id
    );
    const commandText = AGENT_GUARD_INTEGRATION_DIAGNOSTIC_COMMANDS.map(
      (command) => command.code
    ).join("\n");

    expect(commandIds).toEqual([
      "powershell",
      "curl",
      "node-fetch",
      "python-requests",
    ]);
    expect(commandText).toContain("/api/agent-guard/activity");
    expect(commandText).toContain("AGENTGUARD_INGEST_TOKEN");
    expect(commandText).toContain("SHADOWGUARD_APP_URL");
    expect(commandText).toContain("employee@example.com");
    expect(commandText).not.toContain("sgag_");
    expect(commandText).not.toContain("sgae_");
    expect(commandText).not.toContain("localStorage");
    expect(commandText).not.toContain("sessionStorage");
    expect(commandText).not.toContain("document.cookie");
    expect(commandText).not.toContain("window.");
  });

  it("keeps diagnostics bounded and non-automated", () => {
    const diagnostics = buildAgentGuardIntegrationDiagnostics();

    expect(diagnostics.boundary).toContain("implementation support only");
    expect(diagnostics.boundary).toContain("do not create source keys");
    expect(diagnostics.boundary).toContain("do not");
    expect(diagnostics.boundary).toContain("perform automatic monitoring");
    expect(diagnostics.boundary).toContain("enforce policy by themselves");
    expect(diagnostics.diagnosticsText).toContain("Failure diagnostics");
    expect(diagnostics.diagnosticsText).toContain("Operator next checks");
    expect(diagnostics.diagnosticsText).toContain("Copyable diagnostic commands");
  });
});
