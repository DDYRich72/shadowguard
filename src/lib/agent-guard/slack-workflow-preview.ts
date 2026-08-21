export type AgentGuardSlackPreviewGateStatus =
  | "decided_for_preview"
  | "requires_future_build"
  | "out_of_scope";

export type AgentGuardSlackPreviewGate = {
  id: string;
  label: string;
  status: AgentGuardSlackPreviewGateStatus;
  statusLabel: string;
  decision: string;
  futureRequirement: string;
  safetyCheck: string;
};

export type AgentGuardSlackPreviewField = {
  sourceField: string;
  slackLabel: string;
  required: boolean;
  redaction: string;
  notes: string;
};

export type AgentGuardSlackPreviewRolloutStep = {
  step: string;
  owner: string;
  evidence: string;
};

export const AGENT_GUARD_SLACK_PREVIEW_COPY = {
  title: "Slack workflow URL preview",
  overview:
    "The guarded Slack workflow URL or incoming webhook preview uses encrypted URL storage, URL hints only, guarded manual tests, delivery attempts, and explicit live-send gates.",
  decision:
    "Use this preview only for customer-owned Slack workflow or incoming webhook URLs. Keep targets disabled and dry-run by default until an operator confirms ownership, approval, manual test evidence, and rollback ownership.",
  boundary:
    "Slack workflow URL preview stores encrypted customer-owned Slack URL targets and can record metadata-only manual test attempts. It is not a shipped Slack app, not Slack OAuth, not Slack bot-token delivery, not channel discovery, not interactive Slack workflows, not Teams/email/SIEM/SOAR/ticketing delivery, not managed incident response, not automatic retry, not automatic escalation, not legal advice, not certification, not compliance determination, not auditor attestation, and not a security warranty.",
} as const;

export const AGENT_GUARD_SLACK_PREVIEW_DOC_NOTES = [
  {
    label: "Slack incoming webhooks",
    url: "https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks",
    note:
      "Incoming webhooks are unique URLs that receive JSON payloads and post messages into Slack.",
  },
  {
    label: "Slack webhook secret handling",
    url: "https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks",
    note:
      "Slack treats webhook URLs as secrets and warns not to share them publicly.",
  },
  {
    label: "Slack Workflow Builder webhooks",
    url: "https://docs.slack.dev/workflows/workflow-builder/",
    note:
      "Workflow Builder can use webhook triggers to start workflows from outside Slack; customer workspace feature availability must be confirmed.",
  },
] as const;

export const AGENT_GUARD_SLACK_PREVIEW_GATE_STATUS_LABELS: Record<
  AgentGuardSlackPreviewGateStatus,
  string
> = {
  decided_for_preview: "Decided for preview",
  requires_future_build: "Requires future build",
  out_of_scope: "Out of scope",
};

