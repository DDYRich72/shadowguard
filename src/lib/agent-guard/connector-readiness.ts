export type AgentGuardConnectorReadinessCategory =
  | "webhook"
  | "siem"
  | "soar_ticketing"
  | "chat_email"
  | "data_platform"
  | "audit_evidence";

export type AgentGuardConnectorReadinessStatus =
  | "ready_with_https_receiver"
  | "requires_customer_middleware"
  | "future_native_connector";

export type AgentGuardConnectorReadinessEntry = {
  id: string;
  category: AgentGuardConnectorReadinessCategory;
  label: string;
  status: AgentGuardConnectorReadinessStatus;
  statusLabel: string;
  description: string;
  supportedPath: string;
  customerRequirement: string;
  evidenceToPrepare: string[];
  boundary: string;
};

export type AgentGuardConnectorReadinessGroup = {
  category: AgentGuardConnectorReadinessCategory;
  label: string;
  entries: AgentGuardConnectorReadinessEntry[];
};

export const AGENT_GUARD_CONNECTOR_READINESS_COPY = {
  title: "Connector readiness matrix",
  overview:
    "Planning matrix for customer-owned AgentGuard export receivers and downstream enterprise integration paths.",
  boundary:
    "This matrix is readiness planning. ShadowGuard currently supports guarded HTTPS export destinations and receiver examples; it does not ship native managed SIEM, SOAR, ticketing, chat, email, data lake, or audit-vault connectors.",
} as const;

export const AGENT_GUARD_CONNECTOR_READINESS_STATUS_LABELS: Record<
  AgentGuardConnectorReadinessStatus,
  string
> = {
  ready_with_https_receiver: "Ready with HTTPS receiver",
  requires_customer_middleware: "Requires customer middleware",
  future_native_connector: "Future native connector",
};

export const AGENT_GUARD_CONNECTOR_READINESS_CATEGORY_LABELS: Record<
  AgentGuardConnectorReadinessCategory,
  string
> = {
  webhook: "Webhook receiver",
  siem: "SIEM intake",
  soar_ticketing: "SOAR / ticketing",
  chat_email: "Chat / email relay",
  data_platform: "Data lake / event bus",
  audit_evidence: "Audit / evidence repository",
};

const CUSTOMER_BOUNDARY =
  "Customer owns receiver credentials, downstream routing, storage, and any vendor-specific transformation.";

