import {
  AGENT_GUARD_ENTERPRISE_SMOKE_TEST_COPY,
  agentGuardEnterpriseSmokeTestCounts,
} from "./enterprise-smoke-test";
import type {
  AgentGuardEnterpriseSetupGuide,
  AgentGuardEnterpriseSetupStep,
} from "./enterprise-setup";
import type { AgentGuardEnterpriseRunbook } from "./enterprise-runbook";
import type { AgentGuardIntegrationEvidence } from "./integration-evidence";

export type AgentGuardEvidenceHandoffArtifactId =
  | "readiness_posture"
  | "saved_evidence_packets"
  | "source_implementation_evidence"
  | "enterprise_runbook"
  | "implementation_checklist"
  | "export_receiver_posture"
  | "smoke_test_checklist";

export type AgentGuardEvidenceHandoffArtifactStatus =
  | "ready"
  | "available"
  | "gap"
  | "caution";

export type AgentGuardEvidenceHandoffArtifact = {
  id: AgentGuardEvidenceHandoffArtifactId;
  label: string;
  status: AgentGuardEvidenceHandoffArtifactStatus;
  statusLabel: string;
  summary: string;
  evidence: string;
  href: string;
  cta: string;
  guardrail: string;
};

export type AgentGuardEvidenceHandoffPackage = {
  title: string;
  status: AgentGuardEvidenceHandoffArtifactStatus;
  statusLabel: string;
  summary: string;
  boundary: string;
  generatedAt: string;
  artifacts: AgentGuardEvidenceHandoffArtifact[];
  metrics: {
    totalArtifacts: number;
    readyArtifacts: number;
    availableArtifacts: number;
    gapArtifacts: number;
    cautionArtifacts: number;
  };
  gaps: string[];
  packageText: string;
};

export const AGENT_GUARD_EVIDENCE_HANDOFF_PACKAGE_COPY = {
  title: "Enterprise handoff package",
  overview:
    "Read-only packaging for existing AgentGuard readiness posture, saved evidence, source implementation evidence, runbook, implementation checklist, smoke-test checklist, and export receiver posture.",
  boundary:
    "This package is operational evidence handoff support. It is not legal advice, not a certification, not a compliance determination, not an auditor attestation, not a security warranty, not automatic monitoring, not a managed connector, and not enforcement.",
} as const;

const STATUS_LABELS: Record<AgentGuardEvidenceHandoffArtifactStatus, string> = {
  ready: "Ready",
  available: "Available",
  gap: "Gap",
  caution: "Caution",
};

function setupStep(
  guide: AgentGuardEnterpriseSetupGuide,
  id: AgentGuardEnterpriseSetupStep["id"]
): AgentGuardEnterpriseSetupStep | null {
  return guide.steps.find((step) => step.id === id) ?? null;
}

function artifactStatusFromStep(
  step: AgentGuardEnterpriseSetupStep | null
): AgentGuardEvidenceHandoffArtifactStatus {
  if (!step) return "gap";
  if (step.status === "done") return "ready";
  if (step.status === "attention") return "caution";
  if (step.status === "next") return "gap";
  return "gap";
}

function artifactText(artifact: AgentGuardEvidenceHandoffArtifact): string {
  return `- ${artifact.label}: ${artifact.statusLabel}. ${artifact.summary} Evidence: ${artifact.evidence}`;
}

function packageToText(input: {
  title: string;
  statusLabel: string;
  summary: string;
  generatedAt: string;
  artifacts: AgentGuardEvidenceHandoffArtifact[];
  gaps: string[];
  boundary: string;
}): string {
  const artifacts = input.artifacts.map(artifactText).join("\n");
  const gaps =
    input.gaps.length > 0
      ? input.gaps.map((gap) => `- ${gap}`).join("\n")
      : "- No package gaps were detected in the loaded metadata.";

  return [
    input.title,
    `Generated: ${input.generatedAt}`,
    `Posture: ${input.statusLabel}`,
    `Summary: ${input.summary}`,
    "",
    "Artifacts:",
    artifacts,
    "",
    "Gaps and cautions:",
    gaps,
    "",
    `Boundary: ${input.boundary}`,
  ].join("\n");
}

function derivePackageStatus(
  artifacts: AgentGuardEvidenceHandoffArtifact[]
): AgentGuardEvidenceHandoffArtifactStatus {
  if (artifacts.some((artifact) => artifact.status === "gap")) return "gap";
  if (artifacts.some((artifact) => artifact.status === "caution")) return "caution";
  if (artifacts.every((artifact) => artifact.status === "ready")) return "ready";
  return "available";
}

