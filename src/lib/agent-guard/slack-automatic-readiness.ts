export type AgentGuardSlackAutomaticTargetType =
  | "workflow_webhook"
  | "incoming_webhook";
export type AgentGuardSlackAutomaticTargetStatus = "enabled" | "disabled";
export type AgentGuardSlackAutomaticApprovalStatus =
  | "not_requested"
  | "requested"
  | "approved"
  | "not_applicable";
export type AgentGuardSlackAutomaticEventType =
  | "agentguard.policy.blocked"
  | "agentguard.review.required";
export type AgentGuardSlackAutomaticAttemptStatus =
  | "succeeded"
  | "failed"
  | "dry_run";
export type AgentGuardSlackAutomaticAttemptMode =
  | "manual_test"
  | "automatic"
  | "dry_run";

export type AgentGuardSlackAutomaticTargetInput = {
  id: string;
  name: string;
  targetType: AgentGuardSlackAutomaticTargetType;
  status: AgentGuardSlackAutomaticTargetStatus;
  webhookUrlHint: string;
  eventTypes: AgentGuardSlackAutomaticEventType[];
  dryRunEnabled: boolean;
  liveSendEnabled: boolean;
  ownerName: string;
  ownerEmail: string;
  customerApprovalStatus: AgentGuardSlackAutomaticApprovalStatus;
  lastSuccessfulTestAt: string | null;
  lastLiveAttemptAt: string | null;
};

export type AgentGuardSlackAutomaticAttemptInput = {
  targetId: string | null;
  eventType: string;
  status: AgentGuardSlackAutomaticAttemptStatus;
  deliveryMode: AgentGuardSlackAutomaticAttemptMode;
  httpStatus: number | null;
  durationMs: number;
  createdAt: string;
};

export type AgentGuardSlackAutomaticReadinessStatus =
  | "needs_setup"
  | "manual_verified_auto_off"
  | "automatic_dry_run_ready"
  | "automatic_outbound_ready";

export type AgentGuardSlackAutomaticReadinessGate = {
  id: string;
  label: string;
  ready: boolean;
  detail: string;
};

export type AgentGuardSlackAutomaticReadiness = {
  status: AgentGuardSlackAutomaticReadinessStatus;
  statusLabel: string;
  summary: string;
  nextAction: string;
  gates: AgentGuardSlackAutomaticReadinessGate[];
  selectedEventTypes: AgentGuardSlackAutomaticEventType[];
  automaticAttemptCount: number;
  latestAutomaticAttempt: AgentGuardSlackAutomaticAttemptInput | null;
  copyText: string;
};

export const AGENT_GUARD_SLACK_AUTOMATIC_READINESS_COPY = {
  overview:
    "Automatic Slack preview readiness explains whether a configured Slack preview target is still off, ready only for dry-run rehearsal, or eligible for outbound preview sends when matching AgentGuard events are submitted.",
  boundary:
    "Automatic Slack preview readiness is operator guidance only. It does not send Slack messages, change target settings, enable live sends, retry in the background, escalate automatically, guarantee delivery, install a Slack app, use Slack OAuth, discover channels, provide interactive workflows, replace SIEM or ticketing, provide legal advice, certify compliance, determine compliance, attest audit status, or warrant security.",
} as const;

function targetTypeLabel(type: AgentGuardSlackAutomaticTargetType): string {
  return type === "incoming_webhook" ? "Incoming webhook" : "Workflow webhook";
}

function eventLabel(eventType: AgentGuardSlackAutomaticEventType): string {
  return eventType === "agentguard.policy.blocked"
    ? "Blocked policy"
    : "Review required";
}

function automaticAttempts(
  attempts: AgentGuardSlackAutomaticAttemptInput[]
): AgentGuardSlackAutomaticAttemptInput[] {
  return attempts.filter((attempt) => attempt.eventType !== "manual_test");
}

function latestAttempt(
  attempts: AgentGuardSlackAutomaticAttemptInput[]
): AgentGuardSlackAutomaticAttemptInput | null {
  return attempts[0] ?? null;
}

function gateSummary(gates: AgentGuardSlackAutomaticReadinessGate[]): string {
  const missing = gates.filter((gate) => !gate.ready);
  if (missing.length === 0) return "All automatic-preview gates are satisfied.";
  return `Missing gates: ${missing.map((gate) => gate.label).join(", ")}.`;
}

function nextAction(input: {
  target: AgentGuardSlackAutomaticTargetInput;
  coreGatesReady: boolean;
  gates: AgentGuardSlackAutomaticReadinessGate[];
}): string {
  const { target, coreGatesReady, gates } = input;
  if (!coreGatesReady) {
    const firstMissing = gates.find((gate) => !gate.ready);
    return firstMissing
      ? `${firstMissing.label}: ${firstMissing.detail}`
      : "Review automatic-preview gates before enabling live posture.";
  }
  if (!target.liveSendEnabled) {
    return "Automatic preview is off. Keep it off unless a pilot owner approves event scope, Slack destination ownership, and rollback ownership.";
  }
  if (target.dryRunEnabled) {
    return "Automatic preview can rehearse matching events as dry-run records without outbound Slack requests.";
  }
  return "Outbound automatic preview is eligible for matching events; keep owner, approval, event scope, and disable path under active review.";
}

