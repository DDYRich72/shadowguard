import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_WORKFLOW_ASSIST_COPY,
  agentGuardWorkflowAssistEntries,
  getAgentGuardWorkflowAssistEntry,
} from "../workflow-assist";

describe("AgentGuard workflow assist", () => {
  it("defines page-specific entries for high-use workflow pages", () => {
    expect(agentGuardWorkflowAssistEntries().map((entry) => entry.page)).toEqual([
      "setup",
      "ingestion",
      "policies",
    ]);
  });

  it("defines complete guidance for each page", () => {
    for (const entry of agentGuardWorkflowAssistEntries()) {
      expect(entry.phase.length).toBeGreaterThan(5);
      expect(entry.title.length).toBeGreaterThan(10);
      expect(entry.purpose.length).toBeGreaterThan(40);
      expect(entry.confirm).toHaveLength(3);
      expect(entry.evidence).toHaveLength(3);
      expect(entry.nextLinks.length).toBeGreaterThanOrEqual(2);
      expect(entry.boundary.length).toBeGreaterThan(40);

      for (const link of entry.nextLinks) {
        expect(link.label.length).toBeGreaterThan(5);
        expect(link.href).toMatch(/^\/dashboard\/agent-guard/);
        expect(link.cta.length).toBeGreaterThan(5);
      }
    }
  });

  it("retrieves entries deterministically by page", () => {
    expect(getAgentGuardWorkflowAssistEntry("setup").title).toContain("Setup");
    expect(getAgentGuardWorkflowAssistEntry("ingestion").title).toContain("Ingestion");
    expect(getAgentGuardWorkflowAssistEntry("policies").title).toContain("Policies");
  });

  it("keeps workflow assist claims conservative", () => {
    const text = `${AGENT_GUARD_WORKFLOW_ASSIST_COPY.boundary}\n${JSON.stringify(
      agentGuardWorkflowAssistEntries()
    )}`;
    expect(text).toContain("read-only navigation support");
    expect(text).toContain("does not create source keys");
    expect(text).toContain("send test events");
    expect(text).toContain("change policies");
    expect(text).toContain("mutate reviews");
    expect(text).toContain("change export settings");
    expect(text).toContain("save evidence packets");
    expect(text).toContain("create acknowledgements");
    expect(text).toContain("expand enforcement");
    expect(text).toContain("not AI-generated policy recommendations");
    expect(text).toContain("not automatic policy tuning");
    expect(text).not.toContain("automatically starts monitoring");
    expect(text).not.toContain("certifies compliance");
    expect(text).not.toContain("managed connector is available");
  });
});