function sourceImplementationStatus(input: {
  integrationEvidence: AgentGuardIntegrationEvidence[];
  integrationEvidenceWarning?: string | null;
}): AgentGuardEvidenceHandoffArtifactStatus {
  if (input.integrationEvidenceWarning || input.integrationEvidence.length === 0) {
    return "gap";
  }
  if (input.integrationEvidence.some((item) => item.status === "pilot_ready")) {
    return "ready";
  }
  if (input.integrationEvidence.some((item) => item.status === "needs_review")) {
    return "caution";
  }
  return "available";
}

export function buildAgentGuardEvidenceHandoffPackage(input: {
  setupGuide: AgentGuardEnterpriseSetupGuide;
  runbook: AgentGuardEnterpriseRunbook;
  integrationEvidence: AgentGuardIntegrationEvidence[];
  evidencePacketCount: number;
  integrationEvidenceWarning?: string | null;
  generatedAt?: string;
}): AgentGuardEvidenceHandoffPackage {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const savedEvidenceStep = setupStep(input.setupGuide, "saved_evidence");
  const exportReceiverStep = setupStep(input.setupGuide, "export_receiver");
  const smokeTestCounts = agentGuardEnterpriseSmokeTestCounts();
  const pilotReadyIntegrationEvidenceCount = input.integrationEvidence.filter(
    (item) => item.status === "pilot_ready"
  ).length;
  const sourceEvidenceStatus = sourceImplementationStatus({
    integrationEvidence: input.integrationEvidence,
    integrationEvidenceWarning: input.integrationEvidenceWarning,
  });

  const artifacts: AgentGuardEvidenceHandoffArtifact[] = [
    {
      id: "readiness_posture",
      label: "Readiness posture",
      status:
        input.setupGuide.status === "enterprise_ready"
          ? "ready"
          : input.setupGuide.status === "live_caution"
            ? "caution"
            : input.setupGuide.status === "setup_required"
              ? "gap"
              : "available",
      statusLabel:
        input.setupGuide.status === "enterprise_ready"
          ? "Ready"
          : input.setupGuide.label,
      summary: input.setupGuide.summary,
      evidence: `${input.setupGuide.progress.completedSteps}/${input.setupGuide.progress.totalSteps} setup steps complete. Current next step: ${input.setupGuide.nextStep.label}.`,
      href: "/dashboard/agent-guard/readiness",
      cta: "Open readiness",
      guardrail:
        "Readiness posture is operational evidence support, not legal advice, certification, compliance determination, or auditor attestation.",
    },
    {
      id: "saved_evidence_packets",
      label: "Saved evidence packets",
      status: input.evidencePacketCount > 0 ? "ready" : artifactStatusFromStep(savedEvidenceStep),
      statusLabel: input.evidencePacketCount > 0 ? "Ready" : "Gap",
      summary:
        input.evidencePacketCount > 0
          ? "Point-in-time AgentGuard evidence packet history is present."
          : "No saved AgentGuard evidence packet history is loaded yet.",
      evidence:
        savedEvidenceStep?.evidence ??
        `${input.evidencePacketCount} saved evidence packets loaded.`,
      href: "/dashboard/agent-guard/readiness",
      cta: "Save packet",
      guardrail:
        "Saving evidence packets does not change source keys, policies, reviews, export settings, acknowledgements, or enforcement.",
    },
    {
      id: "source_implementation_evidence",
      label: "Source implementation evidence",
      status: sourceEvidenceStatus,
      statusLabel: STATUS_LABELS[sourceEvidenceStatus],
      summary:
        input.integrationEvidence.length > 0
          ? `${input.integrationEvidence.length} metadata-only implementation evidence record${input.integrationEvidence.length === 1 ? "" : "s"} loaded; ${pilotReadyIntegrationEvidenceCount} marked Pilot ready.`
          : "No source implementation evidence records are loaded.",
      evidence:
        input.integrationEvidenceWarning ??
        "Owner, wrapper location, evidence link, checklist state, status, and notes can be recorded on Ingestion.",
      href: "/dashboard/agent-guard/ingestion",
      cta: "Open ingestion",
      guardrail:
        "Integration evidence is not secret storage or raw content storage. Do not paste source keys, private keys, prompts, responses, files, or messages.",
    },
    {
      id: "enterprise_runbook",
      label: "Enterprise runbook",
      status: input.runbook.warnings.length > 0 ? "caution" : "available",
      statusLabel: input.runbook.warnings.length > 0 ? "Caution" : "Available",
      summary: input.runbook.summary,
      evidence: `${input.runbook.metrics.setupCompletedSteps}/${input.runbook.metrics.setupTotalSteps} setup steps, ${input.runbook.metrics.integrationEvidenceCount} implementation records, ${input.runbook.metrics.sdkExampleCount} SDK examples.`,
      href: "/dashboard/agent-guard/setup",
      cta: "Copy runbook",
      guardrail:
        "The runbook is metadata-only operational support and does not create or change AgentGuard records.",
    },
    {
      id: "implementation_checklist",
      label: "Implementation checklist",
      status: "available",
      statusLabel: "Available",
      summary:
        "Downloadable customer-engineer checklist is available for server-side source implementation handoff.",
      evidence:
        "Checklist uses placeholders only and contains no source keys, signing secrets, raw prompts, responses, files, messages, or customer data.",
      href: "/api/agent-guard/implementation-checklist",
      cta: "Download checklist",
      guardrail:
        "The checklist is implementation support only, not a managed connector, compliance determination, certification, legal advice, or enforcement.",
    },
    {
      id: "export_receiver_posture",
      label: "Export receiver posture",
      status:
        input.setupGuide.status === "live_caution"
          ? "caution"
          : artifactStatusFromStep(exportReceiverStep),
      statusLabel:
        input.setupGuide.status === "live_caution"
          ? "Caution"
          : STATUS_LABELS[artifactStatusFromStep(exportReceiverStep)],
      summary:
        exportReceiverStep?.detail ??
        "Export receiver posture was not loaded from setup guidance.",
      evidence:
        exportReceiverStep?.evidence ??
        "Confirm export destinations, receiver examples, dry-run state, and live-send posture.",
      href: "/dashboard/agent-guard/settings",
      cta: "Open settings",
      guardrail:
        "Outbound export should remain dry-run or explicitly reviewed before live sends. Native managed vendor connectors are not shipped.",
    },
    {
      id: "smoke_test_checklist",
      label: "Enterprise smoke-test checklist",
      status: "available",
      statusLabel: "Available",
      summary:
        "Operator-run demo and release readiness checklist is available on the AgentGuard Guide.",
      evidence: `${smokeTestCounts.groups} groups and ${smokeTestCounts.items} checks cover access, discovery, governance, AgentGuard, evidence, and export posture.`,
      href: "/dashboard/agent-guard/guide",
      cta: "Open guide",
      guardrail: AGENT_GUARD_ENTERPRISE_SMOKE_TEST_COPY.boundary,
    },
  ];

  const metrics = {
    totalArtifacts: artifacts.length,
    readyArtifacts: artifacts.filter((artifact) => artifact.status === "ready").length,
    availableArtifacts: artifacts.filter((artifact) => artifact.status === "available").length,
    gapArtifacts: artifacts.filter((artifact) => artifact.status === "gap").length,
    cautionArtifacts: artifacts.filter((artifact) => artifact.status === "caution").length,
  };
  const status = derivePackageStatus(artifacts);
  const gaps = [
    ...artifacts
      .filter((artifact) => artifact.status === "gap" || artifact.status === "caution")
      .map((artifact) => `${artifact.label}: ${artifact.summary}`),
    ...input.setupGuide.loadWarnings,
    ...input.runbook.warnings,
  ];
  const summary =
    status === "ready"
      ? "All handoff artifacts are ready in the loaded metadata window."
      : status === "caution"
        ? "Handoff artifacts are available, but caution items should be reviewed before enterprise rollout."
        : status === "gap"
          ? "Handoff artifacts have evidence gaps that should be closed before enterprise rollout."
          : "Core handoff artifacts are available; complete remaining evidence before broader rollout.";

  return {
    title: AGENT_GUARD_EVIDENCE_HANDOFF_PACKAGE_COPY.title,
    status,
    statusLabel: STATUS_LABELS[status],
    summary,
    boundary: AGENT_GUARD_EVIDENCE_HANDOFF_PACKAGE_COPY.boundary,
    generatedAt,
    artifacts,
    metrics,
    gaps,
    packageText: packageToText({
      title: AGENT_GUARD_EVIDENCE_HANDOFF_PACKAGE_COPY.title,
      statusLabel: STATUS_LABELS[status],
      summary,
      generatedAt,
      artifacts,
      gaps,
      boundary: AGENT_GUARD_EVIDENCE_HANDOFF_PACKAGE_COPY.boundary,
    }),
  };
}