export const AGENT_GUARD_SLACK_PREVIEW_GATES: AgentGuardSlackPreviewGate[] = [
  {
    id: "credential_model",
    label: "Credential model",
    status: "decided_for_preview",
    statusLabel: AGENT_GUARD_SLACK_PREVIEW_GATE_STATUS_LABELS.decided_for_preview,
    decision:
      "Customer provides a Slack workflow URL or incoming webhook URL created in their Slack workspace.",
    futureRequirement:
      "Treat the URL as customer secret material from first paste through deletion.",
    safetyCheck:
      "Never include the Slack URL in browser copy, logs, delivery-attempt payloads, exported handoffs, or support screenshots.",
  },
  {
    id: "storage_model",
    label: "Encrypted storage",
    status: "decided_for_preview",
    statusLabel: AGENT_GUARD_SLACK_PREVIEW_GATE_STATUS_LABELS.decided_for_preview,
    decision:
      "Do not reuse the existing plaintext export destination endpoint_url field for Slack URLs.",
    futureRequirement:
      "Store Slack URLs encrypted with URL hint only, no plaintext reveal after creation or replacement, and audit events for create, test, disable, delete, and replacement.",
    safetyCheck:
      "The current initial schema must be installed before any Slack URL can be saved.",
  },
  {
    id: "role_mfa_gates",
    label: "Role and MFA gates",
    status: "decided_for_preview",
    statusLabel: AGENT_GUARD_SLACK_PREVIEW_GATE_STATUS_LABELS.decided_for_preview,
    decision:
      "Only admin or manager users with the existing privileged mutation posture should create, update, disable, delete, or test Slack targets.",
    futureRequirement:
      "Future API routes must apply the same org ownership, role, same-origin, and MFA checks used by sensitive AgentGuard mutations.",
    safetyCheck:
      "Viewer access remains read-only and must never reveal stored Slack URLs.",
  },
  {
    id: "event_scope",
    label: "Allowed event scope",
    status: "decided_for_preview",
    statusLabel: AGENT_GUARD_SLACK_PREVIEW_GATE_STATUS_LABELS.decided_for_preview,
    decision:
      "First preview allows manual tests plus selected alert-worthy events only: blocked policy and review required.",
    futureRequirement:
      "Evaluated activity stays off for Slack preview unless a later spec approves lower-signal notifications.",
    safetyCheck:
      "Default live sends off, dry-run or manual test first, and explicit event selection required.",
  },
  {
    id: "message_fields",
    label: "Message fields",
    status: "decided_for_preview",
    statusLabel: AGENT_GUARD_SLACK_PREVIEW_GATE_STATUS_LABELS.decided_for_preview,
    decision:
      "Slack message content must use a metadata-only allowlist and omit raw content and unreviewed freeform metadata.",
    futureRequirement:
      "Customer approves whether subject user email is shown, partially redacted, or replaced with a customer-owned identifier.",
    safetyCheck:
      "No source keys, signing secrets, bearer tokens, private keys, raw prompts, raw responses, files, messages, or Slack URLs in messages.",
  },
  {
    id: "manual_test",
    label: "Manual test path",
    status: "decided_for_preview",
    statusLabel: AGENT_GUARD_SLACK_PREVIEW_GATE_STATUS_LABELS.decided_for_preview,
    decision:
      "Provide a manual metadata-only test event before live sends can be enabled.",
    futureRequirement:
      "Manual tests should use a clearly labeled test payload and record HTTP result, duration, failure group, and tester identity.",
    safetyCheck:
      "Manual tests must not enable automatic delivery or create retry loops.",
  },
  {
    id: "live_send_gate",
    label: "Live-send gate",
    status: "decided_for_preview",
    statusLabel: AGENT_GUARD_SLACK_PREVIEW_GATE_STATUS_LABELS.decided_for_preview,
    decision:
      "Live Slack sends require enabled target, event selection, successful manual test, owner metadata, customer approval, and explicit live-send toggle.",
    futureRequirement:
      "Future UI must show live caution copy and a one-click disable path.",
    safetyCheck:
      "No automatic promotion from test to live.",
  },
  {
    id: "failure_behavior",
    label: "Failure behavior",
    status: "decided_for_preview",
    statusLabel: AGENT_GUARD_SLACK_PREVIEW_GATE_STATUS_LABELS.decided_for_preview,
    decision:
      "Record failure posture for operator review; do not add background retry, automatic escalation, or ticket creation.",
    futureRequirement:
      "Future implementation can support explicit manual replay only after idempotency and duplicate-message guidance is shown.",
    safetyCheck:
      "Slack failures must not block AgentGuard activity ingestion or policy decisions.",
  },
  {
    id: "rate_limits",
    label: "Rate limits",
    status: "requires_future_build",
    statusLabel: AGENT_GUARD_SLACK_PREVIEW_GATE_STATUS_LABELS.requires_future_build,
    decision:
      "Limit preview delivery to low-volume alert-worthy events and document customer-owned alert fatigue controls.",
    futureRequirement:
      "Existing guarded APIs are rate-limited; add deeper per-target delivery throttles before broad live Slack rollout.",
    safetyCheck:
      "If rate-limited or throttled, record the posture and require manual operator review.",
  },
  {
    id: "slack_app_oauth",
    label: "Slack app and OAuth",
    status: "out_of_scope",
    statusLabel: AGENT_GUARD_SLACK_PREVIEW_GATE_STATUS_LABELS.out_of_scope,
    decision:
      "Do not build Slack app installation, OAuth, bot-token delivery, channel discovery, slash commands, or interactive workflows in the preview.",
    futureRequirement:
      "A separate spec is required before any Slack app or OAuth flow.",
    safetyCheck:
      "Do not claim Slack app support from this preview.",
  },
];

