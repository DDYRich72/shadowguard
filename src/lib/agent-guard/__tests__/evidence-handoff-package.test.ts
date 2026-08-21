import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_EVIDENCE_HANDOFF_PACKAGE_COPY,
  buildAgentGuardEvidenceHandoffPackage,
} from "../evidence-handoff-package";
import type { AgentGuardEnterpriseSetupGuide } from "../enterprise-setup";
import type { AgentGuardEnterpriseRunbook } from "../enterprise-runbook";
import type { AgentGuardIntegrationEvidence } from "../integration-evidence";

function setupGuide(
  overrides: Partial<AgentGuardEnterpriseSetupGuide> = {}
): AgentGuardEnterpriseSetupGuide {
  const steps: AgentGuardEnterpriseSetupGuide["steps"] = [
    {
      id: "source_setup",
      label: "Create active source",
      status: "done",
      detail: "Create a scoped source key.",
      href: "/dashboard/agent-guard/ingestion",
      cta: "Open ingestion",
      evidence: "1 active source loaded.",
    },
    {
      id: "test_activity",
      label: "Prove submitted activity",
      status: "done",
      detail: "Send safe test activity.",
      href: "/dashboard/agent-guard/ingestion",
      cta: "Send test event",
      evidence: "1 source has recent submitted activity.",
    },
    {
      id: "policy_baseline",
      label: "Confirm policy baseline",
      status: "done",
      detail: "Review enabled policies.",
      href: "/dashboard/agent-guard/policies",
      cta: "Review policies",
      evidence: "5/6 policies enabled.",
    },
    {
      id: "policy_coverage",
      label: "Prove policy coverage",
      status: "done",
      detail: "Confirm policy outcomes.",
      href: "/dashboard/agent-guard/policies",
      cta: "Tune coverage",
      evidence: "1 source has policy outcomes; 0 need scope review.",
    },
    {
      id: "review_queue",
      label: "Work review queue",
      status: "done",
      detail: "Work warn and quarantine reviews.",
      href: "/dashboard/agent-guard/reviews",
      cta: "Open reviews",
      evidence: "0 reviews need action.",
    },
    {
      id: "readiness_packet",
      label: "Review readiness packet",
      status: "done",
      detail: "Review readiness report.",
      href: "/dashboard/agent-guard/readiness",
      cta: "Open readiness",
      evidence: "Current posture: Ready for pilot.",
    },
    {
      id: "saved_evidence",
      label: "Save evidence packet",
      status: "done",
      detail: "Save point-in-time evidence.",
      href: "/dashboard/agent-guard/readiness",
      cta: "Save packet",
      evidence: "1 saved evidence packet loaded.",
    },
    {
      id: "export_receiver",
      label: "Review export receiver posture",
      status: "done",
      detail: "Confirm export receiver posture.",
      href: "/dashboard/agent-guard/settings",
      cta: "Open settings",
      evidence: "1 destination configured; 0 live.",
    },
  ];

  return {
    status: "enterprise_ready",
    label: "Enterprise ready",
    summary: "Core AgentGuard setup evidence is present.",
    boundary: "This wizard is read-only setup guidance.",
    progress: {
      completedSteps: 8,
      totalSteps: 8,
      percent: 100,
    },
    nextStep: steps[7],
    steps,
    loadWarnings: [],
    ...overrides,
  };
}

function runbook(
  overrides: Partial<AgentGuardEnterpriseRunbook> = {}
): AgentGuardEnterpriseRunbook {
  return {
    title: "AgentGuard enterprise runbook - Enterprise ready",
    status: "enterprise_ready",
    statusLabel: "Enterprise ready",
    summary: "Setup is ready. Integration evidence records loaded: 1.",
    generatedAt: "2026-05-18T12:00:00.000Z",
    metrics: {
      setupCompletedSteps: 8,
      setupTotalSteps: 8,
      setupPercent: 100,
      integrationEvidenceCount: 1,
      pilotReadyIntegrationEvidenceCount: 1,
      sdkExampleCount: 4,
    },
    sections: [],
    warnings: [],
    boundary: "This runbook is metadata-only operational support.",
    runbookText: "Runbook text",
    ...overrides,
  };
}

function integrationEvidence(
  status: AgentGuardIntegrationEvidence["status"] = "pilot_ready"
): AgentGuardIntegrationEvidence {
  return {
    id: "evidence-1",
    sourceId: "source-1",
    sourceName: "Production wrapper",
    sourceEnvironment: "production",
    sourceStatus: "active",
    status,
    statusLabel: status === "pilot_ready" ? "Pilot ready" : "Needs review",
    statusTone: status === "pilot_ready" ? "green" : "amber",
    title: "Production wrapper implementation",
    implementationOwner: "Engineering",
    wrapperLocation: "internal service",
    evidenceUrl: "https://example.com/evidence",
    checklistSnapshot: [],
    completedChecklistCount: 6,
    note: "Reviewed",
    createdByUserId: "user-1",
    createdByEmail: "operator@example.com",
    updatedByUserId: "user-1",
    updatedByEmail: "operator@example.com",
    createdAt: "2026-05-18T12:00:00.000Z",
    updatedAt: "2026-05-18T12:00:00.000Z",
  };
}

