import {
  acknowledgementStatusLabel,
  classifyAgentExportFailure,
  type AgentExportReceiverAcknowledgementStatus,
} from "./export-hardening";

export type AgentGuardReceiverValidationStatus =
  | "not_configured"
  | "needs_manual_test"
  | "failing"
  | "dry_run_ready"
  | "live_ready"
  | "review_scope";

export type AgentGuardReceiverValidationTone =
  | "green"
  | "amber"
  | "red"
  | "blue"
  | "slate";

export type AgentGuardReceiverDestination = {
  id: string;
  name: string;
  destinationType: "webhook" | "siem";
  status: "enabled" | "disabled";
  endpointUrl: string;
  signingSecretHint: string;
  automaticDeliveryEnabled: boolean;
  dryRunEnabled: boolean;
  eventTypes: string[];
  ownerName?: string | null;
  ownerEmail?: string | null;
  escalationPath?: string | null;
  receiverAcknowledgementStatus?: AgentExportReceiverAcknowledgementStatus | null;
  receiverAcknowledgementNote?: string | null;
  receiverAcknowledgedAt?: string | null;
  receiverAcknowledgedByEmail?: string | null;
  healthStatus?: string;
  healthLabel?: string;
  healthSummary?: string;
  lastTestedAt: string | null;
  lastAutomaticAttemptAt: string | null;
};

export type AgentGuardReceiverAttempt = {
  id: string;
  destinationId: string | null;
  eventId: string;
  eventType: string;
  status: "succeeded" | "failed" | "dry_run";
  deliveryMode: "manual_test" | "automatic" | "dry_run" | "manual_replay";
  httpStatus: number | null;
  durationMs: number;
  errorMessage: string | null;
  createdAt: string;
};

export type AgentGuardReceiverValidationChecklistItem = {
  id: string;
  label: string;
  detail: string;
  evidence: string;
};

export type AgentGuardReceiverValidationSummary = {
  destinationId: string;
  name: string;
  destinationTypeLabel: string;
  endpointUrl: string;
  status: AgentGuardReceiverValidationStatus;
  label: string;
  tone: AgentGuardReceiverValidationTone;
  summary: string;
  nextAction: string;
  eventScope: string;
  latestAttemptSummary: string;
  ownerSummary: string;
  acknowledgementSummary: string;
  signingSecretSummary: string;
  guardrail: string;
};

export type AgentGuardReceiverValidationMetrics = {
  totalDestinations: number;
  enabledDestinations: number;
  dryRunDestinations: number;
  liveDestinations: number;
  successfulReceivers: number;
  acknowledgedReceivers: number;
  needsAttention: number;
};

export type AgentGuardReceiverValidationReport = {
  status: AgentGuardReceiverValidationStatus;
  label: string;
  tone: AgentGuardReceiverValidationTone;
  summary: string;
  metrics: AgentGuardReceiverValidationMetrics;
  checklist: AgentGuardReceiverValidationChecklistItem[];
  destinations: AgentGuardReceiverValidationSummary[];
  handoffText: string;
  boundary: string;
};

export const AGENT_GUARD_RECEIVER_VALIDATION_COPY = {
  title: "Customer-owned receiver validation",
  overview:
    "Validate and harden configured HTTPS export receivers using destination settings, owner/escalation metadata, acknowledgement posture, and delivery-attempt metadata before treating a pilot export path as ready.",
  boundary:
    "Receiver validation and HTTPS export hardening are operational readiness support for customer-owned endpoints. They are not automatic retry, not automatic escalation, not hosted receiver operations, not managed connector delivery, not native SIEM integration, not notification service, not security warranty, not legal advice, not certification, not compliance determination, and not auditor attestation.",
} as const;

