import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_ENTERPRISE_RUNBOOK_COPY,
  buildAgentGuardEnterpriseRunbook,
} from "../enterprise-runbook";
import type { AgentGuardEnterpriseSetupGuide } from "../enterprise-setup";
import type { AgentGuardIntegrationEvidence } from "../integration-evidence";

const baseGuide: AgentGuardEnterpriseSetupGuide = {
  status: "in_progress",
  label: "In progress",
  summary: "AgentGuard setup is underway.",
  boundary: "Setup boundary.",
  progress: {
    completedSteps: 5,
    totalSteps: 8,
    percent: 63,
  },
  nextStep: {
    id: "saved_evidence",
    label: "Save evidence packet",
    status: "next",
    detail: "Save metadata-only readiness evidence.",
    href: "/dashboard/agent-guard/readiness",
    cta: "Save packet",
    evidence: "0 saved evidence packets loaded.",
  },
  steps: [
    {
      id: "saved_evidence",
      label: "Save evidence packet",
      status: "next",
      detail: "Save metadata-only readiness evidence.",
      href: "/dashboard/agent-guard/readiness",
      cta: "Save packet",
      evidence: "0 saved evidence packets loaded.",
    },
    {
      id: "export_receiver",
      label: "Review export receiver posture",
      status: "locked",
      detail: "Review receiver posture.",
      href: "/dashboard/agent-guard/settings",
      cta: "Open settings",
      evidence: "1 destination configured; 0 live.",
    },
  ],
  loadWarnings: [],
};

const evidence: AgentGuardIntegrationEvidence = {
  id: "evidence-1",
  sourceId: "source-1",
  sourceName: "Production wrapper",
  sourceEnvironment: "production",
  sourceStatus: "active",
  status: "pilot_ready",
  statusLabel: "Pilot ready",
  statusTone: "green",
  title: "Production wrapper implementation",
  implementationOwner: "Security engineering",
  wrapperLocation: "services/ai-gateway",
  evidenceUrl: "https://example.com/ticket/123",
  checklistSnapshot: [
    {
      id: "server_side_secret",
      label: "Source key stored server-side",
      detail: "Stored server-side.",
      completed: true,
    },
  ],
  completedChecklistCount: 1,
  note: "Metadata-only implementation note.",
  createdByUserId: "user-1",
  createdByEmail: "owner@example.com",
  updatedByUserId: "user-1",
  updatedByEmail: "owner@example.com",
  createdAt: "2026-05-16T12:00:00.000Z",
  updatedAt: "2026-05-16T12:00:00.000Z",
};

describe("AgentGuard enterprise runbook", () => {
  it("summarizes setup progress and next step", () => {
    const runbook = buildAgentGuardEnterpriseRunbook({
      setupGuide: baseGuide,
      integrationEvidence: [],
      generatedAt: "2026-05-16T12:00:00.000Z",
    });

    expect(runbook.statusLabel).toBe("In progress");
    expect(runbook.metrics.setupCompletedSteps).toBe(5);
    expect(runbook.runbookText).toContain("Progress: 5/8 steps (63%).");
    expect(runbook.runbookText).toContain("Current next step: Save evidence packet");
  });

  it("summarizes integration evidence posture", () => {
    const runbook = buildAgentGuardEnterpriseRunbook({
      setupGuide: baseGuide,
      integrationEvidence: [evidence],
      generatedAt: "2026-05-16T12:00:00.000Z",
    });

    expect(runbook.metrics.integrationEvidenceCount).toBe(1);
    expect(runbook.metrics.pilotReadyIntegrationEvidenceCount).toBe(1);
    expect(runbook.runbookText).toContain("Production wrapper implementation");
    expect(runbook.runbookText).toContain("checklist 1/1");
  });

  it("includes SDK starter and export posture details", () => {
    const runbook = buildAgentGuardEnterpriseRunbook({
      setupGuide: baseGuide,
      integrationEvidence: [evidence],
      generatedAt: "2026-05-16T12:00:00.000Z",
    });

    expect(runbook.metrics.sdkExampleCount).toBeGreaterThanOrEqual(4);
    expect(runbook.runbookText).toContain("TypeScript helper");
    expect(runbook.runbookText).toContain("0 saved evidence packets loaded.");
    expect(runbook.runbookText).toContain("1 destination configured; 0 live.");
  });

  it("carries optional warnings into runbook output", () => {
    const runbook = buildAgentGuardEnterpriseRunbook({
      setupGuide: { ...baseGuide, loadWarnings: ["Saved packet history unavailable."] },
      integrationEvidence: [],
      integrationEvidenceWarning: "Integration evidence migration missing.",
      generatedAt: "2026-05-16T12:00:00.000Z",
    });

    expect(runbook.warnings).toEqual([
      "Saved packet history unavailable.",
      "Integration evidence migration missing.",
    ]);
    expect(runbook.runbookText).toContain("Integration evidence migration missing.");
  });

  it("keeps boundary language conservative", () => {
    const runbook = buildAgentGuardEnterpriseRunbook({
      setupGuide: baseGuide,
      integrationEvidence: [],
      generatedAt: "2026-05-16T12:00:00.000Z",
    });

    expect(AGENT_GUARD_ENTERPRISE_RUNBOOK_COPY.boundary).toContain(
      "metadata-only"
    );
    expect(runbook.runbookText).toContain("not legal advice");
    expect(runbook.runbookText).toContain("not a certification");
    expect(runbook.runbookText).toContain("not automatic monitoring");
    expect(runbook.runbookText).toContain("not enforcement");
    expect(runbook.runbookText).toContain("does not create sources");
    expect(runbook.runbookText).toContain("expand enforcement");
  });
});
