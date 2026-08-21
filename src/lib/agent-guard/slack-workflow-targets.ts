import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { agentGuardSampleExportEvent, type AgentGuardExportEvent } from "./export-foundation";

export const AGENT_GUARD_SLACK_URL_SECRET_KEY_ENV =
  "AGENT_GUARD_EXPORT_SECRET_KEY";

export const AGENT_GUARD_SLACK_WORKFLOW_EVENT_TYPES = [
  "agentguard.policy.blocked",
  "agentguard.review.required",
] as const;

export const AGENT_GUARD_SLACK_WORKFLOW_TARGET_TYPES = [
  "workflow_webhook",
  "incoming_webhook",
] as const;

export type AgentGuardSlackWorkflowEventType =
  (typeof AGENT_GUARD_SLACK_WORKFLOW_EVENT_TYPES)[number];

export type AgentGuardSlackWorkflowTargetType =
  (typeof AGENT_GUARD_SLACK_WORKFLOW_TARGET_TYPES)[number];

export type AgentGuardSlackWorkflowTargetStatus = "enabled" | "disabled";
export type AgentGuardSlackWorkflowCustomerApprovalStatus =
  | "not_requested"
  | "requested"
  | "approved"
  | "not_applicable";
export type AgentGuardSlackWorkflowUserIdentifierMode =
  | "redacted"
  | "full_email"
  | "customer_identifier";

export type AgentGuardSlackWorkflowDeliveryStatus =
  | "succeeded"
  | "failed"
  | "dry_run";
export type AgentGuardSlackWorkflowDeliveryMode =
  | "manual_test"
  | "automatic"
  | "dry_run";
export type AgentGuardSlackWorkflowDeliveryEventType =
  | "manual_test"
  | AgentGuardSlackWorkflowEventType;

export type AgentGuardSlackWorkflowTargetRecord = {
  id: string;
  org_id: string;
  name: string;
  target_type: AgentGuardSlackWorkflowTargetType;
  status: AgentGuardSlackWorkflowTargetStatus;
  webhook_url_encrypted: string;
  webhook_url_hash: string;
  webhook_url_hint: string;
  event_types?: string[] | null;
  dry_run_enabled?: boolean | null;
  live_send_enabled?: boolean | null;
  owner_name?: string | null;
  owner_email?: string | null;
  customer_approval_status?: AgentGuardSlackWorkflowCustomerApprovalStatus | null;
  customer_approval_note?: string | null;
  customer_approved_at?: string | null;
  customer_approved_by_email?: string | null;
  user_identifier_mode?: AgentGuardSlackWorkflowUserIdentifierMode | null;
  last_tested_at?: string | null;
  last_successful_test_at?: string | null;
  last_live_attempt_at?: string | null;
};

export type AgentGuardSlackWorkflowMessagePayload = {
  text: string;
  blocks: Array<{
    type: "header" | "section" | "context";
    text?: {
      type: "plain_text" | "mrkdwn";
      text: string;
    };
    fields?: Array<{
      type: "mrkdwn";
      text: string;
    }>;
    elements?: Array<{
      type: "mrkdwn";
      text: string;
    }>;
  }>;
};

export type AgentGuardSlackWorkflowDeliveryTarget = {
  url: string;
  dryRunEnabled?: boolean;
};

export type AgentGuardSlackWorkflowDeliveryResult = {
  eventId: string;
  eventType: AgentGuardSlackWorkflowDeliveryEventType;
  status: AgentGuardSlackWorkflowDeliveryStatus;
  deliveryMode: AgentGuardSlackWorkflowDeliveryMode;
  httpStatus: number | null;
  durationMs: number;
  errorMessage: string | null;
  payload: AgentGuardSlackWorkflowMessagePayload;
};

export type AgentGuardSlackWorkflowFetch = (
  input: string,
  init: RequestInit
) => Promise<Response>;

export type AgentGuardSlackUrlValidation =
  | {
      ok: true;
      url: string;
      targetType: AgentGuardSlackWorkflowTargetType;
      hint: string;
    }
  | { ok: false; reason: string };

function readSlackUrlSecretKey(env: NodeJS.ProcessEnv = process.env): string {
  const key = env[AGENT_GUARD_SLACK_URL_SECRET_KEY_ENV]?.trim();
  if (!key) {
    throw new Error(`${AGENT_GUARD_SLACK_URL_SECRET_KEY_ENV} is required`);
  }
  return key;
}

function derivedKey(rawKey: string): Buffer {
  return createHash("sha256")
    .update("shadowguard-agent-slack-workflow-url-key", "utf8")
    .update(rawKey, "utf8")
    .digest();
}

function encode(value: Buffer): string {
  return value.toString("base64url");
}

