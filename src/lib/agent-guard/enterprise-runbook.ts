import { AGENT_GUARD_SDK_EXAMPLES } from "./sdk-starter-kit";
import type { AgentGuardEnterpriseSetupGuide } from "./enterprise-setup";
import type { AgentGuardIntegrationEvidence } from "./integration-evidence";

export type AgentGuardEnterpriseRunbookSection = {
  title: string;
  items: string[];
};

export type AgentGuardEnterpriseRunbook = {
  title: string;
  status: AgentGuardEnterpriseSetupGuide["status"];
  statusLabel: string;
  summary: string;
  generatedAt: string;
  metrics: {
    setupCompletedSteps: number;
    setupTotalSteps: number;
    setupPercent: number;
    integrationEvidenceCount: number;
    pilotReadyIntegrationEvidenceCount: number;
    sdkExampleCount: number;
  };
  sections: AgentGuardEnterpriseRunbookSection[];
  warnings: string[];
  boundary: string;
  runbookText: string;
};

export const AGENT_GUARD_ENTERPRISE_RUNBOOK_COPY = {
  title: "Enterprise runbook",
  overview:
    "Copyable operational handoff for AgentGuard setup status, source implementation evidence, SDK starter guidance, saved evidence posture, and export receiver readiness.",
  boundary:
    "This runbook is metadata-only operational support. It is not legal advice, not a certification, not a compliance determination, not an auditor attestation, not automatic monitoring, and not enforcement.",
} as const;

function lineList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function runbookToText(input: {
  title: string;
  statusLabel: string;
  summary: string;
  generatedAt: string;
  sections: AgentGuardEnterpriseRunbookSection[];
  warnings: string[];
  boundary: string;
}): string {
  const sections = input.sections
    .map((section) => [section.title, lineList(section.items)].join("\n"))
    .join("\n\n");
  const warnings =
    input.warnings.length > 0
      ? lineList(input.warnings)
      : "- No runbook warnings were generated.";

  return [
    input.title,
    `Generated: ${input.generatedAt}`,
    `Posture: ${input.statusLabel}`,
    `Summary: ${input.summary}`,
    "",
    sections,
    "",
    "Warnings:",
    warnings,
    "",
    `Boundary: ${input.boundary}`,
  ].join("\n");
}

function integrationEvidenceItems(
  evidence: AgentGuardIntegrationEvidence[]
): string[] {
  if (evidence.length === 0) {
    return [
      "No integration evidence records loaded. Record owner, wrapper location, evidence link, and checklist state before broader enterprise handoff.",
    ];
  }

  return evidence.slice(0, 5).map((item) => {
    const source = item.sourceName
      ? `${item.sourceName} (${item.sourceEnvironment ?? "unknown"})`
      : "No source selected";
    const owner = item.implementationOwner || "owner not recorded";
    const wrapper = item.wrapperLocation || "wrapper location not recorded";
    const link = item.evidenceUrl || "evidence link not recorded";
    return `${item.title}: ${item.statusLabel}; source ${source}; owner ${owner}; wrapper ${wrapper}; evidence ${link}; checklist ${item.completedChecklistCount}/${item.checklistSnapshot.length}.`;
  });
}

export function buildAgentGuardEnterpriseRunbook(input: {
  setupGuide: AgentGuardEnterpriseSetupGuide;
  integrationEvidence: AgentGuardIntegrationEvidence[];
  integrationEvidenceWarning?: string | null;
  generatedAt?: string;
}): AgentGuardEnterpriseRunbook {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const savedEvidenceStep = input.setupGuide.steps.find(
    (step) => step.id === "saved_evidence"
  );
  const exportReceiverStep = input.setupGuide.steps.find(
    (step) => step.id === "export_receiver"
  );
  const pilotReadyIntegrationEvidenceCount = input.integrationEvidence.filter(
    (item) => item.status === "pilot_ready"
  ).length;

  const sections: AgentGuardEnterpriseRunbookSection[] = [
    {
      title: "Setup posture",
      items: [
        `Current posture: ${input.setupGuide.label}.`,
        `Progress: ${input.setupGuide.progress.completedSteps}/${input.setupGuide.progress.totalSteps} steps (${input.setupGuide.progress.percent}%).`,
        `Current next step: ${input.setupGuide.nextStep.label} - ${input.setupGuide.nextStep.detail}`,
      ],
    },
    {
      title: "Source implementation evidence",
      items: [
        `${input.integrationEvidence.length} integration evidence record${input.integrationEvidence.length === 1 ? "" : "s"} loaded; ${pilotReadyIntegrationEvidenceCount} marked Pilot ready.`,
        ...integrationEvidenceItems(input.integrationEvidence),
      ],
    },
    {
      title: "SDK starter handoff",
      items: [
        `${AGENT_GUARD_SDK_EXAMPLES.length} starter example${AGENT_GUARD_SDK_EXAMPLES.length === 1 ? "" : "s"} available on the Ingestion page.`,
        `Examples: ${AGENT_GUARD_SDK_EXAMPLES.map((example) => example.label).join(", ")}.`,
        "Source keys remain server-side secrets; starter examples are not published SDK packages or managed collectors.",
      ],
    },
    {
      title: "Saved evidence packet posture",
      items: [
        savedEvidenceStep
          ? `${savedEvidenceStep.label}: ${savedEvidenceStep.evidence}`
          : "Saved evidence packet posture was not available.",
      ],
    },
    {
      title: "Export receiver posture",
      items: [
        exportReceiverStep
          ? `${exportReceiverStep.label}: ${exportReceiverStep.evidence}`
          : "Export receiver posture was not available.",
      ],
    },
    {
      title: "Boundaries",
      items: [
        AGENT_GUARD_ENTERPRISE_RUNBOOK_COPY.boundary,
        "Opening or copying this runbook does not create sources, send test events, change policies, mutate reviews, change export settings, save packets, create acknowledgements, or expand enforcement.",
      ],
    },
  ];

  const warnings = [
    ...input.setupGuide.loadWarnings,
    input.integrationEvidenceWarning,
  ].filter((warning): warning is string => Boolean(warning));
  const summary = `${input.setupGuide.summary} Integration evidence records loaded: ${input.integrationEvidence.length}.`;
  const title = `AgentGuard enterprise runbook - ${input.setupGuide.label}`;

  return {
    title,
    status: input.setupGuide.status,
    statusLabel: input.setupGuide.label,
    summary,
    generatedAt,
    metrics: {
      setupCompletedSteps: input.setupGuide.progress.completedSteps,
      setupTotalSteps: input.setupGuide.progress.totalSteps,
      setupPercent: input.setupGuide.progress.percent,
      integrationEvidenceCount: input.integrationEvidence.length,
      pilotReadyIntegrationEvidenceCount,
      sdkExampleCount: AGENT_GUARD_SDK_EXAMPLES.length,
    },
    sections,
    warnings,
    boundary: AGENT_GUARD_ENTERPRISE_RUNBOOK_COPY.boundary,
    runbookText: runbookToText({
      title,
      statusLabel: input.setupGuide.label,
      summary,
      generatedAt,
      sections,
      warnings,
      boundary: AGENT_GUARD_ENTERPRISE_RUNBOOK_COPY.boundary,
    }),
  };
}
