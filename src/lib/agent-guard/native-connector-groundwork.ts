export type AgentGuardNativeConnectorCandidateId =
  | "generic_https_foundation"
  | "slack_workflow_url_preview"
  | "teams_incoming_webhook_preview"
  | "siem_http_intake_pack"
  | "ticketing_soar_middleware_pack";

export type AgentGuardNativeConnectorPosture =
  | "shipped_https_foundation"
  | "recommended_first_native_spec"
  | "candidate_after_first_native"
  | "defer_until_customer_signal";

export type AgentGuardNativeConnectorCandidate = {
  id: AgentGuardNativeConnectorCandidateId;
  label: string;
  category: string;
  posture: AgentGuardNativeConnectorPosture;
  postureLabel: string;
  decision: string;
  credentialOwner: string;
  credentialStorageBoundary: string;
  testEventPath: string;
  failureBehavior: string;
  rateLimitPosture: string;
  dataFieldsSent: string[];
  customerResponsibilities: string[];
  forbiddenClaims: string[];
  nextSpecQuestions: string[];
};

export const AGENT_GUARD_NATIVE_CONNECTOR_GROUNDWORK_COPY = {
  title: "Native connector groundwork",
  overview:
    "Decision framework for the first future AgentGuard native connector candidate. It turns connector ambition into credential, failure, rate-limit, data-field, responsibility, and claim-boundary decisions before implementation.",
  currentDecision:
    "Do not build a vendor connector yet. The first future native connector candidate to spec is a Slack workflow URL or incoming webhook preview because it has the narrowest credential surface and can reuse metadata-only alert events. Existing generic HTTPS export remains the shipped integration path today.",
  boundary:
    "Native connector groundwork is a planning and preflight artifact. It does not ship a Slack app, Teams app, email service, managed SIEM connector, SOAR connector, ticketing connector, data-lake writer, audit-vault connector, managed customer credential storage, automatic retry, automatic escalation, hosted receiver operations, legal advice, certification, compliance determination, auditor attestation, or security warranty.",
} as const;

export const AGENT_GUARD_NATIVE_CONNECTOR_POSTURE_LABELS: Record<
  AgentGuardNativeConnectorPosture,
  string
> = {
  shipped_https_foundation: "Shipped HTTPS foundation",
  recommended_first_native_spec: "First native spec candidate",
  candidate_after_first_native: "Candidate after first native spec",
  defer_until_customer_signal: "Defer until customer signal",
};

const METADATA_FIELDS = [
  "eventId",
  "eventType",
  "occurredAt",
  "activity.toolName",
  "activity.userEmail",
  "activity.activityType",
  "activity.riskLevel",
  "activity.blocked",
  "activity.reason",
  "activity.policyId",
  "activity.dataClassification",
  "activity.source",
  "activity.contentLength",
  "alert.category",
  "alert.severity",
  "alert.title",
  "alert.summary",
  "alert.policyActions",
] as const;

const NO_SECRET_BOUNDARY =
  "ShadowGuard must not expose or persist customer vendor tokens in browser copy, docs, logs, delivery attempts, or handoff artifacts.";

