import type { AgentGuardExportEventType } from "./export-foundation";

export type AgentGuardReceiverMappingTemplateId =
  | "webhook_event_log"
  | "siem_http_intake"
  | "customer_alert_queue";

export type AgentGuardReceiverFieldDictionaryEntry = {
  path: string;
  type: string;
  required: boolean;
  eventTypes: AgentGuardExportEventType[] | "all";
  description: string;
  customerUse: string;
  example: string;
};

export type AgentGuardReceiverMappingRow = {
  sourcePath: string;
  targetField: string;
  transformation: string;
  required: boolean;
  notes: string;
};

export type AgentGuardReceiverMappingTemplate = {
  id: AgentGuardReceiverMappingTemplateId;
  label: string;
  summary: string;
  receiverUse: string;
  customerOwner: string;
  rows: AgentGuardReceiverMappingRow[];
  sampleOutput: Record<string, unknown>;
};

export const AGENT_GUARD_RECEIVER_FIELD_MAPPING_COPY = {
  title: "Receiver field-mapping templates",
  overview:
    "Copyable generic mappings for customer-owned HTTPS receivers that transform AgentGuard metadata-only export events into local webhook, SIEM HTTP intake, or alert queue records.",
  boundary:
    "Receiver field-mapping templates are customer-owned transformation guidance. They are not vendor-specific API clients, not managed SIEM connectors, not native Slack/Teams/email/ticketing/SOAR integrations, not automatic retry, not automatic escalation, not hosted receiver operations, not legal advice, not certification, not compliance determination, not auditor attestation, and not a security warranty.",
} as const;

export const AGENT_GUARD_RECEIVER_MAPPING_EVENT_TYPES: AgentGuardExportEventType[] = [
  "agentguard.activity.evaluated",
  "agentguard.policy.blocked",
  "agentguard.review.required",
];

