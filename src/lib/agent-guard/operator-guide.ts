export type AgentGuardOperatorGuidePhaseId =
  | "orient"
  | "connect"
  | "tune"
  | "prove"
  | "integrate";

export type AgentGuardOperatorGuideShortcut = {
  id: string;
  label: string;
  detail: string;
  href: string;
  cta: string;
};

export type AgentGuardOperatorGuideStep = {
  id: string;
  label: string;
  goal: string;
  href: string;
  cta: string;
  evidence: string;
  guardrail: string;
};

export type AgentGuardOperatorGuidePhase = {
  id: AgentGuardOperatorGuidePhaseId;
  label: string;
  outcome: string;
  steps: AgentGuardOperatorGuideStep[];
};

export type AgentGuardOperatorGuideTroubleshootingNote = {
  id: string;
  symptom: string;
  check: string;
  href: string;
};

export const AGENT_GUARD_OPERATOR_GUIDE_COPY = {
  title: "Operator guide",
  overview:
    "A practical AgentGuard operating path from first source key through submitted activity, policy coverage, review posture, readiness evidence, and enterprise integration planning.",
  streamlinedUx:
    "Use this guide as the map, then use the Setup page as the live next-action board. The guide explains the process; the Setup page reflects current posture.",
  boundary:
    "This guide is read-only workflow support. It does not create source keys, send test events, change policies, mutate reviews, change export settings, save evidence packets, create acknowledgements, or expand enforcement.",
} as const;

export const AGENT_GUARD_OPERATOR_GUIDE_SHORTCUTS: AgentGuardOperatorGuideShortcut[] = [
  {
    id: "new-operator",
    label: "I am starting from zero",
    detail:
      "Open Setup first, then use this guide to understand why each step matters.",
    href: "/dashboard/agent-guard/setup",
    cta: "Open setup",
  },
  {
    id: "have-source",
    label: "I already have a source key",
    detail:
      "Go to Ingestion to send a safe test event, confirm source health, and record implementation evidence.",
    href: "/dashboard/agent-guard/ingestion",
    cta: "Open ingestion",
  },
  {
    id: "need-evidence",
    label: "I need an enterprise handoff",
    detail:
      "Use Readiness and Setup to save evidence, copy the runbook, and confirm receiver posture.",
    href: "/dashboard/agent-guard/readiness",
    cta: "Open readiness",
  },
];