export const AGENT_GUARD_NATIVE_CONNECTOR_CANDIDATES: AgentGuardNativeConnectorCandidate[] = [
  {
    id: "generic_https_foundation",
    label: "Generic HTTPS export foundation",
    category: "Existing foundation",
    posture: "shipped_https_foundation",
    postureLabel:
      AGENT_GUARD_NATIVE_CONNECTOR_POSTURE_LABELS.shipped_https_foundation,
    decision:
      "Keep this as the shipped production pilot path while native connector behavior is specified.",
    credentialOwner:
      "ShadowGuard owns only the AgentGuard export signing secret; customer owns receiver and downstream vendor credentials.",
    credentialStorageBoundary:
      "Export signing secrets are stored for configured HTTPS destinations; vendor credentials stay in customer systems.",
    testEventPath:
      "Use the existing manual signed test and dry-run/live export controls on AgentGuard export destinations.",
    failureBehavior:
      "Failed delivery attempts remain visible for manual replay; no background retry worker or automatic escalation is shipped.",
    rateLimitPosture:
      "Current delivery uses guarded destination controls. Customer middleware owns downstream vendor rate limits.",
    dataFieldsSent: [...METADATA_FIELDS],
    customerResponsibilities: [
      "Verify HMAC signing headers.",
      "Store or forward metadata-only events.",
      "Handle dedupe and replay.",
      "Manage downstream vendor tokens.",
      "Own escalation and alert fatigue controls.",
    ],
    forbiddenClaims: [
      "Native Slack, Teams, email, SIEM, SOAR, ticketing, data-lake, or audit-vault connector is shipped.",
      "ShadowGuard manages customer vendor credentials.",
      "Automatic retry or escalation is active.",
      "2xx delivery proves internal receiver-side processing.",
    ],
    nextSpecQuestions: [
      "Which downstream path is most painful for pilot customers after HTTPS receiver validation?",
      "Which vendor credential model is acceptable to the customer?",
      "Which event types should be allowed for a first native preview?",
    ],
  },
  {
    id: "slack_workflow_url_preview",
    label: "Slack workflow URL preview",
    category: "Chat notification",
    posture: "recommended_first_native_spec",
    postureLabel:
      AGENT_GUARD_NATIVE_CONNECTOR_POSTURE_LABELS.recommended_first_native_spec,
    decision:
      "Recommended first future native connector spec because it can be constrained to metadata-only alert events and a single customer-provided workflow URL.",
    credentialOwner:
      "Customer creates and owns the Slack workflow URL or incoming webhook URL; ShadowGuard must only store it after an explicit connector spec and security review.",
    credentialStorageBoundary:
      `${NO_SECRET_BOUNDARY} A future implementation must encrypt connector secrets, hide plaintext after creation, and exclude them from copied handoffs.`,
    testEventPath:
      "Send a manual metadata-only test event to the selected Slack workflow while automatic delivery remains off by default.",
    failureBehavior:
      "Record the HTTP result and customer-actionable error group. Do not retry in the background and do not escalate automatically.",
    rateLimitPosture:
      "Default to low-volume manual tests and selected alert-worthy events only; document Slack rate-limit behavior before live preview.",
    dataFieldsSent: [
      "eventId",
      "eventType",
      "occurredAt",
      "activity.toolName",
      "activity.userEmail",
      "activity.riskLevel",
      "activity.reason",
      "alert.severity",
      "alert.title",
      "alert.summary",
    ],
    customerResponsibilities: [
      "Create the Slack workflow or incoming webhook.",
      "Choose channel and recipient policy.",
      "Approve metadata fields before live sends.",
      "Own internal Slack message retention and access.",
      "Review failed delivery attempts manually.",
    ],
    forbiddenClaims: [
      "Do not claim installed Slack app support.",
      "ShadowGuard manages Slack workspace administration.",
      "Messages are guaranteed to be delivered.",
      "Slack notifications replace SIEM, ticketing, or incident response.",
      "Automatic escalation is shipped.",
    ],
    nextSpecQuestions: [
      "Should the first preview use Slack workflow URLs, incoming webhooks, or both?",
      "Who can create, edit, test, disable, and delete a Slack connector?",
      "Which event types are allowed at launch: blocked policy, review required, or evaluated activity?",
      "What fields must be redacted or omitted from Slack messages?",
      "What is the live-send gate and rollback path?",
    ],
  },
  {
    id: "teams_incoming_webhook_preview",
    label: "Teams incoming webhook preview",
    category: "Chat notification",
    posture: "candidate_after_first_native",
    postureLabel:
      AGENT_GUARD_NATIVE_CONNECTOR_POSTURE_LABELS.candidate_after_first_native,
    decision:
      "Consider after the Slack preview spec proves the connector contract, credential boundaries, and message formatting pattern.",
    credentialOwner:
      "Customer owns the Teams incoming webhook or workflow URL and channel-level governance.",
    credentialStorageBoundary:
      `${NO_SECRET_BOUNDARY} A future implementation must treat Teams URLs as secrets and hide plaintext after creation.`,
    testEventPath:
      "Manual metadata-only test event with automatic delivery off by default.",
    failureBehavior:
      "Record delivery status and manual next action only; no background retry or automatic escalation.",
    rateLimitPosture:
      "Use selected alert-worthy events and document Teams webhook limits before live preview.",
    dataFieldsSent: [
      "eventId",
      "eventType",
      "occurredAt",
      "activity.toolName",
      "activity.userEmail",
      "activity.riskLevel",
      "alert.severity",
      "alert.title",
      "alert.summary",
    ],
    customerResponsibilities: [
      "Create the Teams webhook or workflow.",
      "Choose channel and ownership.",
      "Approve message content.",
      "Own Microsoft tenant governance.",
      "Review delivery failures manually.",
    ],
    forbiddenClaims: [
      "Teams app is installed.",
      "ShadowGuard manages Microsoft tenant messaging policy.",
      "Messages are guaranteed to be delivered.",
      "Automatic escalation is active.",
    ],
    nextSpecQuestions: [
      "Should Teams wait until Slack connector behavior is proven?",
      "What adaptive-card or plain-message format is acceptable?",
      "Which Teams tenant restrictions might block webhook delivery?",
    ],
  },
  {
    id: "siem_http_intake_pack",
    label: "SIEM HTTP intake template pack",
    category: "SIEM",
    posture: "defer_until_customer_signal",
    postureLabel:
      AGENT_GUARD_NATIVE_CONNECTOR_POSTURE_LABELS.defer_until_customer_signal,
    decision:
      "Defer native SIEM implementation until a pilot customer names the SIEM, required schema, credential model, rate limits, and evidence expectations.",
    credentialOwner:
      "Customer owns SIEM token creation, index/source-type selection, retention, and ingestion monitoring.",
    credentialStorageBoundary:
      "Do not store SIEM API tokens until a vendor-specific connector spec defines encrypted storage, access rules, rotation, and audit behavior.",
    testEventPath:
      "Use receiver field-mapping templates and customer middleware for now; a future native path would require a manual test event per SIEM destination.",
    failureBehavior:
      "Do not create a managed retry queue until SIEM-specific idempotency, backoff, quota, and cost implications are specified.",
    rateLimitPosture:
      "Customer middleware owns rate limits today; future native work must document vendor quotas and backoff before live sends.",
    dataFieldsSent: [...METADATA_FIELDS],
    customerResponsibilities: [
      "Name the SIEM and required intake endpoint.",
      "Approve schema and severity mapping.",
      "Own token lifecycle until a managed credential model is approved.",
      "Own retention, indexing, and alert correlation.",
      "Confirm whether failed events should be replayed manually or queued.",
    ],
    forbiddenClaims: [
      "Managed SIEM connector is shipped.",
      "Native Splunk, Datadog, Sentinel, QRadar, or Chronicle integration is available.",
      "ShadowGuard manages SIEM tokens.",
      "Background retry queue is active.",
      "SIEM ingestion proves compliance.",
    ],
    nextSpecQuestions: [
      "Which SIEM is first and why?",
      "What schema is required?",
      "Who owns token rotation?",
      "What retry and dead-letter behavior is acceptable?",
      "What ingestion cost and rate-limit guardrails are required?",
    ],
  },
  {
    id: "ticketing_soar_middleware_pack",
    label: "Ticketing/SOAR middleware template",
    category: "Ticketing and SOAR",
    posture: "defer_until_customer_signal",
    postureLabel:
      AGENT_GUARD_NATIVE_CONNECTOR_POSTURE_LABELS.defer_until_customer_signal,
    decision:
      "Defer native ticketing or SOAR implementation until routing, dedupe, assignment, escalation, and ownership decisions are approved.",
    credentialOwner:
      "Customer owns ticketing/SOAR credentials, queues, assignment rules, and escalation policy.",
    credentialStorageBoundary:
      "Do not store ticketing or SOAR tokens until a vendor-specific connector spec defines encrypted storage, role access, rotation, audit events, and deletion.",
    testEventPath:
      "Use customer alert queue mapping and customer middleware for now; a future native path would require a manual test case that cannot create production tickets accidentally.",
    failureBehavior:
      "Do not automatically create or escalate cases. Future work must define duplicate detection, suppression, manual replay, and dead-letter behavior.",
    rateLimitPosture:
      "Customer middleware owns rate limits today; future native work must define maximum ticket creation volume and suppression rules.",
    dataFieldsSent: [
      "eventId",
      "eventType",
      "occurredAt",
      "activity.toolName",
      "activity.userEmail",
      "activity.riskLevel",
      "activity.reason",
      "activity.policyId",
      "alert.category",
      "alert.severity",
      "alert.title",
      "alert.summary",
      "alert.policyActions",
    ],
    customerResponsibilities: [
      "Define ticket creation criteria.",
      "Own queue, assignment, and escalation mapping.",
      "Approve dedupe and suppression behavior.",
      "Own vendor credentials and workflow permissions.",
      "Review failed attempts before manual replay.",
    ],
    forbiddenClaims: [
      "ShadowGuard automatically creates tickets.",
      "SOAR cases are managed by AgentGuard.",
      "Escalations happen automatically.",
      "Customer workflow ownership is replaced.",
      "Incident response is automated.",
    ],
    nextSpecQuestions: [
      "Which vendor and object type would be first?",
      "What criteria creates a ticket versus a notification only?",
      "How are duplicates detected and suppressed?",
      "Who can trigger manual replay into ticketing/SOAR?",
      "How should customer rollback or connector disable work?",
    ],
  },
];

