import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_ENTERPRISE_SMOKE_TEST_COPY,
  AGENT_GUARD_ENTERPRISE_SMOKE_TEST_GROUPS,
  agentGuardEnterpriseSmokeTestCounts,
  flattenAgentGuardEnterpriseSmokeTestItems,
} from "../enterprise-smoke-test";

describe("AgentGuard enterprise smoke-test checklist", () => {
  it("defines the expected enterprise smoke-test groups", () => {
    expect(AGENT_GUARD_ENTERPRISE_SMOKE_TEST_GROUPS.map((group) => group.id)).toEqual([
      "access",
      "discovery",
      "governance",
      "agentguard",
      "evidence",
      "export",
    ]);
  });

  it("defines complete checklist items with routes and guardrails", () => {
    const items = flattenAgentGuardEnterpriseSmokeTestItems();
    expect(items).toHaveLength(12);

    for (const item of items) {
      expect(item.id.length).toBeGreaterThan(5);
      expect(item.label.length).toBeGreaterThan(8);
      expect(item.action.length).toBeGreaterThan(40);
      expect(item.expectedResult.length).toBeGreaterThan(30);
      expect(item.failureSignal.length).toBeGreaterThan(25);
      expect(item.fixHref).toMatch(/^\/dashboard/);
      expect(item.fixLabel.length).toBeGreaterThan(5);
      expect(item.guardrail.length).toBeGreaterThan(30);
    }
  });

  it("covers the critical enterprise demo paths", () => {
    const text = JSON.stringify(AGENT_GUARD_ENTERPRISE_SMOKE_TEST_GROUPS);

    expect(text).toContain("MFA");
    expect(text).toContain("Applications");
    expect(text).toContain("AI Systems");
    expect(text).toContain("governance report");
    expect(text).toContain("safe test event");
    expect(text).toContain("Monitoring");
    expect(text).toContain("Policies");
    expect(text).toContain("Reviews");
    expect(text).toContain("Readiness");
    expect(text).toContain("enterprise runbook");
    expect(text).toContain("implementation checklist");
    expect(text).toContain("dry-run");
    expect(text).toContain("receiver");
  });

  it("keeps smoke-test claims conservative", () => {
    const text = `${AGENT_GUARD_ENTERPRISE_SMOKE_TEST_COPY.boundary}\n${JSON.stringify(
      AGENT_GUARD_ENTERPRISE_SMOKE_TEST_GROUPS
    )}`;

    expect(text).toContain("operator-run readiness guidance");
    expect(text).toContain("does not automate tests");
    expect(text).toContain("prove compliance");
    expect(text).toContain("certify security");
    expect(text).toContain("provide legal advice");
    expect(text).toContain("expand monitoring");
    expect(text).toContain("create managed connectors");
    expect(text).toContain("enforce policy by itself");
    expect(text).toContain("native managed vendor connectors are not shipped");
    expect(text).not.toContain("certifies compliance");
    expect(text).not.toContain("automatically monitors every");
    expect(text).not.toContain("managed SIEM connector is shipped");
  });

  it("reports checklist counts", () => {
    expect(agentGuardEnterpriseSmokeTestCounts()).toEqual({
      groups: 6,
      items: 12,
    });
  });
});
