export type AgentGuardExportEventType =
  | "agentguard.activity.evaluated"
  | "agentguard.policy.blocked"
  | "agentguard.review.required";

export type AgentGuardExportDataClassification = {
  sensitivity: string;
  categories: string[];
  piiDetected: boolean;
  credentialsDetected: boolean;
  proprietaryDetected: boolean;
};

export type AgentGuardExportSource = {
  id: string;
  name: string;
  environment: string;
} | null;

export type AgentGuardExportActivity = {
  id: string;
  toolName: string;
  userEmail: string;
  activityType: string;
  riskLevel: string;
  blocked: boolean;
  reason: string;
  policyId: string | null;
  dataClassification: AgentGuardExportDataClassification;
  source: AgentGuardExportSource;
  contentLength: number;
};

export type AgentGuardExportEvent = {
  eventId: string;
  eventType: AgentGuardExportEventType;
  occurredAt: string;
  orgId: string;
  activity: AgentGuardExportActivity;
  alert?: {
    category: "activity_evaluated" | "policy_blocked" | "review_required";
    severity: "info" | "warning" | "critical";
    title: string;
    summary: string;
    policyActions: string[];
  };
};

export type AgentGuardExportActivityInput = {
  id: string;
  orgId: string;
  toolName: string;
  userEmail: string;
  activityType: string;
  riskLevel: string;
  blocked: boolean;
  reason?: string | null;
  policyId?: string | null;
  dataClassification: AgentGuardExportDataClassification;
  source?: AgentGuardExportSource;
  contentLength: number;
  occurredAt?: string;
  eventType?: AgentGuardExportEventType;
  alert?: AgentGuardExportEvent["alert"];
};

export type AgentGuardExportField = {
  path: string;
  description: string;
};

export const AGENT_GUARD_EXPORT_SIGNING_HEADERS = [
  {
    name: "x-shadowguard-event-id",
    description: "Matches the export eventId for replay protection and log correlation.",
  },
  {
    name: "x-shadowguard-timestamp",
    description: "Unix timestamp in seconds when the payload is delivered.",
  },
  {
    name: "x-shadowguard-signature",
    description: "HMAC-SHA256 signature over the canonical JSON payload.",
  },
] as const;

export const AGENT_GUARD_EXPORT_PAYLOAD_FIELDS: AgentGuardExportField[] = [
  {
    path: "eventId",
    description: "Unique ShadowGuard export event id.",
  },
  {
    path: "eventType",
    description: "Event name such as agentguard.activity.evaluated, agentguard.policy.blocked, or agentguard.review.required.",
  },
  {
    path: "occurredAt",
    description: "ISO timestamp for the activity evaluation.",
  },
  {
    path: "orgId",
    description: "Organization id that owns the submitted activity.",
  },
  {
    path: "activity.id",
    description: "AgentGuard activity row id.",
  },
  {
    path: "activity.toolName",
    description: "Submitted AI tool name.",
  },
  {
    path: "activity.userEmail",
    description: "Submitted user email for review and routing.",
  },
  {
    path: "activity.riskLevel",
    description: "Metadata-only risk level returned by AgentGuard.",
  },
  {
    path: "activity.blocked",
    description: "Whether enabled policies returned a block decision.",
  },
  {
    path: "activity.dataClassification",
    description: "Sensitivity, category, PII, credential, and proprietary-data metadata.",
  },
  {
    path: "activity.source",
    description: "Source-key attribution when the activity was submitted by a known source.",
  },
  {
    path: "activity.contentLength",
    description: "Length of submitted content only. Raw content is excluded.",
  },
  {
    path: "alert",
    description: "Optional generic alert-routing metadata for blocked policy or review-required events.",
  },
];

export const AGENT_GUARD_EXPORT_GUARDRAILS = [
  "Automatic delivery only runs for enabled destinations with automatic delivery turned on.",
  "Generic alert routing reuses export destinations and selected event types.",
  "Dry-run mode logs an attempt without sending an outbound request.",
  "Live outbound sends require dry-run mode to be turned off intentionally.",
  "Export payloads include metadata and content length, not raw prompts, responses, files, or messages.",
  "Failed delivery attempts are logged and can be replayed manually after the receiver is fixed.",
  "Background retries are not shipped.",
  "Customer middleware owns Slack, Teams, email, SIEM, SOAR, ticketing, and escalation behavior.",
] as const;

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, nested]) => nested !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries
    .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
    .join(",")}}`;
}

export function canonicalizeAgentGuardExportPayload(
  payload: AgentGuardExportEvent
): string {
  return stableJson(payload);
}

export function buildAgentGuardExportEvent(
  input: AgentGuardExportActivityInput
): AgentGuardExportEvent {
  const blocked = input.blocked === true;
  const defaultEventType = blocked
    ? "agentguard.policy.blocked"
    : "agentguard.activity.evaluated";
  const eventType = input.eventType ?? defaultEventType;
  const eventTypeParts = eventType.split(".");
  const eventSuffix =
    input.eventType && input.eventType !== defaultEventType
      ? `_${eventTypeParts[eventTypeParts.length - 1] ?? "event"}`
      : "";
  return {
    eventId: `agevt_${input.id}${eventSuffix}`,
    eventType,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    orgId: input.orgId,
    activity: {
      id: input.id,
      toolName: input.toolName,
      userEmail: input.userEmail,
      activityType: input.activityType,
      riskLevel: input.riskLevel,
      blocked,
      reason: input.reason ?? "No blocking policy matched",
      policyId: input.policyId ?? null,
      dataClassification: input.dataClassification,
      source: input.source ?? null,
      contentLength: Math.max(0, Math.trunc(input.contentLength)),
    },
    alert: input.alert,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isAgentGuardExportEvent(
  value: unknown
): value is AgentGuardExportEvent {
  if (!isRecord(value)) return false;
  if (typeof value.eventId !== "string") return false;
  if (
    value.eventType !== "agentguard.activity.evaluated" &&
    value.eventType !== "agentguard.policy.blocked" &&
    value.eventType !== "agentguard.review.required"
  ) {
    return false;
  }
  if (typeof value.occurredAt !== "string") return false;
  if (typeof value.orgId !== "string") return false;
  if (!isRecord(value.activity)) return false;
  if (typeof value.activity.id !== "string") return false;
  if (typeof value.activity.toolName !== "string") return false;
  if (typeof value.activity.userEmail !== "string") return false;
  if (typeof value.activity.activityType !== "string") return false;
  if (typeof value.activity.riskLevel !== "string") return false;
  if (typeof value.activity.blocked !== "boolean") return false;
  if (typeof value.activity.contentLength !== "number") return false;
  if (!isRecord(value.activity.dataClassification)) return false;
  return true;
}

export function agentGuardSampleExportEvent(): AgentGuardExportEvent {
  return buildAgentGuardExportEvent({
    id: "act_demo_001",
    orgId: "org_demo",
    toolName: "ChatGPT",
    userEmail: "employee@example.com",
    activityType: "prompt_sent",
    riskLevel: "medium",
    blocked: false,
    dataClassification: {
      sensitivity: "confidential",
      categories: ["personal_data", "customer_context"],
      piiDetected: true,
      credentialsDetected: false,
      proprietaryDetected: false,
    },
    source: {
      id: "source_demo",
      name: "Production wrapper",
      environment: "production",
    },
    contentLength: 184,
    occurredAt: "2026-05-16T12:00:00.000Z",
  });
}

export function prettyAgentGuardExportPayload(
  payload: AgentGuardExportEvent
): string {
  return JSON.stringify(payload, null, 2);
}