export function nativeConnectorCandidateById(
  id: AgentGuardNativeConnectorCandidateId
): AgentGuardNativeConnectorCandidate {
  return (
    AGENT_GUARD_NATIVE_CONNECTOR_CANDIDATES.find(
      (candidate) => candidate.id === id
    ) ?? AGENT_GUARD_NATIVE_CONNECTOR_CANDIDATES[0]!
  );
}

export function firstNativeConnectorSpecCandidate(
  candidates = AGENT_GUARD_NATIVE_CONNECTOR_CANDIDATES
): AgentGuardNativeConnectorCandidate {
  return (
    candidates.find(
      (candidate) => candidate.posture === "recommended_first_native_spec"
    ) ?? candidates[0]!
  );
}

export function agentGuardNativeConnectorPostureCounts(
  candidates = AGENT_GUARD_NATIVE_CONNECTOR_CANDIDATES
): Record<AgentGuardNativeConnectorPosture, number> {
  return candidates.reduce(
    (counts, candidate) => ({
      ...counts,
      [candidate.posture]: counts[candidate.posture] + 1,
    }),
    {
      shipped_https_foundation: 0,
      recommended_first_native_spec: 0,
      candidate_after_first_native: 0,
      defer_until_customer_signal: 0,
    } satisfies Record<AgentGuardNativeConnectorPosture, number>
  );
}

