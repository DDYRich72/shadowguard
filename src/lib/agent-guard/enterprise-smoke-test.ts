export type AgentGuardEnterpriseSmokeTestGroupId =
  | "access"
  | "discovery"
  | "governance"
  | "agentguard"
  | "evidence"
  | "export";

export type AgentGuardEnterpriseSmokeTestItem = {
  id: string;
  label: string;
  action: string;
  expectedResult: string;
  failureSignal: string;
  fixHref: string;
  fixLabel: string;
  guardrail: string;
};

export type AgentGuardEnterpriseSmokeTestGroup = {
  id: AgentGuardEnterpriseSmokeTestGroupId;
  label: string;
  summary: string;
  items: AgentGuardEnterpriseSmokeTestItem[];
};

export const AGENT_GUARD_ENTERPRISE_SMOKE_TEST_COPY = {
  title: "Enterprise smoke-test checklist",
  overview:
    "Operator-run demo and release readiness checks across ShadowGuard discovery, AI Governance, AgentGuard activity evaluation, evidence, and export posture.",
  boundary:
    "This checklist is operator-run readiness guidance. It does not automate tests, create data, mutate settings, prove compliance, certify security, provide legal advice, expand monitoring, create managed connectors, or enforce policy by itself.",
} as const;

export const AGENT_GUARD_ENTERPRISE_SMOKE_TEST_GROUPS: AgentGuardEnterpriseSmokeTestGroup[] = [
  {
    id: "access",
    label: "Access and security",
    summary:
      "Confirm the operator can reach privileged dashboard flows and MFA-sensitive actions before a demo or release handoff.",
    items: [
      {
        id: "login-mfa",
        label: "Login and MFA posture",
        action:
          "Sign in as an admin or manager, open Security settings, and confirm MFA or recovery posture is available for privileged work.",
        expectedResult:
          "Dashboard loads, operator identity is visible, and MFA/security recovery controls are reachable.",
        failureSignal:
          "Login loops, missing operator role, blocked privileged mutation, or unclear MFA recovery state.",
        fixHref: "/dashboard/settings/security",
        fixLabel: "Open security",
        guardrail:
          "Do not weaken MFA or role gates to pass a demo. Fix access posture before mutating production data.",
      },
      {
        id: "dashboard-overview",
        label: "Dashboard overview loads",
        action:
          "Open the main dashboard and confirm overview data, scan status, and navigation are visible.",
        expectedResult:
          "Dashboard chrome, search, account controls, and primary ShadowGuard navigation render without errors.",
        failureSignal:
          "Blank dashboard, server error, missing navigation, or account controls hidden behind layout issues.",
        fixHref: "/dashboard",
        fixLabel: "Open dashboard",
        guardrail:
          "This confirms operator access only; it does not prove customer data completeness or production security.",
      },
    ],
  },
  {
    id: "discovery",
    label: "ShadowGuard discovery",
    summary:
      "Confirm the discovery wedge is visible and scan posture can be explained without requiring a new connector during the smoke test.",
    items: [
      {
        id: "scan-posture",
        label: "Scan and app inventory",
        action:
          "Open Applications, confirm connected app rows or scan-empty posture are visible, and run a scan only when the environment is expected to support it.",
        expectedResult:
          "Applications page shows inventory, risk labels, approval/block state, or a clear connector/setup state.",
        failureSignal:
          "No inventory and no clear connector/setup state, scan action unavailable for an expected connected org, or app rows fail to load.",
        fixHref: "/dashboard/apps",
        fixLabel: "Open applications",
        guardrail:
          "Do not imply ShadowGuard discovered tools from disconnected Google or Microsoft tenants.",
      },
      {
        id: "alerts-audit",
        label: "Alerts and audit posture",
        action:
          "Open Alerts and Audit to confirm recent findings and administrative evidence are visible where expected.",
        expectedResult:
          "Alerts and audit views load with either recent records or a clear empty state.",
        failureSignal:
          "Errors loading alerts/audit or missing evidence for actions that should have been recorded.",
        fixHref: "/dashboard/alerts",
        fixLabel: "Open alerts",
        guardrail:
          "Alerts and audit records support operational review; they are not immutable external audit-vault evidence.",
      },
    ],
  },
  {
    id: "governance",
    label: "AI Governance workflow",
    summary:
      "Confirm governance inventory, risk assessment, reporting, and stakeholder export paths still form one coherent workflow.",
    items: [
      {
        id: "ai-system-assessment",
        label: "AI system and assessment",
        action:
          "Open AI Systems, confirm at least one governed system or create/test with approved sample data, then review the assessment workflow.",
        expectedResult:
          "AI system detail shows assessment status, risk tier, recommended controls, and evidence/control posture.",
        failureSignal:
          "AI Systems fail to load, assessment state is missing, or controls/readiness no longer appear after assessment.",
        fixHref: "/dashboard/ai-systems",
        fixLabel: "Open AI Systems",
        guardrail:
          "Use approved sample or customer-authorized data only; do not invent regulated conclusions.",
      },
      {
        id: "governance-report",
        label: "Report and export pack",
        action:
          "Open the governance report path, confirm report content, saved snapshots, and client export pack access are understandable.",
        expectedResult:
          "Reports show readiness, risk posture, evidence gaps, next actions, saved snapshots, and export pack flow.",
        failureSignal:
          "Report pages error, snapshots are missing when expected, or export pack status is confusing.",
        fixHref: "/dashboard/governance-report",
        fixLabel: "Open report",
        guardrail:
          "Reports support readiness conversations; they do not certify compliance or provide legal advice.",
      },
    ],
  },
  {
    id: "agentguard",
    label: "AgentGuard activity and policy",
    summary:
      "Confirm customer-controlled activity submission, source attribution, monitoring, policy outcomes, and review queues work before any enterprise demo.",
    items: [
      {
        id: "source-test-event",
        label: "Source key and safe test event",
        action:
          "Open Ingestion, confirm an active source exists, send a safe test event, and verify the response returns HTTP 200 decision metadata.",
        expectedResult:
          "Source posture updates, test result is accepted, and recent source-attributed activity appears.",
        failureSignal:
          "Invalid bearer token, disallowed tool scope, no recent activity, or test event returns a non-200 response.",
        fixHref: "/dashboard/agent-guard/ingestion",
        fixLabel: "Open ingestion",
        guardrail:
          "Use safe sample content and keep source keys server-side; raw prompts, responses, files, and messages are not persisted.",
      },
      {
        id: "monitoring-policy-review",
        label: "Monitoring, policies, and reviews",
        action:
          "Open Monitoring, Policies, and Reviews to confirm activity rollups, deterministic policy outcomes, and warn/quarantine review rows are visible where expected.",
        expectedResult:
          "Monitoring shows tool activity, policies show outcome analytics, and Reviews show needs-action or empty-state posture.",
        failureSignal:
          "Activity appears without source attribution, policies do not load, or warn/quarantine outcomes disappear from Reviews.",
        fixHref: "/dashboard/agent-guard/monitoring",
        fixLabel: "Open monitoring",
        guardrail:
          "Policy analytics and review queues are deterministic operator support, not AI-generated policy tuning or automatic enforcement.",
      },
    ],
  },
  {
    id: "evidence",
    label: "Evidence and handoff",
    summary:
      "Confirm AgentGuard readiness evidence can be reviewed, saved, and handed off without storing secrets or raw content.",
    items: [
      {
        id: "readiness-evidence",
        label: "Readiness and evidence packet",
        action:
          "Open Readiness, confirm posture, concerns, next actions, copyable evidence packet, and saved packet history.",
        expectedResult:
          "Readiness report shows source, policy, review, export, acknowledgement, and evidence-packet posture.",
        failureSignal:
          "Readiness cannot load, saved packet history is unavailable after migration, or posture contradicts setup data.",
        fixHref: "/dashboard/agent-guard/readiness",
        fixLabel: "Open readiness",
        guardrail:
          "Evidence packets are metadata-only operational support, not certification, compliance determination, or auditor attestation.",
      },
      {
        id: "setup-runbook-checklist",
        label: "Setup, runbook, and implementation checklist",
        action:
          "Open Setup, review current next step, copy the enterprise runbook, and download the implementation checklist.",
        expectedResult:
          "Setup progress, next action, runbook, implementation checklist, and missing-evidence warnings are readable.",
        failureSignal:
          "Runbook/checklist actions are missing, text is unreadable, or setup status hides key gaps.",
        fixHref: "/dashboard/agent-guard/setup",
        fixLabel: "Open setup",
        guardrail:
          "Runbooks and checklists are handoff support; they do not create sources, save evidence, change policy, or expand enforcement.",
      },
    ],
  },
  {
    id: "export",
    label: "Export readiness",
    summary:
      "Confirm outbound export posture is understandable and safe before any live-send conversation.",
    items: [
      {
        id: "export-destination",
        label: "Destination dry-run/live posture",
        action:
          "Open Settings, confirm export destination status, event type selection, dry-run state, latest attempts, replay posture, and receiver examples.",
        expectedResult:
          "Destinations clearly show disabled/enabled, auto off/on, dry-run/live, last attempt, receiver guidance, and replay controls where applicable.",
        failureSignal:
          "Live sends are on unexpectedly, dry-run state is unclear, or latest attempt history is missing after a test.",
        fixHref: "/dashboard/agent-guard/settings",
        fixLabel: "Open settings",
        guardrail:
          "Live outbound delivery should only run after destination status, automatic delivery, event selection, receiver verification, and dry-run gates are intentionally reviewed.",
      },
      {
        id: "connector-readiness",
        label: "Connector readiness story",
        action:
          "Review connector readiness and receiver kit copy to confirm customer-owned middleware requirements are clear.",
        expectedResult:
          "Webhook, SIEM, SOAR/ticketing, chat/email, data platform, and audit/evidence paths are framed as customer-owned receiver or middleware work.",
        failureSignal:
          "Copy implies native managed connectors, automatic ticket creation, broad notification routing, or hosted receiver operations are shipped.",
        fixHref: "/dashboard/agent-guard/settings",
        fixLabel: "Review connectors",
        guardrail:
          "ShadowGuard supports guarded HTTPS export and receiver examples today; native managed vendor connectors are not shipped.",
      },
    ],
  },
];

export function flattenAgentGuardEnterpriseSmokeTestItems(
  groups = AGENT_GUARD_ENTERPRISE_SMOKE_TEST_GROUPS
): AgentGuardEnterpriseSmokeTestItem[] {
  return groups.flatMap((group) => group.items);
}

export function agentGuardEnterpriseSmokeTestCounts(
  groups = AGENT_GUARD_ENTERPRISE_SMOKE_TEST_GROUPS
) {
  return {
    groups: groups.length,
    items: flattenAgentGuardEnterpriseSmokeTestItems(groups).length,
  };
}
