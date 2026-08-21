import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_INTEGRATION_EVIDENCE_CHECKLIST,
  AGENT_GUARD_INTEGRATION_EVIDENCE_COPY,
  AGENT_GUARD_INTEGRATION_EVIDENCE_STATUSES,
  agentGuardIntegrationEvidenceRowToApi,
  containsDisallowedIntegrationEvidenceText,
  isMissingAgentGuardIntegrationEvidenceTable,
  normalizeAgentGuardIntegrationEvidenceChecklist,
  type AgentGuardIntegrationEvidenceRow,
} from "../integration-evidence";

describe("AgentGuard integration evidence", () => {
  it("defines a stable implementation checklist", () => {
    expect(AGENT_GUARD_INTEGRATION_EVIDENCE_CHECKLIST.map((item) => item.id)).toEqual([
      "server_side_secret",
      "request_fields_mapped",
      "decision_handling",
      "test_event_accepted",
      "owner_named",
      "evidence_linked",
    ]);

    for (const item of AGENT_GUARD_INTEGRATION_EVIDENCE_CHECKLIST) {
      expect(item.label.length).toBeGreaterThan(5);
      expect(item.detail).toContain(".");
      expect(item.completed).toBe(false);
    }
  });

  it("defines deterministic status labels", () => {
    expect(Object.keys(AGENT_GUARD_INTEGRATION_EVIDENCE_STATUSES)).toEqual([
      "planned",
      "in_progress",
      "pilot_ready",
      "needs_review",
      "retired",
    ]);
    expect(AGENT_GUARD_INTEGRATION_EVIDENCE_STATUSES.pilot_ready.label).toBe(
      "Pilot ready"
    );
    expect(AGENT_GUARD_INTEGRATION_EVIDENCE_STATUSES.needs_review.tone).toBe(
      "amber"
    );
  });

  it("normalizes partial checklist snapshots against the template", () => {
    const checklist = normalizeAgentGuardIntegrationEvidenceChecklist([
      {
        id: "server_side_secret",
        label: "Secret stored",
        detail: "Stored in server-side secret manager.",
        completed: true,
      },
      { id: "not-real", label: "Bad", detail: "Bad.", completed: true },
    ]);

    expect(checklist).toHaveLength(6);
    expect(checklist[0]).toMatchObject({
      id: "server_side_secret",
      label: "Secret stored",
      completed: true,
    });
    expect(checklist[1]).toMatchObject({
      id: "request_fields_mapped",
      completed: false,
    });
  });

  it("maps database rows to API evidence records", () => {
    const row: AgentGuardIntegrationEvidenceRow = {
      id: "evidence-1",
      source_id: "source-1",
      agent_ingest_sources: {
        name: "Production wrapper",
        environment: "production",
        status: "active",
      },
      status: "pilot_ready",
      title: "Production wrapper implementation",
      implementation_owner: "Security engineering",
      wrapper_location: "services/ai-gateway",
      evidence_url: "https://example.com/ticket/123",
      checklist_snapshot: [
        {
          id: "server_side_secret",
          label: "Source key stored server-side",
          detail: "Stored in server-side secret storage, not browser code.",
          completed: true,
        },
      ],
      note: "Reviewed metadata-only wrapper path.",
      created_by_user_id: "user-1",
      created_by_email: "owner@example.com",
      updated_by_user_id: "user-2",
      updated_by_email: "manager@example.com",
      created_at: "2026-05-16T12:00:00.000Z",
      updated_at: "2026-05-16T12:30:00.000Z",
    };

    const evidence = agentGuardIntegrationEvidenceRowToApi(row);
    expect(evidence.statusLabel).toBe("Pilot ready");
    expect(evidence.sourceName).toBe("Production wrapper");
    expect(evidence.completedChecklistCount).toBe(1);
    expect(evidence.note).toBe("Reviewed metadata-only wrapper path.");
  });

  it("detects obvious secret material in free-text fields", () => {
    expect(containsDisallowedIntegrationEvidenceText("normal runbook note")).toBe(
      false
    );
    expect(containsDisallowedIntegrationEvidenceText("sgag_1234567890abcdef")).toBe(
      true
    );
    expect(
      containsDisallowedIntegrationEvidenceText(
        "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----"
      )
    ).toBe(true);
    expect(
      containsDisallowedIntegrationEvidenceText({
        note: ["AGENTGUARD_INGEST_TOKEN", ["sgag", "1234567890"].join("_")].join(
          "="
        ),
      })
    ).toBe(true);
  });

  it("detects missing integration evidence table errors", () => {
    expect(isMissingAgentGuardIntegrationEvidenceTable({ code: "PGRST205" })).toBe(
      true
    );
    expect(
      isMissingAgentGuardIntegrationEvidenceTable({
        message: "Could not find the table agent_integration_evidence",
      })
    ).toBe(true);
    expect(isMissingAgentGuardIntegrationEvidenceTable({ message: "other" })).toBe(
      false
    );
  });

  it("keeps copy boundaries conservative", () => {
    const text = JSON.stringify(AGENT_GUARD_INTEGRATION_EVIDENCE_COPY);
    expect(text).toContain("metadata-only");
    expect(text).toContain("not secret storage");
    expect(text).toContain("not raw content storage");
    expect(text).toContain("not legal advice");
    expect(text).toContain("not a certification");
    expect(text).toContain("not automatic monitoring");
  });
});
