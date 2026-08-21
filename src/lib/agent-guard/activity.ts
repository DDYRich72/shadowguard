import {
  lengthOf,
  markSensitive,
  unwrapForClassification,
} from "@/lib/sensitive";
import {
  assessActivityRisk,
  classifyData,
  evaluatePolicyMatches,
  type ActivityType,
  type AgentActivity,
  type AgentPolicy,
  type AgentPolicyMatch,
  type DataClassification,
  type RiskLevel,
} from "./engine";

const FORBIDDEN_METADATA_KEYS = new Set([
  "content",
  "prompt",
  "text",
  "message",
  "body",
  "raw",
  "payload",
]);

export type AgentActivityInput = {
  orgId: string;
  toolName: string;
  userEmail: string;
  activityType: ActivityType;
  content?: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
};

export type AgentActivityInsert = {
  org_id: string;
  tool_name: string;
  user_email: string;
  activity_type: ActivityType;
  data_sensitivity: DataClassification["sensitivity"];
  data_categories: string[];
  pii_detected: boolean;
  credentials_detected: boolean;
  proprietary_detected: boolean;
  risk_level: RiskLevel;
  blocked: boolean;
  block_reason: string | null;
  blocked_by_policy_id: string | null;
  metadata: Record<string, unknown>;
  raw_payload: {
    content_length: number;
  };
};

export type PreparedAgentActivity = {
  activity: AgentActivity;
  classification: DataClassification;
  riskLevel: RiskLevel;
  policyMatches: AgentPolicyMatch[];
  blocked: boolean;
  reason: string;
  blockedByPolicyId: string | null;
  insert: AgentActivityInsert;
};

export type AgentGuardDemoActivity = {
  toolName: string;
  userEmail: string;
  activityType: ActivityType;
  content: string;
  metadata: Record<string, unknown>;
};

type Jsonish =
  | string
  | number
  | boolean
  | null
  | Jsonish[]
  | { [key: string]: Jsonish };

function includesRawContent(value: string, rawContent: string): boolean {
  const normalized = rawContent.trim();
  return normalized.length > 0 && value.includes(normalized);
}

function sanitizeMetadataValue(
  value: unknown,
  rawContent: string
): Jsonish | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (typeof value === "string") {
    return includesRawContent(value, rawContent) ? "<redacted>" : value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeMetadataValue(item, rawContent))
      .filter((item): item is Jsonish => item !== undefined);
  }

  if (typeof value === "object") {
    const output: Record<string, Jsonish> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (FORBIDDEN_METADATA_KEYS.has(key.toLowerCase())) continue;
      const sanitized = sanitizeMetadataValue(nestedValue, rawContent);
      if (sanitized !== undefined) output[key] = sanitized;
    }
    return output;
  }

  return String(value);
}

export function sanitizeAgentActivityMetadata(
  metadata: Record<string, unknown> = {},
  rawContent = ""
): Record<string, unknown> {
  const sanitized = sanitizeMetadataValue(metadata, rawContent);
  return sanitized && !Array.isArray(sanitized) && typeof sanitized === "object"
    ? sanitized
    : {};
}

export function prepareAgentActivity(
  input: AgentActivityInput,
  policies: AgentPolicy[]
): PreparedAgentActivity {
  const rawContent = input.content ?? "";
  const content = markSensitive(rawContent);
  const classification = classifyData(unwrapForClassification(content));
  const { riskLevel } = assessActivityRisk({
    activityType: input.activityType,
    dataClassification: classification,
  });
  const metadata = sanitizeAgentActivityMetadata(input.metadata ?? {}, rawContent);

  const activity: AgentActivity = {
    id: "tmp",
    orgId: input.orgId,
    toolName: input.toolName,
    toolId: typeof metadata.toolId === "string" ? metadata.toolId : "",
    userId: typeof metadata.userId === "string" ? metadata.userId : "",
    userEmail: input.userEmail,
    activityType: input.activityType,
    timestamp: input.timestamp ?? new Date().toISOString(),
    dataClassification: classification,
    riskLevel,
    metadata,
    blocked: false,
  };

  const policyMatches = evaluatePolicyMatches(activity, policies);
  const blockMatch =
    policyMatches.find((match) => match.policyAction === "block") ?? null;
  const blockedByPolicyId = blockMatch?.policyId ?? null;
  const blocked = Boolean(blockMatch);
  const reason = blockMatch
    ? `Blocked by policy: "${blockMatch.policyName}"`
    : "No blocking policy matched";

  return {
    activity,
    classification,
    riskLevel,
    policyMatches,
    blocked,
    reason,
    blockedByPolicyId,
    insert: {
      org_id: input.orgId,
      tool_name: input.toolName,
      user_email: input.userEmail,
      activity_type: input.activityType,
      data_sensitivity: classification.sensitivity,
      data_categories: classification.categories,
      pii_detected: classification.piiDetected,
      credentials_detected: classification.credentialsDetected,
      proprietary_detected: classification.proprietaryDetected,
      risk_level: riskLevel,
      blocked,
      block_reason: blocked ? reason : null,
      blocked_by_policy_id: blockedByPolicyId,
      metadata,
      raw_payload: { content_length: lengthOf(content) },
    },
  };
}