export const AGENT_GUARD_RECEIVER_FIELD_DICTIONARY: AgentGuardReceiverFieldDictionaryEntry[] = [
  {
    path: "eventId",
    type: "string",
    required: true,
    eventTypes: "all",
    description: "Unique ShadowGuard export event id.",
    customerUse: "Deduplication key, replay guard, and receiver log correlation.",
    example: "agevt_act_demo_001",
  },
  {
    path: "eventType",
    type: "string",
    required: true,
    eventTypes: "all",
    description: "AgentGuard export event type.",
    customerUse: "Route evaluated activity, blocked policy, or review-required records.",
    example: "agentguard.policy.blocked",
  },
  {
    path: "occurredAt",
    type: "ISO timestamp",
    required: true,
    eventTypes: "all",
    description: "When AgentGuard evaluated the submitted activity.",
    customerUse: "Primary event timestamp for logs, SIEM ingestion, and retention.",
    example: "2026-05-16T12:00:00.000Z",
  },
  {
    path: "orgId",
    type: "string",
    required: true,
    eventTypes: "all",
    description: "ShadowGuard organization id.",
    customerUse: "Tenant correlation inside customer middleware.",
    example: "org_demo",
  },
  {
    path: "activity.id",
    type: "string",
    required: true,
    eventTypes: "all",
    description: "AgentGuard activity row id.",
    customerUse: "Link receiver-side records back to AgentGuard activity metadata.",
    example: "act_demo_001",
  },
  {
    path: "activity.toolName",
    type: "string",
    required: true,
    eventTypes: "all",
    description: "Submitted AI tool name.",
    customerUse: "Tool routing, dashboards, SIEM labels, and local allow/block analytics.",
    example: "ChatGPT",
  },
  {
    path: "activity.userEmail",
    type: "string",
    required: true,
    eventTypes: "all",
    description: "Submitted user email.",
    customerUse: "User correlation, ownership lookup, and alert triage.",
    example: "employee@example.com",
  },
  {
    path: "activity.activityType",
    type: "string",
    required: true,
    eventTypes: "all",
    description: "Submitted activity type.",
    customerUse: "Differentiate prompt, response, file, or other submitted activity categories.",
    example: "prompt_sent",
  },
  {
    path: "activity.riskLevel",
    type: "string",
    required: true,
    eventTypes: "all",
    description: "AgentGuard risk level for the submitted activity.",
    customerUse: "Severity mapping and receiver-side prioritization.",
    example: "medium",
  },
  {
    path: "activity.blocked",
    type: "boolean",
    required: true,
    eventTypes: "all",
    description: "Whether enabled policies returned a block decision.",
    customerUse: "Alert routing, SIEM outcome, and local ticketing criteria.",
    example: "false",
  },
  {
    path: "activity.reason",
    type: "string",
    required: true,
    eventTypes: "all",
    description: "Policy decision reason or no-match explanation.",
    customerUse: "Human-readable receiver summary and investigation context.",
    example: "No blocking policy matched",
  },
  {
    path: "activity.policyId",
    type: "string | null",
    required: false,
    eventTypes: "all",
    description: "Policy id associated with the decision when available.",
    customerUse: "Rule correlation for blocked or review-required events.",
    example: "policy_demo",
  },
  {
    path: "activity.dataClassification.sensitivity",
    type: "string",
    required: true,
    eventTypes: "all",
    description: "Metadata-only data sensitivity classification.",
    customerUse: "SIEM severity, storage routing, and retention policy hints.",
    example: "confidential",
  },
  {
    path: "activity.dataClassification.categories",
    type: "string[]",
    required: true,
    eventTypes: "all",
    description: "Detected metadata categories.",
    customerUse: "Receiver labels and analytics dimensions.",
    example: "personal_data, customer_context",
  },
  {
    path: "activity.dataClassification.piiDetected",
    type: "boolean",
    required: true,
    eventTypes: "all",
    description: "Whether PII-like metadata was detected.",
    customerUse: "Triage criteria and local privacy handling.",
    example: "true",
  },
  {
    path: "activity.dataClassification.credentialsDetected",
    type: "boolean",
    required: true,
    eventTypes: "all",
    description: "Whether credential-like metadata was detected.",
    customerUse: "High-priority security routing criteria.",
    example: "false",
  },
  {
    path: "activity.dataClassification.proprietaryDetected",
    type: "boolean",
    required: true,
    eventTypes: "all",
    description: "Whether proprietary-data-like metadata was detected.",
    customerUse: "Intellectual-property handling and receiver labels.",
    example: "false",
  },
  {
    path: "activity.source",
    type: "object | null",
    required: false,
    eventTypes: "all",
    description: "Source-key attribution when available.",
    customerUse: "Route by customer wrapper, source owner, or environment.",
    example: "Production wrapper / production",
  },
  {
    path: "activity.contentLength",
    type: "number",
    required: true,
    eventTypes: "all",
    description: "Submitted content length only. Raw content is excluded.",
    customerUse: "Volume analytics without storing raw prompts, responses, files, or messages.",
    example: "184",
  },
  {
    path: "alert.category",
    type: "string",
    required: false,
    eventTypes: [
      "agentguard.policy.blocked",
      "agentguard.review.required",
    ],
    description: "Generic alert category when alert metadata is present.",
    customerUse: "Alert routing and receiver queue grouping.",
    example: "policy_blocked",
  },
  {
    path: "alert.severity",
    type: "string",
    required: false,
    eventTypes: [
      "agentguard.policy.blocked",
      "agentguard.review.required",
    ],
    description: "Generic alert severity when alert metadata is present.",
    customerUse: "Customer-owned priority mapping.",
    example: "warning",
  },
  {
    path: "alert.title",
    type: "string",
    required: false,
    eventTypes: [
      "agentguard.policy.blocked",
      "agentguard.review.required",
    ],
    description: "Generic alert title when alert metadata is present.",
    customerUse: "Notification subject or receiver queue title.",
    example: "AgentGuard policy blocked activity",
  },
  {
    path: "alert.summary",
    type: "string",
    required: false,
    eventTypes: [
      "agentguard.policy.blocked",
      "agentguard.review.required",
    ],
    description: "Generic alert summary when alert metadata is present.",
    customerUse: "Receiver-side human summary without raw content.",
    example: "Submitted activity matched an enabled block policy.",
  },
  {
    path: "alert.policyActions",
    type: "string[]",
    required: false,
    eventTypes: [
      "agentguard.policy.blocked",
      "agentguard.review.required",
    ],
    description: "Policy actions associated with alert-worthy event metadata.",
    customerUse: "Customer-owned routing criteria for block, warn, or quarantine.",
    example: "block, quarantine",
  },
];