export const AGENT_GUARD_SLACK_PREVIEW_ALLOWED_EVENTS = [
  "manual test event",
  "agentguard.policy.blocked",
  "agentguard.review.required",
] as const;

export const AGENT_GUARD_SLACK_PREVIEW_FIELDS: AgentGuardSlackPreviewField[] = [
  {
    sourceField: "eventId",
    slackLabel: "Event ID",
    required: true,
    redaction: "copy",
    notes: "Used for dedupe and support correlation.",
  },
  {
    sourceField: "eventType",
    slackLabel: "Event type",
    required: true,
    redaction: "copy",
    notes: "Limited to allowed preview event scopes.",
  },
  {
    sourceField: "occurredAt",
    slackLabel: "Observed",
    required: true,
    redaction: "copy",
    notes: "Use AgentGuard event time rather than Slack delivery time.",
  },
  {
    sourceField: "activity.toolName",
    slackLabel: "Tool",
    required: true,
    redaction: "copy",
    notes: "Submitted tool name from AgentGuard metadata.",
  },
  {
    sourceField: "activity.userEmail",
    slackLabel: "User",
    required: false,
    redaction: "customer-approved full, partial, or replaced identifier",
    notes: "Customer must approve user-identifying display before live sends.",
  },
  {
    sourceField: "activity.riskLevel",
    slackLabel: "Risk",
    required: true,
    redaction: "copy",
    notes: "Use as a severity hint only.",
  },
  {
    sourceField: "activity.reason",
    slackLabel: "Decision reason",
    required: true,
    redaction: "copy safe policy reason only",
    notes: "No raw prompt or response content is included.",
  },
  {
    sourceField: "alert.severity",
    slackLabel: "Alert severity",
    required: false,
    redaction: "copy",
    notes: "Preferred priority when alert metadata is present.",
  },
  {
    sourceField: "alert.title",
    slackLabel: "Title",
    required: true,
    redaction: "derive if absent",
    notes: "Use a short metadata-only notification title.",
  },
  {
    sourceField: "alert.summary",
    slackLabel: "Summary",
    required: true,
    redaction: "copy safe alert summary only",
    notes: "Must not include raw content or unreviewed freeform metadata.",
  },
];

export const AGENT_GUARD_SLACK_PREVIEW_ROLLOUT_STEPS: AgentGuardSlackPreviewRolloutStep[] = [
  {
    step: "Customer creates Slack workflow URL or incoming webhook URL.",
    owner: "Customer Slack admin or channel owner",
    evidence: "Target owner, channel/workflow purpose, and secret-storage approval.",
  },
  {
    step: "ShadowGuard operator creates future Slack target through MFA-gated UI.",
    owner: "ShadowGuard admin or manager",
    evidence: "URL hint, target owner, event scope, and audit event.",
  },
  {
    step: "Operator sends manual test event.",
    owner: "ShadowGuard admin or manager",
    evidence: "HTTP result, duration, failure group if any, and Slack-side confirmation.",
  },
  {
    step: "Customer approves message fields and live-send posture.",
    owner: "Customer receiver or security owner",
    evidence: "Approved event types, user identifier display choice, and rollback owner.",
  },
  {
    step: "Live sends are explicitly enabled or left disabled.",
    owner: "ShadowGuard admin or manager",
    evidence: "Live toggle state, latest test result, and disable/delete route.",
  },
];

export const AGENT_GUARD_SLACK_PREVIEW_CUSTOMER_RESPONSIBILITIES = [
  "Create and own the Slack workflow URL or incoming webhook URL.",
  "Confirm Slack workspace, channel, Workflow Builder, and feature availability.",
  "Approve destination channel or workflow audience.",
  "Approve message fields and user-identifying display.",
  "Own Slack retention, channel permissions, alert fatigue, and downstream escalation.",
  "Confirm whether failed sends should be manually replayed or suppressed.",
] as const;