export const AGENT_GUARD_DEMO_ACTIVITIES: AgentGuardDemoActivity[] = [
  {
    toolName: "ChatGPT",
    userEmail: "analyst@example.com",
    activityType: "prompt_sent",
    content:
      "Summarize this customer escalation. Contact is alex@example.com and the support case is marked company confidential.",
    metadata: {
      source: "agentguard_demo",
      demo: true,
      workflow: "customer_support_summary",
    },
  },
  {
    toolName: "GitHub Copilot",
    userEmail: "engineer@example.com",
    activityType: "file_upload",
    content:
      "Internal only code review notes for a new account workflow. No credentials are included.",
    metadata: {
      source: "agentguard_demo",
      demo: true,
      workflow: "code_review",
    },
  },
  {
    toolName: "Unknown AI Assistant",
    userEmail: "ops@example.com",
    activityType: "prompt_sent",
    content: "api_key = demo-key-do-not-use",
    metadata: {
      source: "agentguard_demo",
      demo: true,
      workflow: "credential_exposure_training",
    },
  },
];

export const AGENT_GUARD_ACTIVITY_SNIPPET = `await fetch("/api/agent-guard/activity", {
  method: "POST",
  headers: { "content-type": "application/json" },
  credentials: "include",
  body: JSON.stringify({
    toolName: "ChatGPT",
    userEmail: "employee@company.com",
    activityType: "prompt_sent",
    content: promptText,
    metadata: {
      source: "server-side-wrapper",
      toolId: "chatgpt-team",
    },
  }),
});`;

export const AGENT_GUARD_SOURCE_KEY_SNIPPET = `await fetch(\`\${process.env.SHADOWGUARD_APP_URL}/api/agent-guard/activity\`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: \`Bearer \${process.env.AGENTGUARD_INGEST_TOKEN}\`,
  },
  body: JSON.stringify({
    toolName: "ChatGPT",
    userEmail: "employee@company.com",
    activityType: "prompt_sent",
    content: promptText,
    metadata: {
      source: "server-side-wrapper",
      requestId,
    },
  }),
});`;

export const AGENT_GUARD_INGEST_ERROR_NOTES = [
  "401 unauthorized: missing dashboard session or invalid source key.",
  "403 tool_not_allowed_for_source: the source key is scoped to different tool names.",
  "429 rate_limited: slow down and retry after the returned retry_after_seconds value.",
  "400 validation_failed: the event body is missing required fields or exceeds limits.",
] as const;