export const AGENT_GUARD_OPERATOR_GUIDE_PHASES: AgentGuardOperatorGuidePhase[] = [
  {
    id: "orient",
    label: "1. Orient",
    outcome:
      "Know what AgentGuard does today, what it does not do yet, and which page gives the current next action.",
    steps: [
      {
        id: "review-command-center",
        label: "Review current posture",
        goal:
          "Use the overview command center and Setup page to see the current deterministic next action.",
        href: "/dashboard/agent-guard",
        cta: "Open overview",
        evidence:
          "Command center posture, primary action, and supporting action list are visible.",
        guardrail:
          "The command center is guidance from loaded metadata; it does not mutate sources, policies, reviews, exports, acknowledgements, or enforcement.",
      },
      {
        id: "walk-setup",
        label: "Use setup as the live checklist",
        goal:
          "Follow the Setup page for source, activity, policy, review, evidence, and export readiness.",
        href: "/dashboard/agent-guard/setup",
        cta: "Open setup",
        evidence:
          "Setup progress, current next step, and enterprise runbook are visible.",
        guardrail:
          "Setup is read-only guidance and does not perform the steps for you.",
      },
    ],
  },
  {
    id: "connect",
    label: "2. Connect",
    outcome:
      "Prove that a customer-controlled server-side source can submit safe activity into AgentGuard.",
    steps: [
      {
        id: "create-source",
        label: "Create or confirm source key",
        goal:
          "Create a scoped source key for a trusted server-side wrapper or confirm an existing active source.",
        href: "/dashboard/agent-guard/ingestion",
        cta: "Open ingestion",
        evidence:
          "Active source exists, allowed tool scope is understood, and the key is stored only in a server-side secret.",
        guardrail:
          "Source keys are shown once and are not recoverable. Do not put them in browser code, evidence notes, tickets, or raw documentation.",
      },
      {
        id: "send-test-event",
        label: "Send a safe test event",
        goal:
          "Use the dashboard test event or starter code to confirm bearer-token submission, source attribution, and metadata-only storage.",
        href: "/dashboard/agent-guard/ingestion",
        cta: "Send test event",
        evidence:
          "Recent source-attributed activity appears and the response includes allow/block decision metadata.",
        guardrail:
          "Use safe sample content. AgentGuard stores metadata and content length, not raw prompt, response, file, or message content.",
      },
      {
        id: "record-integration-evidence",
        label: "Record implementation evidence",
        goal:
          "Document owner, wrapper location, evidence URL, checklist state, and status for the customer-controlled source.",
        href: "/dashboard/agent-guard/ingestion",
        cta: "Add evidence",
        evidence:
          "Metadata-only integration evidence record exists for the source implementation.",
        guardrail:
          "Integration evidence is not secret storage, raw content storage, legal advice, certification, compliance determination, or auditor attestation.",
      },
    ],
  },
  {
    id: "tune",
    label: "3. Tune",
    outcome:
      "Confirm starter policies fit the pilot scope and that submitted activity produces expected outcomes.",
    steps: [
      {
        id: "review-policy-baseline",
        label: "Review policy baseline",
        goal:
          "Review enabled policies and templates for block, warn, quarantine, and allow behavior.",
        href: "/dashboard/agent-guard/policies",
        cta: "Review policies",
        evidence:
          "Enabled starter policies match pilot scope and operators understand action behavior.",
        guardrail:
          "Templates only prefill editable drafts. They do not save, enable, or tune policies until an operator acts.",
      },
      {
        id: "confirm-policy-coverage",
        label: "Confirm policy coverage",
        goal:
          "Check whether source-attributed activity is producing expected block outcomes or warn/quarantine review rows.",
        href: "/dashboard/agent-guard/policies",
        cta: "Tune coverage",
        evidence:
          "Policy outcome analytics and source-to-policy coverage show expected outcomes or clear tuning gaps.",
        guardrail:
          "Coverage guidance is deterministic support from recent submitted activity; it is not AI-generated policy recommendation and not automatic policy tuning.",
      },
      {
        id: "work-review-queue",
        label: "Work review queue",
        goal:
          "Review warn and quarantine outcomes before broadening pilot coverage.",
        href: "/dashboard/agent-guard/reviews",
        cta: "Open reviews",
        evidence:
          "Needs-action review rows are assigned, resolved, dismissed, or intentionally left with owner context.",
        guardrail:
          "Quarantine is a review workflow label unless a customer-controlled integration acts on returned decisions.",
      },
    ],
  },
  {
    id: "prove",
    label: "4. Prove",
    outcome:
      "Package metadata-only evidence for pilot, board, client, auditor, or enterprise-readiness conversations.",
    steps: [
      {
        id: "review-readiness",
        label: "Review readiness report",
        goal:
          "Review source setup, recent submitted activity, policy coverage, review queue posture, export posture, and acknowledgement evidence.",
        href: "/dashboard/agent-guard/readiness",
        cta: "Open readiness",
        evidence:
          "Readiness posture, concerns, next actions, and copyable evidence packet are visible.",
        guardrail:
          "Readiness is operational evidence support, not legal advice, certification, compliance determination, or auditor attestation.",
      },
      {
        id: "save-evidence-packet",
        label: "Save evidence packet",
        goal:
          "Save point-in-time readiness and command-center evidence for enterprise-readiness history.",
        href: "/dashboard/agent-guard/readiness",
        cta: "Save packet",
        evidence:
          "Saved metadata-only evidence packet appears in readiness history.",
        guardrail:
          "Saving a packet does not change source keys, policies, reviews, export settings, acknowledgements, or enforcement.",
      },
      {
        id: "copy-runbook",
        label: "Copy enterprise runbook",
        goal:
          "Copy the enterprise runbook handoff from Setup once setup, integration evidence, SDK starter, packet, and export posture are ready enough to discuss.",
        href: "/dashboard/agent-guard/setup",
        cta: "Copy runbook",
        evidence:
          "Runbook includes setup progress, next step, integration evidence posture, SDK starter coverage, saved packet posture, export receiver posture, and boundaries.",
        guardrail:
          "The runbook is metadata-only operational support and does not create or change AgentGuard records.",
      },
    ],
  },
  {
    id: "integrate",
    label: "5. Integrate",
    outcome:
      "Prepare customer-owned receiver and middleware paths without implying native managed connectors are shipped.",
    steps: [
      {
        id: "test-export-destination",
        label: "Test export destination",
        goal:
          "Create a guarded HTTPS destination, keep dry-run on while testing, and send a signed metadata-only test event.",
        href: "/dashboard/agent-guard/settings",
        cta: "Open settings",
        evidence:
          "Destination health, last test attempt, dry-run/live posture, and signing-secret handling are known.",
        guardrail:
          "Outbound export only sends when destination status, automatic delivery, event selection, and dry-run gates allow it.",
      },
      {
        id: "review-connector-readiness",
        label: "Review connector readiness",
        goal:
          "Use the connector readiness matrix to design webhook, SIEM, SOAR/ticketing, chat/email, data platform, or audit repository paths.",
        href: "/dashboard/agent-guard/settings",
        cta: "Review matrix",
        evidence:
          "Customer-owned receiver, middleware owner, field mapping, and evidence to prepare are identified.",
        guardrail:
          "ShadowGuard supports guarded HTTPS export and receiver examples; native managed vendor connectors are not shipped today.",
      },
    ],
  },
];