export const AGENT_GUARD_SLACK_PREVIEW_FORBIDDEN_CLAIMS = [
  "Do not claim a shipped Slack app.",
  "Do not claim Slack OAuth or bot-token delivery.",
  "Do not claim ShadowGuard manages Slack workspace administration.",
  "Do not claim Slack messages are guaranteed to deliver.",
  "Do not claim Slack notifications replace SIEM, ticketing, incident response, or compliance evidence.",
  "Do not claim automatic Slack failure escalation.",
  "Do not claim background retry for Slack failures.",
] as const;

export function agentGuardSlackPreviewGateCounts(
  gates = AGENT_GUARD_SLACK_PREVIEW_GATES
): Record<AgentGuardSlackPreviewGateStatus, number> {
  return gates.reduce(
    (counts, gate) => ({
      ...counts,
      [gate.status]: counts[gate.status] + 1,
    }),
    {
      decided_for_preview: 0,
      requires_future_build: 0,
      out_of_scope: 0,
    } satisfies Record<AgentGuardSlackPreviewGateStatus, number>
  );
}

function markdownList(items: readonly string[]): string[] {
  return items.map((item) => `- ${item}`);
}

export function renderSlackWorkflowPreviewSpecMarkdown(): string {
  const lines = [
    "# AgentGuard Slack Workflow URL Preview",
    "",
    AGENT_GUARD_SLACK_PREVIEW_COPY.decision,
    "",
    "## Boundaries",
    "",
    AGENT_GUARD_SLACK_PREVIEW_COPY.boundary,
    "",
    "The preview stores Slack URLs only in encrypted form with URL hints, uses guarded API routes, records manual test attempts, and does not add Slack OAuth, Slack app installation, bot tokens, channel discovery, background retry, or automatic escalation.",
    "",
    "## Official Slack Planning Notes",
    "",
    ...AGENT_GUARD_SLACK_PREVIEW_DOC_NOTES.map(
      (note) => `- ${note.label}: ${note.note} (${note.url})`
    ),
    "",
    "## Implementation Gates",
    "",
    "| Gate | Status | Decision | Future requirement | Safety check |",
    "| --- | --- | --- | --- | --- |",
    ...AGENT_GUARD_SLACK_PREVIEW_GATES.map(
      (gate) =>
        `| ${gate.label} | ${gate.statusLabel} | ${gate.decision} | ${gate.futureRequirement} | ${gate.safetyCheck} |`
    ),
    "",
    "## Allowed Event Scope",
    "",
    ...markdownList(AGENT_GUARD_SLACK_PREVIEW_ALLOWED_EVENTS),
    "",
    "## Allowed Message Fields",
    "",
    "| Source field | Slack label | Required | Redaction | Notes |",
    "| --- | --- | --- | --- | --- |",
    ...AGENT_GUARD_SLACK_PREVIEW_FIELDS.map(
      (field) =>
        `| \`${field.sourceField}\` | ${field.slackLabel} | ${
          field.required ? "yes" : "no"
        } | ${field.redaction} | ${field.notes} |`
    ),
    "",
    "## Rollout Steps",
    "",
    ...AGENT_GUARD_SLACK_PREVIEW_ROLLOUT_STEPS.map(
      (step) => `- ${step.step} Owner: ${step.owner}. Evidence: ${step.evidence}`
    ),
    "",
    "## Customer Responsibilities",
    "",
    ...markdownList(AGENT_GUARD_SLACK_PREVIEW_CUSTOMER_RESPONSIBILITIES),
    "",
    "## Forbidden Claims",
    "",
    ...markdownList(AGENT_GUARD_SLACK_PREVIEW_FORBIDDEN_CLAIMS),
    "",
    "Do not add Slack URLs, source keys, signing secrets, bearer tokens, private keys, raw prompts, raw responses, files, messages, or customer data to this handoff.",
  ];

  return lines.join("\n");
}
