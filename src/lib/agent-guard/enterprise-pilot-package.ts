import { AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT } from "./production-operations";

export type AgentGuardPilotTimelineId = "seven_day" | "fourteen_day";

export type AgentGuardPilotTimeline = {
  id: AgentGuardPilotTimelineId;
  label: string;
  duration: string;
  bestFor: string;
  cadence: readonly string[];
};

export type AgentGuardPilotPhase = {
  id: string;
  label: string;
  dayRange: string;
  operatorAction: string;
  customerAction: string;
  evidenceToCapture: string;
  dashboardHref: string;
  dashboardLabel: string;
  guardrail: string;
};

export type AgentGuardPilotArtifact = {
  id: string;
  label: string;
  source: string;
  purpose: string;
  boundary: string;
};

export type AgentGuardPilotPackage = {
  title: string;
  overview: string;
  endpoint: string;
  auth: string;
  timelines: readonly AgentGuardPilotTimeline[];
  phases: readonly AgentGuardPilotPhase[];
  entryCriteria: readonly string[];
  exitCriteria: readonly string[];
  operatorResponsibilities: readonly string[];
  customerResponsibilities: readonly string[];
  artifacts: readonly AgentGuardPilotArtifact[];
  boundary: string;
  packageText: string;
};

export const AGENT_GUARD_ENTERPRISE_PILOT_COPY = {
  title: "Enterprise pilot package",
  overview:
    "A repeatable first-customer pilot path for customer-controlled AgentGuard source implementation, safe activity submission, policy review, evidence handoff, and operations readiness.",
  boundary:
    "This pilot package is deployment guidance and readiness support only. It is not legal advice, not a certification, not a compliance determination, not an auditor attestation, not a security warranty, not automatic monitoring, not a hosted collector, not a managed connector, and not enforcement by itself.",
} as const;

export const AGENT_GUARD_PILOT_TIMELINES = [
  {
    id: "seven_day",
    label: "7-day focused pilot",
    duration: "1 week",
    bestFor:
      "One trusted source, one to three AI tools, one operator group, and a narrow proof-of-value window.",
    cadence: [
      "Day 1: scope pilot, confirm source owner, and create source key.",
      "Days 2-3: wire the server-side wrapper and send safe test events.",
      "Days 4-5: tune baseline policies and review submitted activity outcomes.",
      "Days 6-7: save readiness evidence, copy handoff artifacts, and decide whether to expand.",
    ],
  },
  {
    id: "fourteen_day",
    label: "14-day enterprise pilot",
    duration: "2 weeks",
    bestFor:
      "Multiple teams, a fuller policy baseline, optional export receiver review, and a leadership-readiness handoff.",
    cadence: [
      "Days 1-2: define pilot scope, data boundaries, source owner, and success criteria.",
      "Days 3-5: implement source-key wrapper and confirm safe source-attributed activity.",
      "Days 6-8: validate policy outcomes, review queue behavior, and source-to-policy coverage.",
      "Days 9-11: review readiness evidence, saved packets, rollout acknowledgements, and export posture.",
      "Days 12-14: package evidence, run smoke tests, review operations runbook, and decide next scope.",
    ],
  },
] satisfies readonly AgentGuardPilotTimeline[];