function decode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function encryptAgentGuardSlackWebhookUrl(
  url: string,
  rawKey = readSlackUrlSecretKey()
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", derivedKey(rawKey), iv);
  const ciphertext = Buffer.concat([
    cipher.update(url.trim(), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1:${encode(iv)}:${encode(tag)}:${encode(ciphertext)}`;
}

export function decryptAgentGuardSlackWebhookUrl(
  encrypted: string,
  rawKey = readSlackUrlSecretKey()
): string {
  const [version, encodedIv, encodedTag, encodedCiphertext] = encrypted.split(":");
  if (
    version !== "v1" ||
    !encodedIv ||
    !encodedTag ||
    !encodedCiphertext
  ) {
    throw new Error("Invalid AgentGuard Slack webhook URL format");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    derivedKey(rawKey),
    decode(encodedIv)
  );
  decipher.setAuthTag(decode(encodedTag));
  const plaintext = Buffer.concat([
    decipher.update(decode(encodedCiphertext)),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

export function hashAgentGuardSlackWebhookUrl(url: string): string {
  return createHash("sha256").update(url.trim(), "utf8").digest("hex");
}

export function slackWebhookUrlHint(url: string): string {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  const kind = parts[0] ?? "webhook";
  const last = parts[parts.length - 1] ?? "";
  const suffix = last.length > 4 ? last.slice(-4) : "set";
  return `${parsed.hostname}/${kind}/...${suffix}`;
}

function slackTargetTypeFromPath(pathname: string): AgentGuardSlackWorkflowTargetType | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "triggers" && parts.length >= 3) {
    return "workflow_webhook";
  }
  if (parts[0] === "services" && parts.length >= 4) {
    return "incoming_webhook";
  }
  return null;
}

export function validateAgentGuardSlackWebhookUrl(
  value: string
): AgentGuardSlackUrlValidation {
  const input = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, reason: "Slack target URL must be a valid HTTPS URL." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "Slack target URL must use HTTPS." };
  }
  if (parsed.username || parsed.password) {
    return {
      ok: false,
      reason: "Slack target URL must not include embedded credentials.",
    };
  }
  if (parsed.hash) {
    return { ok: false, reason: "Slack target URL must not include a fragment." };
  }
  if (parsed.search) {
    return {
      ok: false,
      reason: "Slack target URL must not include query parameters.",
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== "hooks.slack.com" && hostname !== "hooks.slack-gov.com") {
    return {
      ok: false,
      reason:
        "Slack target URL must use hooks.slack.com or hooks.slack-gov.com.",
    };
  }

  const targetType = slackTargetTypeFromPath(parsed.pathname);
  if (!targetType) {
    return {
      ok: false,
      reason:
        "Slack target URL must look like an incoming webhook /services/... URL or Workflow Builder /triggers/... URL.",
    };
  }

  return {
    ok: true,
    url: parsed.toString(),
    targetType,
    hint: slackWebhookUrlHint(parsed.toString()),
  };
}

export function normalizeAgentGuardSlackWorkflowEventTypes(
  value: string[] | null | undefined
): AgentGuardSlackWorkflowEventType[] {
  const allowed = new Set<string>(AGENT_GUARD_SLACK_WORKFLOW_EVENT_TYPES);
  const seen = new Set<string>();
  const output: AgentGuardSlackWorkflowEventType[] = [];

  for (const item of value ?? []) {
    const normalized = item.trim();
    if (!allowed.has(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized as AgentGuardSlackWorkflowEventType);
  }

  return output.length > 0
    ? output
    : [...AGENT_GUARD_SLACK_WORKFLOW_EVENT_TYPES];
}

export function slackTargetAllowsAutomaticDelivery(
  target: Pick<
    AgentGuardSlackWorkflowTargetRecord,
    | "status"
    | "live_send_enabled"
    | "event_types"
    | "customer_approval_status"
    | "last_successful_test_at"
  >,
  eventType: AgentGuardSlackWorkflowEventType
): boolean {
  return (
    target.status === "enabled" &&
    target.live_send_enabled === true &&
    target.customer_approval_status === "approved" &&
    Boolean(target.last_successful_test_at) &&
    normalizeAgentGuardSlackWorkflowEventTypes(target.event_types).includes(eventType)
  );
}

function clipSlackText(value: string, max = 280): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}...` : trimmed;
}

function redactedEmail(value: string): string {
  const [local, domain] = value.split("@");
  if (!local || !domain) return "redacted";
  return `${local.slice(0, 1)}***@${domain}`;
}

function formatUserIdentifier(
  email: string,
  mode: AgentGuardSlackWorkflowUserIdentifierMode
): string {
  if (mode === "full_email") return email;
  if (mode === "customer_identifier") return "customer-approved identifier";
  return redactedEmail(email);
}

function eventLabel(eventType: string): string {
  if (eventType === "agentguard.policy.blocked") return "Blocked policy";
  if (eventType === "agentguard.review.required") return "Review required";
  if (eventType === "manual_test") return "Manual test";
  return eventType;
}

export function buildAgentGuardSlackMessagePayload(
  event: AgentGuardExportEvent,
  options: {
    targetName: string;
    userIdentifierMode?: AgentGuardSlackWorkflowUserIdentifierMode;
    manualTest?: boolean;
  }
): AgentGuardSlackWorkflowMessagePayload {
  const userIdentifierMode = options.userIdentifierMode ?? "redacted";
  const title = options.manualTest
    ? "AgentGuard Slack preview test"
    : event.alert?.title ?? eventLabel(event.eventType);
  const summary = options.manualTest
    ? "Metadata-only manual test from ShadowGuard AgentGuard."
    : event.alert?.summary ?? event.activity.reason;
  const user = formatUserIdentifier(
    event.activity.userEmail,
    userIdentifierMode
  );
  const text = `${title}: ${event.activity.toolName} (${event.activity.riskLevel})`;

  return {
    text: clipSlackText(text, 180),
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: clipSlackText(title, 120),
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: clipSlackText(summary, 600),
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Event*\n${eventLabel(event.eventType)}` },
          { type: "mrkdwn", text: `*Target*\n${clipSlackText(options.targetName, 80)}` },
          { type: "mrkdwn", text: `*Tool*\n${clipSlackText(event.activity.toolName, 80)}` },
          { type: "mrkdwn", text: `*Risk*\n${clipSlackText(event.activity.riskLevel, 80)}` },
          { type: "mrkdwn", text: `*User*\n${clipSlackText(user, 120)}` },
          { type: "mrkdwn", text: `*Observed*\n${clipSlackText(event.occurredAt, 80)}` },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text:
              "Metadata only. No raw prompt, response, file, message, source key, signing secret, bearer token, or Slack URL is included.",
          },
        ],
      },
    ],
  };
}

export function buildAgentGuardSlackManualTestPayload(options: {
  orgId: string;
  targetName: string;
  userIdentifierMode?: AgentGuardSlackWorkflowUserIdentifierMode;
  now?: Date;
}): {
  eventId: string;
  eventType: "manual_test";
  payload: AgentGuardSlackWorkflowMessagePayload;
} {
  const now = options.now ?? new Date();
  const sample = {
    ...agentGuardSampleExportEvent(),
    eventId: `agslack_test_${randomBytes(12).toString("hex")}`,
    occurredAt: now.toISOString(),
    orgId: options.orgId,
  };

  return {
    eventId: sample.eventId,
    eventType: "manual_test",
    payload: buildAgentGuardSlackMessagePayload(sample, {
      targetName: options.targetName,
      userIdentifierMode: options.userIdentifierMode,
      manualTest: true,
    }),
  };
}

export async function sendAgentGuardSlackWorkflowMessage(
  target: AgentGuardSlackWorkflowDeliveryTarget,
  event: {
    eventId: string;
    eventType: AgentGuardSlackWorkflowDeliveryEventType;
    payload: AgentGuardSlackWorkflowMessagePayload;
  },
  deliveryMode: Exclude<AgentGuardSlackWorkflowDeliveryMode, "dry_run">,
  options: {
    fetchImpl?: AgentGuardSlackWorkflowFetch;
    timeoutMs?: number;
  } = {}
): Promise<AgentGuardSlackWorkflowDeliveryResult> {
  if (target.dryRunEnabled) {
    return {
      eventId: event.eventId,
      eventType: event.eventType,
      status: "dry_run",
      deliveryMode: "dry_run",
      httpStatus: null,
      durationMs: 0,
      errorMessage: null,
      payload: event.payload,
    };
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 8_000
  );
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(target.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "ShadowGuard-AgentGuard-Slack-Preview/1.0",
      },
      body: JSON.stringify(event.payload),
      signal: controller.signal,
    });
    const durationMs = Date.now() - startedAt;
    const responseText = await response.text().catch(() => "");
    const succeeded = response.status >= 200 && response.status <= 299;
    return {
      eventId: event.eventId,
      eventType: event.eventType,
      status: succeeded ? "succeeded" : "failed",
      deliveryMode,
      httpStatus: response.status,
      durationMs,
      errorMessage: succeeded
        ? null
        : `Slack returned HTTP ${response.status}${
            responseText ? `: ${clipSlackText(responseText, 140)}` : ""
          }.`,
      payload: event.payload,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const aborted = error instanceof DOMException && error.name === "AbortError";
    return {
      eventId: event.eventId,
      eventType: event.eventType,
      status: "failed",
      deliveryMode,
      httpStatus: null,
      durationMs,
      errorMessage: aborted
        ? "Slack preview test timed out."
        : error instanceof Error
          ? clipSlackText(error.message, 180)
          : "Slack preview test failed.",
      payload: event.payload,
    };
  } finally {
    clearTimeout(timeout);
  }
}