const WEBHOOK_ROWS: AgentGuardReceiverMappingRow[] = [
  {
    sourcePath: "eventId",
    targetField: "shadowguard_event_id",
    transformation: "copy",
    required: true,
    notes: "Use as the idempotency key before storing or forwarding.",
  },
  {
    sourcePath: "eventType",
    targetField: "shadowguard_event_type",
    transformation: "copy",
    required: true,
    notes: "Route only the event types selected on the export destination.",
  },
  {
    sourcePath: "occurredAt",
    targetField: "observed_at",
    transformation: "copy ISO timestamp",
    required: true,
    notes: "Prefer this over receiver arrival time for activity chronology.",
  },
  {
    sourcePath: "activity.toolName",
    targetField: "tool.name",
    transformation: "copy",
    required: true,
    notes: "Useful for customer-owned tool dashboards and routing.",
  },
  {
    sourcePath: "activity.userEmail",
    targetField: "user.email",
    transformation: "copy",
    required: true,
    notes: "Customer middleware decides whether to enrich with directory data.",
  },
  {
    sourcePath: "activity.riskLevel + activity.blocked + activity.reason",
    targetField: "decision",
    transformation: "group into object",
    required: true,
    notes: "Keep decision metadata separate from raw activity content.",
  },
  {
    sourcePath: "activity.dataClassification",
    targetField: "classification",
    transformation: "copy metadata object",
    required: true,
    notes: "Includes sensitivity and boolean flags only.",
  },
  {
    sourcePath: "activity.source",
    targetField: "source",
    transformation: "copy or null",
    required: false,
    notes: "May be null for dashboard-submitted activity.",
  },
  {
    sourcePath: "alert",
    targetField: "alert",
    transformation: "copy or null",
    required: false,
    notes: "Present for alert-worthy event paths; optional for evaluated activity.",
  },
];

const SIEM_ROWS: AgentGuardReceiverMappingRow[] = [
  {
    sourcePath: "occurredAt",
    targetField: "timestamp",
    transformation: "copy ISO timestamp",
    required: true,
    notes: "Use as the SIEM event timestamp.",
  },
  {
    sourcePath: "eventId",
    targetField: "event.id",
    transformation: "copy",
    required: true,
    notes: "Use for dedupe, replay, and receiver-to-SIEM correlation.",
  },
  {
    sourcePath: "eventType",
    targetField: "event.action",
    transformation: "copy",
    required: true,
    notes: "Map to a local SIEM action or event name.",
  },
  {
    sourcePath: "activity.blocked",
    targetField: "event.outcome",
    transformation: "blocked ? blocked : evaluated",
    required: true,
    notes: "Customer middleware can choose the final SIEM vocabulary.",
  },
  {
    sourcePath: "activity.userEmail",
    targetField: "user.email",
    transformation: "copy",
    required: true,
    notes: "Enrich customer-side if directory attributes are needed.",
  },
  {
    sourcePath: "activity.toolName",
    targetField: "service.name",
    transformation: "copy",
    required: true,
    notes: "Represents the submitted AI tool name, not a managed ShadowGuard connector.",
  },
  {
    sourcePath: "activity.riskLevel + alert.severity",
    targetField: "severity",
    transformation: "prefer alert.severity, fallback to riskLevel",
    required: true,
    notes: "Customer owns any numeric severity conversion.",
  },
  {
    sourcePath: "activity.policyId",
    targetField: "rule.id",
    transformation: "copy or null",
    required: false,
    notes: "Null when no policy id applies.",
  },
  {
    sourcePath: "activity.dataClassification",
    targetField: "labels.agentguard_classification",
    transformation: "flatten metadata into labels",
    required: true,
    notes: "Do not add raw prompt, response, file, or message content.",
  },
];