export const AGENT_GUARD_RECEIVER_VALIDATION_CHECKLIST: AgentGuardReceiverValidationChecklistItem[] = [
  {
    id: "https-url",
    label: "Configure HTTPS receiver URL",
    detail:
      "Use an externally reachable HTTPS endpoint owned by the customer or their middleware.",
    evidence: "Destination URL is configured and visible in Settings.",
  },
  {
    id: "secret-storage",
    label: "Store one-time signing secret",
    detail:
      "Store the one-time destination signing secret in the receiver-side secret store.",
    evidence: "ShadowGuard only shows a secret hint after creation; plaintext is not recoverable.",
  },
  {
    id: "signature-headers",
    label: "Verify signing headers",
    detail:
      "Receiver should require event ID, timestamp, and HMAC signature headers before accepting events.",
    evidence: "Receiver implementation follows the integration kit or equivalent customer code.",
  },
  {
    id: "manual-test",
    label: "Send manual signed test",
    detail:
      "Use the Settings test action to send a signed metadata-only sample event.",
    evidence: "Latest delivery attempt records a 2xx response.",
  },
  {
    id: "dry-run",
    label: "Keep dry-run until reviewed",
    detail:
      "Use dry-run while customer engineers validate routing, storage, and escalation behavior.",
    evidence: "Automatic delivery is either off or dry-run is on until pilot approval.",
  },
  {
    id: "event-scope",
    label: "Select event types deliberately",
    detail:
      "Confirm whether the receiver should accept evaluated activity, blocked policy events, or both.",
    evidence: "Destination event-type scope is selected and documented.",
  },
  {
    id: "owner",
    label: "Document owner and escalation",
    detail:
      "Record who owns the receiver, downstream mapping, failures, acknowledgement, and replay decisions.",
    evidence:
      "Destination hardening metadata includes owner, escalation path, and receiver acknowledgement posture.",
  },
];

const STATUS_META: Record<
  AgentGuardReceiverValidationStatus,
  { label: string; tone: AgentGuardReceiverValidationTone }
> = {
  not_configured: { label: "No receiver configured", tone: "slate" },
  needs_manual_test: { label: "Needs manual test", tone: "amber" },
  failing: { label: "Receiver failing", tone: "red" },
  dry_run_ready: { label: "Dry-run ready", tone: "blue" },
  live_ready: { label: "Live-ready", tone: "green" },
  review_scope: { label: "Review scope", tone: "amber" },
};

const EVENT_LABELS: Record<string, string> = {
  "agentguard.activity.evaluated": "Evaluated activity",
  "agentguard.policy.blocked": "Blocked policy",
  "agentguard.review.required": "Review required",
};

function statusMeta(status: AgentGuardReceiverValidationStatus) {
  return STATUS_META[status];
}

function destinationTypeLabel(type: AgentGuardReceiverDestination["destinationType"]) {
  return type === "siem" ? "SIEM HTTPS" : "Webhook";
}

function sortAttempts(
  attempts: AgentGuardReceiverAttempt[]
): AgentGuardReceiverAttempt[] {
  return [...attempts].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
}

function attemptSummary(attempt: AgentGuardReceiverAttempt | null): string {
  if (!attempt) return "No loaded delivery attempt.";
  const failure = classifyAgentExportFailure(attempt);
  const mode =
    attempt.deliveryMode === "manual_test"
      ? "manual test"
      : attempt.deliveryMode === "manual_replay"
        ? "manual replay"
        : attempt.deliveryMode === "dry_run"
          ? "dry-run"
          : "automatic";
  const http = attempt.httpStatus ? `, HTTP ${attempt.httpStatus}` : ", no HTTP";
  const error = attempt.errorMessage ? `, ${attempt.errorMessage}` : "";
  const failureText =
    attempt.status === "failed" ? `, ${failure.label}: ${failure.nextAction}` : "";
  return `${mode}: ${attempt.status}${http}${error}${failureText}`;
}

function eventScope(eventTypes: string[]): string {
  if (eventTypes.length === 0) return "No event types selected";
  return eventTypes.map((eventType) => EVENT_LABELS[eventType] ?? eventType).join(", ");
}

function hasSuccessfulAttempt(attempts: AgentGuardReceiverAttempt[]): boolean {
  return attempts.some((attempt) => attempt.status === "succeeded");
}

function destinationStatus(
  destination: AgentGuardReceiverDestination,
  attempts: AgentGuardReceiverAttempt[]
): AgentGuardReceiverValidationStatus {
  const latestAttempt = attempts[0] ?? null;
  if (latestAttempt?.status === "failed") return "failing";
  if (destination.eventTypes.length === 0) return "review_scope";
  if (!hasSuccessfulAttempt(attempts)) return "needs_manual_test";
  if (destination.automaticDeliveryEnabled && !destination.dryRunEnabled) {
    return "live_ready";
  }
  return "dry_run_ready";
}