export const AGENT_GUARD_CONNECTOR_READINESS_CATALOG: AgentGuardConnectorReadinessEntry[] = [
  {
    id: "https-webhook",
    category: "webhook",
    label: "Generic HTTPS webhook",
    status: "ready_with_https_receiver",
    statusLabel:
      AGENT_GUARD_CONNECTOR_READINESS_STATUS_LABELS.ready_with_https_receiver,
    description:
      "Use the existing AgentGuard export destination to send signed metadata-only events to a customer-controlled HTTPS endpoint.",
    supportedPath:
      "Configure an HTTPS destination, keep dry-run on for testing, send a signed test event, then explicitly enable live sends when ready.",
    customerRequirement:
      "Customer-operated HTTPS receiver that verifies ShadowGuard signing headers and returns a 2xx response after metadata handling.",
    evidenceToPrepare: [
      "Receiver URL and owner",
      "Signing secret storage location",
      "Test delivery result",
      "Duplicate event handling",
    ],
    boundary: CUSTOMER_BOUNDARY,
  },
  {
    id: "siem-http-intake",
    category: "siem",
    label: "SIEM HTTP intake via receiver",
    status: "requires_customer_middleware",
    statusLabel:
      AGENT_GUARD_CONNECTOR_READINESS_STATUS_LABELS.requires_customer_middleware,
    description:
      "Route AgentGuard metadata-only export events through a customer receiver that adapts the payload for the SIEM intake format.",
    supportedPath:
      "ShadowGuard sends signed HTTPS events to customer middleware; customer middleware maps fields into the SIEM destination.",
    customerRequirement:
      "Customer-owned SIEM token handling, field mapping, retry behavior, and storage rules.",
    evidenceToPrepare: [
      "Field mapping document",
      "Receiver-to-SIEM owner",
      "Dry-run sample payload",
      "Failure and replay procedure",
    ],
    boundary:
      "ShadowGuard does not ship a native managed SIEM connector or SIEM-specific transformation in this path.",
  },
  {
    id: "soar-ticketing-middleware",
    category: "soar_ticketing",
    label: "SOAR or ticketing middleware",
    status: "requires_customer_middleware",
    statusLabel:
      AGENT_GUARD_CONNECTOR_READINESS_STATUS_LABELS.requires_customer_middleware,
    description:
      "Use customer middleware to turn selected AgentGuard metadata events into tickets or SOAR cases after local routing decisions.",
    supportedPath:
      "AgentGuard export event -> customer receiver -> customer ticket/SOAR workflow.",
    customerRequirement:
      "Customer-owned routing rules, ticket deduplication, assignment, vendor credentials, and escalation behavior.",
    evidenceToPrepare: [
      "Ticket creation criteria",
      "Owner and queue mapping",
      "Deduplication rule",
      "Dry-run ticket sample",
    ],
    boundary:
      "ShadowGuard does not automatically create tickets or manage SOAR cases today.",
  },
  {
    id: "chat-email-relay",
    category: "chat_email",
    label: "Chat or email relay",
    status: "requires_customer_middleware",
    statusLabel:
      AGENT_GUARD_CONNECTOR_READINESS_STATUS_LABELS.requires_customer_middleware,
    description:
      "Use customer middleware to relay selected metadata-only events into internal chat or email notification channels.",
    supportedPath:
      "AgentGuard export event -> customer receiver -> customer notification relay.",
    customerRequirement:
      "Customer-owned channel selection, rate controls, recipient lists, message templates, and vendor credentials.",
    evidenceToPrepare: [
      "Notification criteria",
      "Recipient/channel owner",
      "Rate-limit decision",
      "Sample notification text",
    ],
    boundary:
      "ShadowGuard does not send native Slack, Teams, or email notifications from AgentGuard today.",
  },
  {
    id: "data-platform-receiver",
    category: "data_platform",
    label: "Data lake or event bus receiver",
    status: "requires_customer_middleware",
    statusLabel:
      AGENT_GUARD_CONNECTOR_READINESS_STATUS_LABELS.requires_customer_middleware,
    description:
      "Use a customer receiver to place AgentGuard metadata events into a customer-owned event bus, queue, lake, or warehouse path.",
    supportedPath:
      "AgentGuard export event -> customer receiver -> customer data platform writer.",
    customerRequirement:
      "Customer-owned storage credentials, schema mapping, retention rules, and replay/duplication behavior.",
    evidenceToPrepare: [
      "Destination schema",
      "Retention rule",
      "Writer owner",
      "Duplicate event handling",
    ],
    boundary:
      "ShadowGuard does not host data lake writers or manage customer storage credentials.",
  },
  {
    id: "audit-evidence-repository",
    category: "audit_evidence",
    label: "Audit or evidence repository",
    status: "requires_customer_middleware",
    statusLabel:
      AGENT_GUARD_CONNECTOR_READINESS_STATUS_LABELS.requires_customer_middleware,
    description:
      "Use customer middleware to file selected metadata-only AgentGuard events or runbook artifacts into an evidence repository.",
    supportedPath:
      "AgentGuard runbook/evidence packet copied or export event delivered to customer receiver, then filed by customer workflow.",
    customerRequirement:
      "Customer-owned repository credentials, folder/taxonomy decisions, retention settings, and reviewer workflow.",
    evidenceToPrepare: [
      "Evidence taxonomy",
      "Repository owner",
      "Retention rule",
      "Reviewer workflow",
    ],
    boundary:
      "ShadowGuard does not provide an auditor portal, evidence vault, or legal attestation workflow for AgentGuard today.",
  },
];

export function groupAgentGuardConnectorReadinessCatalog(
  entries = AGENT_GUARD_CONNECTOR_READINESS_CATALOG
): AgentGuardConnectorReadinessGroup[] {
  return Object.entries(AGENT_GUARD_CONNECTOR_READINESS_CATEGORY_LABELS).map(
    ([category, label]) => ({
      category: category as AgentGuardConnectorReadinessCategory,
      label,
      entries: entries.filter((entry) => entry.category === category),
    })
  );
}

export function agentGuardConnectorReadinessStatusCounts(
  entries = AGENT_GUARD_CONNECTOR_READINESS_CATALOG
): Record<AgentGuardConnectorReadinessStatus, number> {
  return entries.reduce(
    (counts, entry) => ({
      ...counts,
      [entry.status]: counts[entry.status] + 1,
    }),
    {
      ready_with_https_receiver: 0,
      requires_customer_middleware: 0,
      future_native_connector: 0,
    } satisfies Record<AgentGuardConnectorReadinessStatus, number>
  );
}