const ALERT_QUEUE_ROWS: AgentGuardReceiverMappingRow[] = [
  {
    sourcePath: "eventType + eventId",
    targetField: "dedupe_key",
    transformation: "join with colon",
    required: true,
    notes: "Prevents duplicate receiver-side notifications during manual replay.",
  },
  {
    sourcePath: "alert.title",
    targetField: "title",
    transformation: "copy or derive from eventType",
    required: true,
    notes: "Customer middleware chooses final notification or queue title.",
  },
  {
    sourcePath: "alert.severity + activity.riskLevel",
    targetField: "priority",
    transformation: "prefer alert.severity, fallback to riskLevel",
    required: true,
    notes: "Customer owns priority names and escalation policy.",
  },
  {
    sourcePath: "activity.userEmail",
    targetField: "subject_user",
    transformation: "copy",
    required: true,
    notes: "Use for triage, not for automatic disciplinary action.",
  },
  {
    sourcePath: "activity.toolName",
    targetField: "tool",
    transformation: "copy",
    required: true,
    notes: "Useful for customer-owned queue routing.",
  },
  {
    sourcePath: "activity.reason + alert.summary",
    targetField: "summary",
    transformation: "join safe metadata summary",
    required: true,
    notes: "No raw prompt or response content is available in export payloads.",
  },
  {
    sourcePath: "activity.source",
    targetField: "source_owner_hint",
    transformation: "copy source name/environment if present",
    required: false,
    notes: "Customer middleware decides assignment or queue mapping.",
  },
  {
    sourcePath: "activity.dataClassification",
    targetField: "triage_labels",
    transformation: "derive labels from sensitivity and flags",
    required: true,
    notes: "Use as routing hints; ShadowGuard does not create tickets or SOAR cases automatically.",
  },
];

export const AGENT_GUARD_RECEIVER_MAPPING_TEMPLATES: AgentGuardReceiverMappingTemplate[] = [
  {
    id: "webhook_event_log",
    label: "Webhook event log",
    summary:
      "Normalize AgentGuard export events into a customer receiver event-log record.",
    receiverUse:
      "Best first step for validating receiver storage, dedupe, and local analytics before forwarding anywhere else.",
    customerOwner:
      "Customer owns receiver database, retention, replay handling, and any downstream forwarding.",
    rows: WEBHOOK_ROWS,
    sampleOutput: {
      shadowguard_event_id: "agevt_act_demo_001",
      shadowguard_event_type: "agentguard.activity.evaluated",
      observed_at: "2026-05-16T12:00:00.000Z",
      tool: { name: "ChatGPT" },
      user: { email: "employee@example.com" },
      decision: {
        risk_level: "medium",
        blocked: false,
        reason: "No blocking policy matched",
      },
      classification: {
        sensitivity: "confidential",
        categories: ["personal_data", "customer_context"],
        pii_detected: true,
        credentials_detected: false,
        proprietary_detected: false,
      },
      source: {
        id: "source_demo",
        name: "Production wrapper",
        environment: "production",
      },
      content_length: 184,
      alert: null,
    },
  },
  {
    id: "siem_http_intake",
    label: "SIEM HTTP intake",
    summary:
      "Map AgentGuard metadata into a generic SIEM-style HTTP intake event.",
    receiverUse:
      "Use when customer middleware forwards accepted events to a SIEM after signature verification.",
    customerOwner:
      "Customer owns SIEM token storage, index/schema selection, vendor formatting, retry policy, and ingestion monitoring.",
    rows: SIEM_ROWS,
    sampleOutput: {
      timestamp: "2026-05-16T12:00:00.000Z",
      event: {
        id: "agevt_act_demo_001",
        action: "agentguard.policy.blocked",
        outcome: "blocked",
        provider: "ShadowGuard AgentGuard",
      },
      user: { email: "employee@example.com" },
      service: { name: "ChatGPT" },
      severity: "critical",
      rule: { id: "policy_demo" },
      labels: {
        agentguard_risk_level: "high",
        agentguard_sensitivity: "confidential",
        agentguard_categories: ["credentials"],
        agentguard_pii_detected: false,
        agentguard_credentials_detected: true,
        agentguard_proprietary_detected: false,
      },
      message:
        "AgentGuard metadata-only event accepted by customer receiver.",
    },
  },
  {
    id: "customer_alert_queue",
    label: "Customer alert queue",
    summary:
      "Transform alert-worthy events into a customer-owned queue record for downstream triage.",
    receiverUse:
      "Use when customer middleware decides whether to notify, file, suppress, or route an alert-worthy event.",
    customerOwner:
      "Customer owns queue selection, assignee mapping, notification templates, ticket creation criteria, and escalation policy.",
    rows: ALERT_QUEUE_ROWS,
    sampleOutput: {
      dedupe_key: "agentguard.review.required:agevt_act_demo_001_review",
      title: "AgentGuard review required",
      priority: "warning",
      subject_user: "employee@example.com",
      tool: "ChatGPT",
      summary:
        "Review-required metadata event accepted by customer receiver.",
      source_owner_hint: "Production wrapper / production",
      triage_labels: [
        "agentguard",
        "review_required",
        "sensitivity:confidential",
        "pii_detected",
      ],
      customer_action:
        "Customer middleware decides whether this becomes a notification, ticket, SOAR case, or local log.",
    },
  },
];