function statusFor(input: {
  target: AgentGuardSlackAutomaticTargetInput;
  coreGatesReady: boolean;
}): Pick<AgentGuardSlackAutomaticReadiness, "status" | "statusLabel" | "summary"> {
  const { target, coreGatesReady } = input;
  if (!coreGatesReady) {
    return {
      status: "needs_setup",
      statusLabel: "Needs setup",
      summary:
        "Automatic Slack preview is not eligible yet because one or more gates are missing.",
    };
  }
  if (!target.liveSendEnabled) {
    return {
      status: "manual_verified_auto_off",
      statusLabel: "Auto off",
      summary:
        "Manual delivery evidence is present, but automatic Slack preview sends remain off.",
    };
  }
  if (target.dryRunEnabled) {
    return {
      status: "automatic_dry_run_ready",
      statusLabel: "Dry-run ready",
      summary:
        "Matching automatic Slack preview events can be logged as dry-runs without outbound requests.",
    };
  }
  return {
    status: "automatic_outbound_ready",
    statusLabel: "Outbound caution",
    summary:
      "Matching automatic Slack preview events are eligible for outbound delivery to the customer-owned Slack URL.",
  };
}

export function buildAgentGuardSlackAutomaticReadiness(input: {
  target: AgentGuardSlackAutomaticTargetInput;
  attempts: AgentGuardSlackAutomaticAttemptInput[];
}): AgentGuardSlackAutomaticReadiness {
  const targetAttempts = input.attempts.filter(
    (attempt) => attempt.targetId === input.target.id
  );
  const selectedEventTypes = input.target.eventTypes.filter(
    (eventType): eventType is AgentGuardSlackAutomaticEventType =>
      eventType === "agentguard.policy.blocked" ||
      eventType === "agentguard.review.required"
  );
  const automatic = automaticAttempts(targetAttempts);
  const hasManualSuccess = Boolean(input.target.lastSuccessfulTestAt);
  const gates: AgentGuardSlackAutomaticReadinessGate[] = [
    {
      id: "enabled",
      label: "Target enabled",
      ready: input.target.status === "enabled",
      detail: "Enable the Slack preview target before automatic preview can run.",
    },
    {
      id: "event_scope",
      label: "Event scope selected",
      ready: selectedEventTypes.length > 0,
      detail: "Select blocked policy, review required, or both.",
    },
    {
      id: "manual_success",
      label: "Manual delivery verified",
      ready: hasManualSuccess,
      detail: "Send a successful metadata-only manual test after the current URL is saved.",
    },
    {
      id: "customer_approval",
      label: "Customer approval",
      ready: input.target.customerApprovalStatus === "approved",
      detail: "Record customer approval before automatic preview delivery is treated as ready.",
    },
  ];
  const coreGatesReady = gates.every((gate) => gate.ready);
  const status = statusFor({ target: input.target, coreGatesReady });
  const next = nextAction({ target: input.target, coreGatesReady, gates });
  const latestAutomaticAttempt = latestAttempt(automatic);

  return {
    ...status,
    nextAction: next,
    gates,
    selectedEventTypes,
    automaticAttemptCount: automatic.length,
    latestAutomaticAttempt,
    copyText: renderAgentGuardSlackAutomaticReadinessText({
      target: input.target,
      readiness: {
        ...status,
        nextAction: next,
        gates,
        selectedEventTypes,
        automaticAttemptCount: automatic.length,
        latestAutomaticAttempt,
      },
    }),
  };
}

function renderAgentGuardSlackAutomaticReadinessText(input: {
  target: AgentGuardSlackAutomaticTargetInput;
  readiness: Omit<AgentGuardSlackAutomaticReadiness, "copyText">;
}): string {
  const { target, readiness } = input;
  const latest = readiness.latestAutomaticAttempt;
  return [
    "# AgentGuard Slack Automatic Preview Readiness",
    "",
    `Target: ${target.name}`,
    `Type: ${targetTypeLabel(target.targetType)}`,
    `URL hint: ${target.webhookUrlHint}`,
    `Posture: ${readiness.statusLabel}`,
    `Summary: ${readiness.summary}`,
    `Event scope: ${
      readiness.selectedEventTypes.map(eventLabel).join(", ") || "none selected"
    }`,
    `Owner/team: ${target.ownerName || "-"}`,
    `Owner email: ${target.ownerEmail || "-"}`,
    `Target enabled: ${target.status === "enabled" ? "yes" : "no"}`,
    `Manual delivery verified: ${target.lastSuccessfulTestAt ? "yes" : "no"}`,
    `Customer approval: ${target.customerApprovalStatus}`,
    `Automatic posture: ${target.liveSendEnabled ? "on" : "off"}`,
    `Dry-run posture: ${
      target.dryRunEnabled
        ? "on; matching automatic events are logged without outbound Slack requests"
        : "off; matching automatic events may send outbound if all gates are satisfied"
    }`,
    `Last automatic/live attempt: ${target.lastLiveAttemptAt ?? "Not yet"}`,
    `Automatic attempt summaries: ${readiness.automaticAttemptCount}`,
    latest
      ? `Latest automatic attempt: ${latest.status}; ${latest.httpStatus ? `HTTP ${latest.httpStatus}` : "No HTTP"}; ${latest.durationMs} ms; ${latest.createdAt}`
      : "Latest automatic attempt: none",
    "",
    "Gate posture:",
    ...readiness.gates.map(
      (gate) => `- ${gate.ready ? "Ready" : "Missing"}: ${gate.label}. ${gate.detail}`
    ),
    "",
    `Gate summary: ${gateSummary(readiness.gates)}`,
    "",
    "Next action:",
    `- ${readiness.nextAction}`,
    "",
    `Boundary: ${AGENT_GUARD_SLACK_AUTOMATIC_READINESS_COPY.boundary} No plaintext Slack URL, encrypted URL, URL hash, payload body, source key, signing secret, bearer token, raw prompt, raw response, file, or message is included.`,
  ].join("\n");
}