function markdownList(items: string[]): string[] {
  return items.map((item) => `- ${item}`);
}

export function renderNativeConnectorGroundworkMarkdown(
  selected = firstNativeConnectorSpecCandidate()
): string {
  const lines = [
    "# AgentGuard Native Connector Groundwork",
    "",
    AGENT_GUARD_NATIVE_CONNECTOR_GROUNDWORK_COPY.currentDecision,
    "",
    "## Boundaries",
    "",
    AGENT_GUARD_NATIVE_CONNECTOR_GROUNDWORK_COPY.boundary,
    "",
    "## Candidate Matrix",
    "",
    "| Candidate | Posture | Decision | Credential owner |",
    "| --- | --- | --- | --- |",
    ...AGENT_GUARD_NATIVE_CONNECTOR_CANDIDATES.map(
      (candidate) =>
        `| ${candidate.label} | ${candidate.postureLabel} | ${candidate.decision} | ${candidate.credentialOwner} |`
    ),
    "",
    `## Selected Candidate For Next Spec: ${selected.label}`,
    "",
    `Posture: ${selected.postureLabel}`,
    `Credential owner: ${selected.credentialOwner}`,
    `Credential storage boundary: ${selected.credentialStorageBoundary}`,
    `Test event path: ${selected.testEventPath}`,
    `Failure behavior: ${selected.failureBehavior}`,
    `Rate-limit posture: ${selected.rateLimitPosture}`,
    "",
    "### Data Fields",
    "",
    ...markdownList(selected.dataFieldsSent.map((field) => `\`${field}\``)),
    "",
    "### Customer Responsibilities",
    "",
    ...markdownList(selected.customerResponsibilities),
    "",
    "### Forbidden Claims",
    "",
    ...markdownList(selected.forbiddenClaims),
    "",
    "### Next Spec Questions",
    "",
    ...markdownList(selected.nextSpecQuestions),
    "",
    "Do not add source keys, signing secrets, bearer tokens, private keys, raw prompts, raw responses, files, messages, or customer data to this handoff.",
  ];

  return lines.join("\n");
}