export function receiverMappingTemplateById(
  id: AgentGuardReceiverMappingTemplateId
): AgentGuardReceiverMappingTemplate {
  return (
    AGENT_GUARD_RECEIVER_MAPPING_TEMPLATES.find(
      (template) => template.id === id
    ) ?? AGENT_GUARD_RECEIVER_MAPPING_TEMPLATES[0]!
  );
}

export function prettyReceiverMappingSample(
  template: AgentGuardReceiverMappingTemplate
): string {
  return JSON.stringify(template.sampleOutput, null, 2);
}

function eventTypeLabel(
  eventTypes: AgentGuardReceiverFieldDictionaryEntry["eventTypes"]
): string {
  return eventTypes === "all" ? "all shipped event types" : eventTypes.join(", ");
}

export function renderReceiverMappingTemplateMarkdown(
  template: AgentGuardReceiverMappingTemplate
): string {
  const lines = [
    `# AgentGuard Receiver Mapping: ${template.label}`,
    "",
    template.summary,
    "",
    `Receiver use: ${template.receiverUse}`,
    `Customer owner: ${template.customerOwner}`,
    "",
    "## Boundaries",
    "",
    AGENT_GUARD_RECEIVER_FIELD_MAPPING_COPY.boundary,
    "",
    "## Shipped Event Types",
    "",
    ...AGENT_GUARD_RECEIVER_MAPPING_EVENT_TYPES.map(
      (eventType) => `- \`${eventType}\``
    ),
    "",
    "## Mapping Rows",
    "",
    "| Source field | Target field | Required | Transformation | Notes |",
    "| --- | --- | --- | --- | --- |",
    ...template.rows.map(
      (row) =>
        `| \`${row.sourcePath}\` | \`${row.targetField}\` | ${
          row.required ? "yes" : "no"
        } | ${row.transformation} | ${row.notes} |`
    ),
    "",
    "## Field Dictionary",
    "",
    "| Field | Type | Events | Customer use |",
    "| --- | --- | --- | --- |",
    ...AGENT_GUARD_RECEIVER_FIELD_DICTIONARY.map(
      (field) =>
        `| \`${field.path}\` | ${field.type} | ${eventTypeLabel(
          field.eventTypes
        )} | ${field.customerUse} |`
    ),
    "",
    "## Safe Sample Output",
    "",
    "```json",
    prettyReceiverMappingSample(template),
    "```",
    "",
    "Do not add source keys, signing secrets, bearer tokens, raw prompts, raw responses, files, messages, or customer data to this handoff.",
  ];

  return lines.join("\n");
}
