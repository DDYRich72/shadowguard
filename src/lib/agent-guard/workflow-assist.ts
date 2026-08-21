export type AgentGuardWorkflowAssistPageId = "setup" | "ingestion" | "policies";

export type AgentGuardWorkflowAssistLink = {
  label: string;
  href: string;
  cta: string;
};

export type AgentGuardWorkflowAssistEntry = {
  page: AgentGuardWorkflowAssistPageId;
  phase: string;
  title: string;
  purpose: string;
  confirm: string[];
  evidence: string[];
  nextLinks: AgentGuardWorkflowAssistLink[];
  boundary: string;
};

export const AGENT_GUARD_WORKFLOW_ASSIST_COPY = {
  label: "Workflow assist",
  overview:
    "Compact page-level guidance for the AgentGuard operator path. Use it to confirm what this page is for, what evidence to look for, and where to go next.",
  boundary:
    "Workflow assist is read-only navigation support. It does not create source keys, send test events, change policies, mutate reviews, change export settings, save evidence packets, create acknowledgements, or expand enforcement.",
} as const;

export const AGENT_GUARD_WORKFLOW_ASSIST_ENTRIES: Record<
  AgentGuardWorkflowAssistPageId,
  AgentGuardWorkflowAssistEntry
> = {
  setup: {
    page: "setup",
    phase: "Orient and sequence",
    title: "Use Setup as the live next-action board",
    purpose:
      "Start here when the AgentGuard workflow feels busy. Setup summarizes current posture, shows the current next step, and exposes the enterprise runbook.",
    confirm: [
      "Setup progress matches the source, activity, policy, review, evidence, and export work you expect.",
      "The current next-step card has a clear owner before the pilot expands.",
      "Runbook warnings are reviewed before copying the enterprise handoff.",
    ],
    evidence: [
      "Current next-step label and evidence line.",
      "Setup progress count.",
      "Enterprise runbook status and copyable handoff.",
    ],
    nextLinks: [
      {
        label: "Need the full process map?",
        href: "/dashboard/agent-guard/guide",
        cta: "Open guide",
      },
      {
        label: "Need to prove source activity?",
        href: "/dashboard/agent-guard/ingestion",
        cta: "Open ingestion",
      },
    ],
    boundary:
      "Setup is read-only. It does not create sources, send events, change policies, mutate reviews, save evidence, change exports, create acknowledgements, or enforce anything.",
  },
  ingestion: {
    page: "ingestion",
    phase: "Connect and prove",
    title: "Use Ingestion to prove source-controlled activity",
    purpose:
      "This is where operators create or confirm source keys, send safe test events, verify source attribution, and record metadata-only implementation evidence.",
    confirm: [
      "Source keys are stored only in server-side secrets and scoped to known tool names when practical.",
      "A safe test event has been accepted and appears as source-attributed activity.",
      "Integration evidence records owner, wrapper location, status, and non-sensitive proof links.",
    ],
    evidence: [
      "Active source and last-used metadata.",
      "Test accepted result and recent source-attributed activity.",
      "Integration evidence status and checklist state.",
    ],
    nextLinks: [
      {
        label: "Source is sending activity?",
        href: "/dashboard/agent-guard/policies",
        cta: "Review policies",
      },
      {
        label: "Need starter code?",
        href: "/dashboard/agent-guard/guide",
        cta: "Open guide",
      },
    ],
    boundary:
      "Ingestion source keys are sensitive. Do not paste source keys, private keys, raw prompts, responses, files, or message content into evidence fields.",
  },
  policies: {
    page: "policies",
    phase: "Tune and triage",
    title: "Use Policies to tune deterministic outcomes",
    purpose:
      "This is where operators review starter templates, understand block/warn/quarantine/allow behavior, and use policy outcome analytics before broadening a pilot.",
    confirm: [
      "Enabled policies match the pilot scope and action behavior is understood.",
      "Policy outcome analytics show expected block or review outcomes for recent submitted activity.",
      "Warn and quarantine review load is understood before expanding source coverage.",
    ],
    evidence: [
      "Enabled policy baseline and priority order.",
      "Policy outcome analytics and tuning signals.",
      "Review queue rows for warn and quarantine matches.",
    ],
    nextLinks: [
      {
        label: "Need to work review rows?",
        href: "/dashboard/agent-guard/reviews",
        cta: "Open reviews",
      },
      {
        label: "Need readiness evidence?",
        href: "/dashboard/agent-guard/readiness",
        cta: "Open readiness",
      },
    ],
    boundary:
      "Policy analytics are deterministic operator support from submitted activity and review rows. They are not AI-generated policy recommendations and not automatic policy tuning.",
  },
};

export function getAgentGuardWorkflowAssistEntry(
  page: AgentGuardWorkflowAssistPageId
): AgentGuardWorkflowAssistEntry {
  return AGENT_GUARD_WORKFLOW_ASSIST_ENTRIES[page];
}

export function agentGuardWorkflowAssistEntries(): AgentGuardWorkflowAssistEntry[] {
  return Object.values(AGENT_GUARD_WORKFLOW_ASSIST_ENTRIES);
}