export const AGENT_GUARD_CURRENT_CAPABILITIES = [
  "Accepts submitted AI activity through the AgentGuard ingest API.",
  "Supports scoped source keys for customer-controlled server-side integrations.",
  "Shows advisory source-key rotation posture so operators can schedule replacement, testing, and revocation.",
  "Classifies submitted content in memory and stores classification metadata.",
  "Stores content length instead of raw prompt, response, file, or message text.",
  "Evaluates enabled policies and returns allow/block decision metadata.",
  "Supports a global kill switch decision path for submitted activity.",
  "Shows dashboard activity, source attribution, source health, tool rollups, policies, and settings for beta review.",
  "Provides an operator guide that maps the AgentGuard process from first source key through enterprise-readiness evidence.",
  "Shows contextual workflow assist panels on Setup, Ingestion, and Policies so operators can confirm what to do and where to go next.",
  "Defines a metadata-only export payload and signing contract for future opt-in delivery.",
  "Supports opt-in HTTPS export destinations and manual signed test delivery.",
  "Supports generic alert routing through guarded HTTPS export destinations for evaluated activity, blocked policy, and review-required events.",
  "Supports guarded automatic export preview controls with event-type selection, dry-run logging, and live sends only after all gates are enabled.",
  "Shows export destination health and supports explicit manual replay of failed delivery attempts.",
  "Hardens HTTPS export destinations with receiver owner, escalation path, customer-confirmed acknowledgement posture, and grouped failure reason guidance.",
  "Provides Receiver field-mapping templates with a field dictionary and generic webhook/event log, SIEM HTTP intake, and customer alert queue mappings for customer-owned receivers.",
  "Provides native connector groundwork with preflight decisions for credential ownership, storage boundaries, manual test paths, failure behavior, rate limits, data fields, customer responsibilities, and forbidden claims before any vendor connector implementation.",
  "Provides a Slack workflow URL preview implementation with encrypted Slack URL storage, URL hints only, guarded manual metadata-only tests, delivery attempts, dry-run/live posture, delete-secret behavior, and claim boundaries.",
  "Saves metadata-only Slack preview evidence handoffs with target posture, URL hints only, owner, approval, event scope, dry-run/manual delivery evidence, and claim boundaries.",
  "Shows Slack automatic preview readiness gates so operators can distinguish auto-off, dry-run rehearsal, and outbound-caution posture without changing delivery behavior.",
  "Provides receiver integration examples for customer-controlled Next.js, Express, and FastAPI endpoints.",
  "Validates customer-owned HTTPS export receiver posture from configured destinations, delivery attempts, event scope, dry-run/live state, and copyable handoff guidance.",
  "Provides a versioned AgentGuard enterprise integration contract with headers, request fields, response fields, error codes, safe sample payloads, server-side examples, and a markdown download.",
  "Provides deterministic integration diagnostics for customer-controlled server-side wrappers with failure-code guidance and copyable PowerShell, cURL, Node fetch, and Python requests test commands.",
  "Provides a source-key lifecycle handoff with token hints, advisory rotation posture, source next actions, lifecycle stages, and copyable replacement-first rotation guidance.",
  "Creates a policy review queue for warn and quarantine policy matches from submitted activity.",
  "Provides guided policy templates that prefill editable drafts and explain block, warn, quarantine, and allow behavior.",
  "Shows deterministic policy outcome analytics from recent submitted activity and policy review rows.",
  "Shows deterministic source-to-policy coverage guidance from source-attributed activity and policy outcomes.",
  "Shows advisory production rollout guardrails from source health, submitted activity, policy coverage, review load, and export posture.",
  "Records metadata-only rollout acknowledgements with reviewer, source posture, checklist, export posture, and notes.",
  "Builds a read-only pilot readiness report from submitted activity, policy coverage, review load, export posture, and rollout acknowledgement evidence.",
  "Shows a read-only operator command center with deterministic next-action guidance from existing AgentGuard metadata.",
  "Saves metadata-only AgentGuard evidence packets for point-in-time enterprise-readiness review.",
  "Shows a read-only enterprise setup wizard for source, activity, policy, review, evidence packet, and export readiness steps.",
  "Provides copyable SDK starter examples for customer-controlled server-side source-key submissions.",
  "Records metadata-only integration evidence for customer-controlled AgentGuard source implementations.",
  "Generates a copyable metadata-only enterprise runbook handoff from setup, SDK, evidence, and export posture.",
  "Downloads a customer-engineer implementation checklist for customer-controlled server-side source implementation handoffs.",
  "Provides an operator-run enterprise smoke-test checklist for demo and release readiness across ShadowGuard, AI Governance, AgentGuard, evidence, and export posture.",
  "Shows an Enterprise handoff package that groups readiness posture, saved evidence packet status, implementation evidence, runbook, checklist, smoke-test, and export receiver posture.",
  "Documents the canonical production AgentGuard endpoint for customer-controlled server-side wrappers.",
  "Packages AgentGuard into 7-day and 14-day enterprise pilot paths with responsibilities, proof artifacts, entry criteria, and exit criteria.",
  "Shows connector readiness planning for customer-owned HTTPS receiver and middleware paths.",
  "Uses role-aware RLS, same-origin API mutation checks, privileged-role MFA gates, and invalid source-key rate limiting as abuse-resistance support.",
] as const;

export const AGENT_GUARD_NOT_SHIPPED_YET = [
  "Packaged browser extension or universal collector.",
  "Automatic activity capture from every discovered AI tool.",
  "AI-generated policy recommendations, automatic policy edits, automatic source-specific policy tuning, automatic source promotion, or automatic historical policy tuning.",
  "Automatic rollout approval gates or automatic promotion from acknowledgement history.",
  "Employee appeal or override workflow.",
  "Automatic third-party quarantine holds, file rollback, or app-level remediation without customer integration support.",
  "Hosted receiver deployment or managed receiver operations.",
  "Slack app installation, Slack OAuth, bot tokens, channel discovery, vendor-specific SIEM, syslog, Teams, email connectors, background retry queues, automatic escalation, or broad native notification routing.",
  "Native managed SOAR, ticketing, chat, email, data lake, event bus, or audit-vault connectors.",
  "Published or installable SDK packages, hosted collectors, or turnkey third-party collector marketplace.",
  "Signed or PDF AgentGuard evidence packets.",
  "Secret vaulting, source-key recovery, raw content archives, or uploaded implementation evidence files.",
] as const;