export const AGENT_GUARD_PILOT_PHASES = [
  {
    id: "scope",
    label: "Scope the pilot",
    dayRange: "Day 1",
    operatorAction:
      "Confirm the pilot business workflow, AI tool names, operator owner, success criteria, and data boundary.",
    customerAction:
      "Name the customer engineering owner and confirm which server-side system will submit activity.",
    evidenceToCapture:
      "Pilot scope, owner, included tools, excluded data, and agreed success signals.",
    dashboardHref: "/dashboard/agent-guard/setup",
    dashboardLabel: "Open setup",
    guardrail:
      "Keep the scope narrow. Do not imply AgentGuard automatically monitors tools outside the submitting source.",
  },
  {
    id: "source",
    label: "Create and protect the source key",
    dayRange: "Day 1-2",
    operatorAction:
      "Create a scoped source key, copy it once, and provide server-side handling guidance.",
    customerAction:
      "Store the source key as a server-side secret and keep it out of browser code, tickets, logs, and evidence notes.",
    evidenceToCapture:
      "Source name, environment, allowed tool scope, token hint, owner, and rotation schedule.",
    dashboardHref: "/dashboard/agent-guard/ingestion",
    dashboardLabel: "Open ingestion",
    guardrail:
      "Never store or paste source keys, private keys, signing secrets, raw prompts, responses, files, messages, or customer data.",
  },
  {
    id: "endpoint",
    label: "Submit safe test activity",
    dayRange: "Day 2-4",
    operatorAction:
      "Confirm the wrapper calls the canonical production endpoint and returns decision metadata.",
    customerAction:
      `POST safe sample activity to ${AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.url} with ${AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.auth}.`,
    evidenceToCapture:
      "HTTP status, accepted activity id, source attribution, last-used metadata, and non-sensitive request metadata.",
    dashboardHref: "/dashboard/agent-guard/monitoring",
    dashboardLabel: "Open monitoring",
    guardrail:
      "Use safe sample content first. Raw submitted content is classified in memory and must not be preserved in handoff notes.",
  },
  {
    id: "policy",
    label: "Tune baseline policy outcomes",
    dayRange: "Day 4-8",
    operatorAction:
      "Review guided policy templates, enabled policies, source-to-policy coverage, and warn/quarantine review behavior.",
    customerAction:
      "Confirm expected allow, block, warn, and quarantine outcomes before expanding pilot coverage.",
    evidenceToCapture:
      "Policy baseline, expected outcomes, review queue posture, and unresolved decisions.",
    dashboardHref: "/dashboard/agent-guard/policies",
    dashboardLabel: "Review policies",
    guardrail:
      "Policy guidance is deterministic operator support, not AI-generated policy tuning or automatic enforcement across every AI tool.",
  },
  {
    id: "review",
    label: "Review monitoring and queue posture",
    dayRange: "Day 6-10",
    operatorAction:
      "Review Monitoring and Reviews for activity rollups, PII/credential signals, users, blocked outcomes, and open review load.",
    customerAction:
      "Validate that pilot activity appears as expected and resolve or assign warn/quarantine reviews.",
    evidenceToCapture:
      "Tool activity, user count, risk posture, policy decision reviews, and open review actions.",
    dashboardHref: "/dashboard/agent-guard/reviews",
    dashboardLabel: "Open reviews",
    guardrail:
      "Monitoring reflects submitted activity only; it is not universal activity capture from every AI product.",
  },
  {
    id: "evidence",
    label: "Package readiness evidence",
    dayRange: "Day 9-13",
    operatorAction:
      "Save or review readiness evidence, implementation evidence, rollout acknowledgements, handoff package, and smoke-test checklist.",
    customerAction:
      "Confirm evidence is metadata-only and suitable for leadership, internal, or auditor-preparation conversations.",
    evidenceToCapture:
      "Readiness report, saved packet status, integration evidence, enterprise runbook, implementation checklist, and handoff package.",
    dashboardHref: "/dashboard/agent-guard/readiness",
    dashboardLabel: "Open readiness",
    guardrail:
      "Evidence supports readiness conversations; it is not legal advice, certification, compliance determination, or auditor attestation.",
  },
  {
    id: "operations",
    label: "Close with operations posture",
    dayRange: "Day 12-14",
    operatorAction:
      "Run the enterprise smoke-test checklist, review endpoint/operations runbook, and document expansion or pause decision.",
    customerAction:
      "Decide whether to expand source/tool scope, keep observing, or pause pending evidence gaps.",
    evidenceToCapture:
      "Smoke-test result, operations runbook review, export receiver posture, next scope, and unresolved gaps.",
    dashboardHref: "/dashboard/agent-guard/guide",
    dashboardLabel: "Open guide",
    guardrail:
      "Expansion should follow proved source attribution, policy coverage, review capacity, and operations readiness.",
  },
] satisfies readonly AgentGuardPilotPhase[];