describe("AgentGuard evidence handoff package", () => {
  it("builds the expected artifact package", () => {
    const handoff = buildAgentGuardEvidenceHandoffPackage({
      setupGuide: setupGuide(),
      runbook: runbook(),
      integrationEvidence: [integrationEvidence()],
      evidencePacketCount: 1,
      generatedAt: "2026-05-18T12:30:00.000Z",
    });

    expect(handoff.title).toBe(AGENT_GUARD_EVIDENCE_HANDOFF_PACKAGE_COPY.title);
    expect(handoff.artifacts.map((artifact) => artifact.id)).toEqual([
      "readiness_posture",
      "saved_evidence_packets",
      "source_implementation_evidence",
      "enterprise_runbook",
      "implementation_checklist",
      "export_receiver_posture",
      "smoke_test_checklist",
    ]);
    expect(handoff.metrics.totalArtifacts).toBe(7);
    expect(handoff.metrics.gapArtifacts).toBe(0);
    expect(handoff.packageText).toContain("Enterprise handoff package");
    expect(handoff.packageText).toContain("Implementation checklist");
    expect(handoff.packageText).toContain("Enterprise smoke-test checklist");
  });

  it("surfaces missing saved packets and implementation evidence as gaps", () => {
    const guide = setupGuide({
      status: "needs_review",
      label: "Needs review",
      progress: {
        completedSteps: 6,
        totalSteps: 8,
        percent: 75,
      },
      loadWarnings: ["Evidence packet history could not load."],
    });
    guide.steps = guide.steps.map((step) =>
      step.id === "saved_evidence"
        ? { ...step, status: "next", evidence: "0 saved evidence packets loaded." }
        : step
    );

    const handoff = buildAgentGuardEvidenceHandoffPackage({
      setupGuide: guide,
      runbook: runbook({
        status: "needs_review",
        statusLabel: "Needs review",
        warnings: ["No integration evidence records loaded."],
        metrics: {
          setupCompletedSteps: 6,
          setupTotalSteps: 8,
          setupPercent: 75,
          integrationEvidenceCount: 0,
          pilotReadyIntegrationEvidenceCount: 0,
          sdkExampleCount: 4,
        },
      }),
      integrationEvidence: [],
      evidencePacketCount: 0,
      integrationEvidenceWarning: "AgentGuard integration evidence is not available yet.",
      generatedAt: "2026-05-18T12:30:00.000Z",
    });

    expect(handoff.status).toBe("gap");
    expect(handoff.metrics.gapArtifacts).toBeGreaterThanOrEqual(2);
    expect(handoff.gaps.join("\n")).toContain("Saved evidence packets");
    expect(handoff.gaps.join("\n")).toContain("Source implementation evidence");
    expect(handoff.gaps.join("\n")).toContain("Evidence packet history could not load.");
    expect(handoff.packageText).toContain("Gaps and cautions");
  });

  it("flags live export posture as caution", () => {
    const guide = setupGuide({
      status: "live_caution",
      label: "Live caution",
    });
    guide.steps = guide.steps.map((step) =>
      step.id === "export_receiver"
        ? { ...step, status: "attention", evidence: "1 destination configured; 1 live." }
        : step
    );

    const handoff = buildAgentGuardEvidenceHandoffPackage({
      setupGuide: guide,
      runbook: runbook({ status: "live_caution", statusLabel: "Live caution" }),
      integrationEvidence: [integrationEvidence()],
      evidencePacketCount: 1,
      generatedAt: "2026-05-18T12:30:00.000Z",
    });

    const exportArtifact = handoff.artifacts.find(
      (artifact) => artifact.id === "export_receiver_posture"
    );
    expect(exportArtifact?.status).toBe("caution");
    expect(exportArtifact?.evidence).toContain("1 live");
  });

  it("keeps links and claims bounded", () => {
    const handoff = buildAgentGuardEvidenceHandoffPackage({
      setupGuide: setupGuide(),
      runbook: runbook(),
      integrationEvidence: [integrationEvidence()],
      evidencePacketCount: 1,
      generatedAt: "2026-05-18T12:30:00.000Z",
    });
    const text = `${handoff.boundary}\n${handoff.packageText}`;

    for (const artifact of handoff.artifacts) {
      expect(artifact.href).toMatch(/^\/(dashboard|api\/agent-guard\/implementation-checklist)/);
    }
    expect(text).toContain("not legal advice");
    expect(text).toContain("not a certification");
    expect(text).toContain("not a compliance determination");
    expect(text).toContain("not an auditor attestation");
    expect(text).toContain("not a security warranty");
    expect(text).toContain("not automatic monitoring");
    expect(text).toContain("not a managed connector");
    expect(text).toContain("not enforcement");
    expect(text).not.toContain("sgag_");
    expect(text).not.toContain("raw prompts, responses, files, messages, or customer data are included");
  });
});
