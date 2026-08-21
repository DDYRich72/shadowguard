import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_CONNECTOR_READINESS_CATALOG,
  AGENT_GUARD_CONNECTOR_READINESS_COPY,
  agentGuardConnectorReadinessStatusCounts,
  groupAgentGuardConnectorReadinessCatalog,
} from "../connector-readiness";

describe("AgentGuard connector readiness", () => {
  it("includes all required enterprise destination categories", () => {
    expect(AGENT_GUARD_CONNECTOR_READINESS_CATALOG.map((entry) => entry.category)).toEqual([
      "webhook",
      "siem",
      "soar_ticketing",
      "chat_email",
      "data_platform",
      "audit_evidence",
    ]);
  });

  it("defines complete catalog entries", () => {
    for (const entry of AGENT_GUARD_CONNECTOR_READINESS_CATALOG) {
      expect(entry.id.length).toBeGreaterThan(3);
      expect(entry.label.length).toBeGreaterThan(5);
      expect(entry.statusLabel.length).toBeGreaterThan(5);
      expect(entry.description.length).toBeGreaterThan(20);
      expect(entry.supportedPath.length).toBeGreaterThan(20);
      expect(entry.customerRequirement.length).toBeGreaterThan(20);
      expect(entry.evidenceToPrepare.length).toBeGreaterThanOrEqual(4);
      expect(entry.boundary.length).toBeGreaterThan(20);
    }
  });

  it("groups entries deterministically by category", () => {
    const groups = groupAgentGuardConnectorReadinessCatalog();
    expect(groups.map((group) => group.category)).toEqual([
      "webhook",
      "siem",
      "soar_ticketing",
      "chat_email",
      "data_platform",
      "audit_evidence",
    ]);
    expect(groups.every((group) => group.entries.length === 1)).toBe(true);
  });

  it("counts status posture deterministically", () => {
    expect(agentGuardConnectorReadinessStatusCounts()).toEqual({
      ready_with_https_receiver: 1,
      requires_customer_middleware: 5,
      future_native_connector: 0,
    });
  });

  it("keeps connector claims conservative", () => {
    const text = `${AGENT_GUARD_CONNECTOR_READINESS_COPY.boundary}\n${JSON.stringify(
      AGENT_GUARD_CONNECTOR_READINESS_CATALOG
    )}`;
    expect(text).toContain("guarded HTTPS export destinations");
    expect(text).toContain("does not ship native managed");
    expect(text).toContain("Customer owns receiver credentials");
    expect(text).toContain("does not automatically create tickets");
    expect(text).toContain("does not send native Slack, Teams, or email");
    expect(text).not.toContain("native Splunk connector");
    expect(text).not.toContain("automatic ticket creation");
    expect(text).not.toContain("managed connector is available");
  });
});