export const AGENT_GUARD_PILOT_ENTRY_CRITERIA = [
  "Pilot sponsor and operator owner are named.",
  "Customer engineering owner can implement a trusted server-side wrapper.",
  "Pilot source, AI tool names, included users or teams, and excluded data are agreed.",
  "Source keys can be stored in server-side secrets only.",
  "Success criteria are framed as readiness evidence and operational signal, not compliance or certification.",
] as const;

export const AGENT_GUARD_PILOT_EXIT_CRITERIA = [
  "At least one active source has submitted safe source-attributed activity.",
  "Policy outcomes are reviewed and expected behavior is documented.",
  "Warn/quarantine reviews are resolved, assigned, or intentionally accepted as open pilot work.",
  "Readiness evidence, handoff package, implementation checklist, and operations runbook have been reviewed.",
  "Expansion, observe, or pause decision is documented with unresolved gaps.",
] as const;

export const AGENT_GUARD_PILOT_OPERATOR_RESPONSIBILITIES = [
  "Guide pilot scope and success criteria.",
  "Create scoped source keys and explain server-side handling.",
  "Review source attribution, monitoring, policy outcomes, review queue, readiness evidence, and handoff package.",
  "Run the enterprise smoke-test checklist before a leadership-facing handoff.",
  "Keep boundaries clear and document unresolved gaps.",
] as const;

export const AGENT_GUARD_PILOT_CUSTOMER_RESPONSIBILITIES = [
  "Implement the customer-controlled server-side wrapper.",
  "Store source keys only in server-side secrets.",
  "Submit only authorized pilot activity.",
  "Honor returned AgentGuard decisions inside the customer-owned workflow when that is part of the pilot.",
  "Review policy outcomes, evidence, and expansion decisions with the operator.",
] as const;

export const AGENT_GUARD_PILOT_ARTIFACTS = [
  {
    id: "endpoint",
    label: "Canonical endpoint",
    source: AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.url,
    purpose: "Gives customer engineering one stable production ingest target.",
    boundary: AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.boundary,
  },
  {
    id: "implementation-checklist",
    label: "Implementation checklist",
    source: "/dashboard/agent-guard/setup",
    purpose: "Customer-engineer checklist for source-key handling, safe test events, and evidence expectations.",
    boundary:
      "Contains no source keys, signing secrets, raw prompts, responses, files, messages, or customer data.",
  },
  {
    id: "readiness-report",
    label: "Readiness report",
    source: "/dashboard/agent-guard/readiness",
    purpose: "Summarizes source, policy, review, export, acknowledgement, and evidence posture.",
    boundary:
      "Readiness support only; not certification, compliance determination, legal advice, or auditor attestation.",
  },
  {
    id: "handoff-package",
    label: "Enterprise handoff package",
    source: "/dashboard/agent-guard/setup",
    purpose: "Groups proof artifacts and gaps into one operator-facing package.",
    boundary:
      "Operational evidence handoff only; not security warranty, automatic monitoring, managed connector delivery, or enforcement.",
  },
  {
    id: "operations-runbook",
    label: "Production operations runbook",
    source: "docs/production-operations-runbook.md",
    purpose: "Documents endpoints, env vars, migration checks, rollback, backup/restore, and incident-response handoff.",
    boundary:
      "Operations support only; not incident-response automation or a substitute for customer security operations.",
  },
] satisfies readonly AgentGuardPilotArtifact[];