export const AGENT_GUARD_OPERATOR_GUIDE_TROUBLESHOOTING: AgentGuardOperatorGuideTroubleshootingNote[] = [
  {
    id: "quiet-source",
    symptom: "No activity is appearing.",
    check:
      "Confirm the source is active, the bearer token is server-side, the tool name is allowed by source scope, and the test event returns HTTP 200.",
    href: "/dashboard/agent-guard/ingestion",
  },
  {
    id: "no-policy-outcomes",
    symptom: "Activity is arriving but no policies are firing.",
    check:
      "Review enabled policy conditions, source-to-policy coverage, risk/sensitivity matches, and whether warn/quarantine reviews are loading.",
    href: "/dashboard/agent-guard/policies",
  },
  {
    id: "review-load",
    symptom: "Warn or quarantine outcomes are piling up.",
    check:
      "Open Reviews, assign owners, resolve or dismiss stale rows, and narrow noisy pilot rules before expanding scope.",
    href: "/dashboard/agent-guard/reviews",
  },
  {
    id: "live-export-caution",
    symptom: "Export is live or receiver status is unclear.",
    check:
      "Review destination status, dry-run state, selected event types, latest attempts, and receiver verification before live rollout.",
    href: "/dashboard/agent-guard/settings",
  },
  {
    id: "handoff-gaps",
    symptom: "The enterprise runbook still says Needs review.",
    check:
      "Use Setup to identify the current next step, then add missing integration evidence, policy coverage, saved packet, or export receiver proof.",
    href: "/dashboard/agent-guard/setup",
  },
];

export function flattenAgentGuardOperatorGuideSteps(
  phases = AGENT_GUARD_OPERATOR_GUIDE_PHASES
): AgentGuardOperatorGuideStep[] {
  return phases.flatMap((phase) => phase.steps);
}

export function agentGuardOperatorGuideCounts(
  phases = AGENT_GUARD_OPERATOR_GUIDE_PHASES
) {
  return {
    phases: phases.length,
    steps: flattenAgentGuardOperatorGuideSteps(phases).length,
    shortcuts: AGENT_GUARD_OPERATOR_GUIDE_SHORTCUTS.length,
    troubleshootingNotes: AGENT_GUARD_OPERATOR_GUIDE_TROUBLESHOOTING.length,
  };
}
