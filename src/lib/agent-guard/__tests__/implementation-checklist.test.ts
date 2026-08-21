import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_IMPLEMENTATION_CHECKLIST_COPY,
  buildAgentGuardImplementationChecklist,
} from "../implementation-checklist";
import { SHADOWGUARD_PRODUCTION_BASE_URL } from "../production-operations";

describe("AgentGuard implementation checklist", () => {
  it("builds deterministic customer-engineer handoff content", () => {
    const checklist = buildAgentGuardImplementationChecklist({
      generatedAt: "2026-05-18T12:00:00.000Z",
      organizationName: "Example Organization",
      baseUrl: "https://guard.example.test/",
    });

    expect(checklist.title).toBe(AGENT_GUARD_IMPLEMENTATION_CHECKLIST_COPY.title);
    expect(checklist.organizationName).toBe("Example Organization");
    expect(checklist.baseUrl).toBe("https://guard.example.test");
    expect(checklist.sections).toHaveLength(5);
    expect(checklist.checklistText).toContain(
      "POST https://guard.example.test/api/agent-guard/activity with Authorization: Bearer <source-key>."
    );
    expect(checklist.checklistText).toContain("AGENTGUARD_INGEST_TOKEN");
    expect(checklist.checklistText).toContain("Send a safe test event");
    expect(checklist.checklistText).toContain("Confirm source attribution");
    expect(checklist.checklistText).toContain("Record metadata-only evidence");
    expect(checklist.checklistText).toContain("Schedule source-key rotation");
    expect(checklist.checklistText).toContain("Optional export receiver checklist");
  });

  it("uses placeholders and explicit no-secret boundaries", () => {
    const checklist = buildAgentGuardImplementationChecklist({
      generatedAt: "2026-05-18T12:00:00.000Z",
    });

    expect(checklist.checklistText).toContain("<source-key>");
    expect(checklist.checklistText).toContain("Do not paste source keys");
    expect(checklist.checklistText).toContain("signing secrets");
    expect(checklist.checklistText).toContain("raw prompts");
    expect(checklist.checklistText).toContain("customer data");
    expect(checklist.checklistText).not.toContain("sgag_");
    expect(checklist.checklistText).not.toContain("sgae_");
  });

  it("keeps product claims conservative", () => {
    const checklist = buildAgentGuardImplementationChecklist({
      generatedAt: "2026-05-18T12:00:00.000Z",
    });

    expect(checklist.boundary).toContain("not legal advice");
    expect(checklist.boundary).toContain("not a certification");
    expect(checklist.boundary).toContain("not a compliance determination");
    expect(checklist.boundary).toContain("not a managed connector");
    expect(checklist.boundary).toContain("not automatic monitoring");
    expect(checklist.boundary).toContain("not enforcement");
    expect(checklist.checklistText).toContain("customer-controlled server-side");
    expect(checklist.checklistText).toContain("No browser collector");
    expect(checklist.checklistText).toContain("No automatic source creation");
  });

  it("normalizes unsafe display context", () => {
    const checklist = buildAgentGuardImplementationChecklist({
      generatedAt: "2026-05-18T12:00:00.000Z",
      organizationName: "Acme\r\nCorp",
      baseUrl: "javascript:alert(1)",
    });

    expect(checklist.organizationName).toBe("Acme Corp");
    expect(checklist.baseUrl).toBe(SHADOWGUARD_PRODUCTION_BASE_URL);
  });
});