function destinationSummary(
  destination: AgentGuardReceiverDestination,
  attempts: AgentGuardReceiverAttempt[]
): AgentGuardReceiverValidationSummary {
  const status = destinationStatus(destination, attempts);
  const meta = statusMeta(status);
  const latestAttempt = attempts[0] ?? null;
  const eventTypes = eventScope(destination.eventTypes);
  const ownerSummary =
    destination.ownerName || destination.ownerEmail || destination.escalationPath
      ? [
          destination.ownerName ? `Owner: ${destination.ownerName}` : null,
          destination.ownerEmail ? `Email: ${destination.ownerEmail}` : null,
          destination.escalationPath
            ? `Escalation: ${destination.escalationPath}`
            : null,
        ]
          .filter(Boolean)
          .join("; ")
      : "Owner not documented.";
  const acknowledgementLabel = acknowledgementStatusLabel(
    destination.receiverAcknowledgementStatus ?? "not_requested"
  );
  const acknowledgementSummary = [
    `Receiver acknowledgement: ${acknowledgementLabel}`,
    destination.receiverAcknowledgementNote
      ? `Note: ${destination.receiverAcknowledgementNote}`
      : null,
    destination.receiverAcknowledgedAt
      ? `Confirmed ${destination.receiverAcknowledgedAt} by ${destination.receiverAcknowledgedByEmail ?? "unknown"}`
      : null,
  ]
    .filter(Boolean)
    .join("; ");
  const disabledPrefix =
    destination.status === "disabled"
      ? "Destination is disabled. "
      : "";

  const copyByStatus: Record<
    AgentGuardReceiverValidationStatus,
    { summary: string; nextAction: string }
  > = {
    not_configured: {
      summary: "No export destination has been configured.",
      nextAction: "Create an HTTPS export destination before receiver validation.",
    },
    needs_manual_test: {
      summary:
        `${disabledPrefix}No successful signed delivery attempt is loaded for this receiver.`,
      nextAction:
        "Confirm the receiver stores the signing secret, enable the destination when ready, and send a manual signed test event.",
    },
    failing: {
      summary:
        `${disabledPrefix}The latest delivery attempt failed, so receiver handling needs attention before pilot use.`,
      nextAction:
        "Fix receiver URL, signature verification, routing, or response handling, then rerun the manual test.",
    },
    dry_run_ready: {
      summary:
        `${disabledPrefix}A signed delivery has succeeded and live automatic sends are not active.`,
      nextAction:
        "Keep dry-run or auto-off posture until the customer confirms routing, storage, and escalation behavior.",
    },
    live_ready: {
      summary:
        "A signed delivery has succeeded and live automatic sends are enabled for the selected event scope.",
      nextAction:
        "Keep owner, replay, and failure-response steps documented while live export remains armed.",
    },
    review_scope: {
      summary:
        `${disabledPrefix}The receiver needs event-type scope review before it should be treated as ready.`,
      nextAction:
        "Select evaluated activity, blocked policy events, or both, then rerun receiver validation.",
    },
  };

  return {
    destinationId: destination.id,
    name: destination.name,
    destinationTypeLabel: destinationTypeLabel(destination.destinationType),
    endpointUrl: destination.endpointUrl,
    status,
    label: meta.label,
    tone: meta.tone,
    summary: copyByStatus[status].summary,
    nextAction: copyByStatus[status].nextAction,
    eventScope: eventTypes,
    latestAttemptSummary: attemptSummary(latestAttempt),
    ownerSummary,
    acknowledgementSummary,
    signingSecretSummary: `Secret hint only: ${destination.signingSecretHint}`,
    guardrail:
      "A 2xx delivery attempt shows the receiver accepted the request; customer engineers still own receiver-side signature verification, acknowledgement, storage, routing, and escalation.",
  };
}

function buildMetrics(
  destinations: AgentGuardReceiverDestination[],
  summaries: AgentGuardReceiverValidationSummary[]
): AgentGuardReceiverValidationMetrics {
  return {
    totalDestinations: destinations.length,
    enabledDestinations: destinations.filter(
      (destination) => destination.status === "enabled"
    ).length,
    dryRunDestinations: destinations.filter(
      (destination) =>
        destination.automaticDeliveryEnabled && destination.dryRunEnabled
    ).length,
    liveDestinations: destinations.filter(
      (destination) =>
        destination.automaticDeliveryEnabled && !destination.dryRunEnabled
    ).length,
    successfulReceivers: summaries.filter((summary) =>
      ["dry_run_ready", "live_ready"].includes(summary.status)
    ).length,
    acknowledgedReceivers: destinations.filter(
      (destination) =>
        destination.receiverAcknowledgementStatus === "confirmed"
    ).length,
    needsAttention: summaries.filter((summary) =>
      ["needs_manual_test", "failing", "review_scope"].includes(summary.status)
    ).length,
  };
}

function overallStatus(
  summaries: AgentGuardReceiverValidationSummary[]
): AgentGuardReceiverValidationStatus {
  if (summaries.length === 0) return "not_configured";
  if (summaries.some((summary) => summary.status === "failing")) return "failing";
  if (summaries.some((summary) => summary.status === "review_scope")) {
    return "review_scope";
  }
  if (summaries.some((summary) => summary.status === "needs_manual_test")) {
    return "needs_manual_test";
  }
  if (summaries.some((summary) => summary.status === "live_ready")) {
    return "live_ready";
  }
  return "dry_run_ready";
}