function bulletItems(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function timelineText(timelines: readonly AgentGuardPilotTimeline[]): string {
  return timelines
    .map((timeline) =>
      [
        `## ${timeline.label}`,
        "",
        `Duration: ${timeline.duration}`,
        `Best for: ${timeline.bestFor}`,
        "",
        bulletItems(timeline.cadence),
      ].join("\n")
    )
    .join("\n\n");
}

function phaseText(phases: readonly AgentGuardPilotPhase[]): string {
  return phases
    .map((phase) =>
      [
        `## ${phase.dayRange}: ${phase.label}`,
        "",
        `Operator: ${phase.operatorAction}`,
        `Customer: ${phase.customerAction}`,
        `Evidence: ${phase.evidenceToCapture}`,
        `Dashboard: ${phase.dashboardHref}`,
        `Guardrail: ${phase.guardrail}`,
      ].join("\n")
    )
    .join("\n\n");
}

function artifactText(artifacts: readonly AgentGuardPilotArtifact[]): string {
  return artifacts
    .map(
      (artifact) =>
        `- ${artifact.label}: ${artifact.purpose} Source: ${artifact.source}. Boundary: ${artifact.boundary}`
    )
    .join("\n");
}

export function buildAgentGuardEnterprisePilotPackage(): AgentGuardPilotPackage {
  const packageText = [
    "# AgentGuard Enterprise Pilot Package",
    "",
    AGENT_GUARD_ENTERPRISE_PILOT_COPY.overview,
    "",
    `Endpoint: ${AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.method} ${AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.url}`,
    `Auth: ${AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.auth}`,
    "",
    `Boundary: ${AGENT_GUARD_ENTERPRISE_PILOT_COPY.boundary}`,
    "",
    "## Entry criteria",
    "",
    bulletItems(AGENT_GUARD_PILOT_ENTRY_CRITERIA),
    "",
    "## Timeline options",
    "",
    timelineText(AGENT_GUARD_PILOT_TIMELINES),
    "",
    "## Pilot phases",
    "",
    phaseText(AGENT_GUARD_PILOT_PHASES),
    "",
    "## Operator responsibilities",
    "",
    bulletItems(AGENT_GUARD_PILOT_OPERATOR_RESPONSIBILITIES),
    "",
    "## Customer responsibilities",
    "",
    bulletItems(AGENT_GUARD_PILOT_CUSTOMER_RESPONSIBILITIES),
    "",
    "## Proof artifacts",
    "",
    artifactText(AGENT_GUARD_PILOT_ARTIFACTS),
    "",
    "## Exit criteria",
    "",
    bulletItems(AGENT_GUARD_PILOT_EXIT_CRITERIA),
  ].join("\n");

  return {
    title: AGENT_GUARD_ENTERPRISE_PILOT_COPY.title,
    overview: AGENT_GUARD_ENTERPRISE_PILOT_COPY.overview,
    endpoint: AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.url,
    auth: AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.auth,
    timelines: AGENT_GUARD_PILOT_TIMELINES,
    phases: AGENT_GUARD_PILOT_PHASES,
    entryCriteria: AGENT_GUARD_PILOT_ENTRY_CRITERIA,
    exitCriteria: AGENT_GUARD_PILOT_EXIT_CRITERIA,
    operatorResponsibilities: AGENT_GUARD_PILOT_OPERATOR_RESPONSIBILITIES,
    customerResponsibilities: AGENT_GUARD_PILOT_CUSTOMER_RESPONSIBILITIES,
    artifacts: AGENT_GUARD_PILOT_ARTIFACTS,
    boundary: AGENT_GUARD_ENTERPRISE_PILOT_COPY.boundary,
    packageText,
  };
}

export function agentGuardEnterprisePilotCounts(
  pilotPackage = buildAgentGuardEnterprisePilotPackage()
) {
  return {
    timelines: pilotPackage.timelines.length,
    phases: pilotPackage.phases.length,
    artifacts: pilotPackage.artifacts.length,
    entryCriteria: pilotPackage.entryCriteria.length,
    exitCriteria: pilotPackage.exitCriteria.length,
  };
}