function overallSummary(
  status: AgentGuardReceiverValidationStatus,
  metrics: AgentGuardReceiverValidationMetrics
): string {
  if (status === "not_configured") {
    return "No customer-owned export receiver is configured yet.";
  }
  if (status === "failing") {
    return `${metrics.needsAttention} receiver item needs attention before enterprise rollout.`;
  }
  if (status === "review_scope") {
    return "At least one receiver needs event-type scope review before pilot use.";
  }
  if (status === "needs_manual_test") {
    return "At least one receiver needs a successful manual signed test.";
  }
  if (status === "live_ready") {
    return "At least one receiver is live-ready; keep customer owner and failure handling documented.";
  }
  return "Configured receivers have successful delivery evidence while live sends remain guarded.";
}

function handoffText(
  report: Omit<AgentGuardReceiverValidationReport, "handoffText">,
  generatedAt: Date
): string {
  const lines = [
    `AgentGuard customer-owned receiver validation - ${report.label}`,
    `Generated: ${generatedAt.toISOString()}`,
    `Summary: ${report.summary}`,
    "",
    "Metrics",
    `- Configured destinations: ${report.metrics.totalDestinations}`,
    `- Enabled destinations: ${report.metrics.enabledDestinations}`,
    `- Dry-run destinations: ${report.metrics.dryRunDestinations}`,
    `- Live destinations: ${report.metrics.liveDestinations}`,
    `- Successful receiver evidence: ${report.metrics.successfulReceivers}`,
    `- Receiver acknowledgements confirmed: ${report.metrics.acknowledgedReceivers}`,
    `- Needs attention: ${report.metrics.needsAttention}`,
    "",
    "Receivers",
  ];

  if (report.destinations.length === 0) {
    lines.push("- No HTTPS export receiver is configured yet.");
  } else {
    for (const destination of report.destinations) {
      lines.push(
        `- ${destination.name}: ${destination.label}`,
        `  Type: ${destination.destinationTypeLabel}`,
        `  URL: ${destination.endpointUrl}`,
        `  Event scope: ${destination.eventScope}`,
        `  Latest attempt: ${destination.latestAttemptSummary}`,
        `  Owner/escalation: ${destination.ownerSummary}`,
        `  Acknowledgement: ${destination.acknowledgementSummary}`,
        `  Secret: ${destination.signingSecretSummary}`,
        `  Next action: ${destination.nextAction}`,
        `  Guardrail: ${destination.guardrail}`
      );
    }
  }

  lines.push(
    "",
    "Boundaries",
    `- ${report.boundary}`,
    "- This handoff includes secret hints only. It must not include plaintext signing secrets, source keys, raw prompts, responses, files, messages, or customer data.",
    "- A successful 2xx delivery is receiver reachability evidence, not proof of receiver-side signature verification unless the customer confirms that implementation."
  );

  return lines.join("\n");
}

export function buildAgentGuardReceiverValidationReport(input: {
  destinations: AgentGuardReceiverDestination[];
  attempts: AgentGuardReceiverAttempt[];
  generatedAt?: Date;
}): AgentGuardReceiverValidationReport {
  const attemptsByDestination = new Map<string, AgentGuardReceiverAttempt[]>();
  for (const attempt of input.attempts) {
    if (!attempt.destinationId) continue;
    attemptsByDestination.set(attempt.destinationId, [
      ...(attemptsByDestination.get(attempt.destinationId) ?? []),
      attempt,
    ]);
  }

  const destinations = input.destinations.map((destination) =>
    destinationSummary(
      destination,
      sortAttempts(attemptsByDestination.get(destination.id) ?? [])
    )
  );
  const metrics = buildMetrics(input.destinations, destinations);
  const status = overallStatus(destinations);
  const meta = statusMeta(status);
  const reportWithoutHandoff = {
    status,
    label: meta.label,
    tone: meta.tone,
    summary: overallSummary(status, metrics),
    metrics,
    checklist: AGENT_GUARD_RECEIVER_VALIDATION_CHECKLIST,
    destinations,
    boundary: AGENT_GUARD_RECEIVER_VALIDATION_COPY.boundary,
  };

  return {
    ...reportWithoutHandoff,
    handoffText: handoffText(
      reportWithoutHandoff,
      input.generatedAt ?? new Date()
    ),
  };
}
