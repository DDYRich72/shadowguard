import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { isIP } from "node:net";
import type { AgentExportReceiverAcknowledgementStatus } from "./export-hardening";

export const AGENT_GUARD_EXPORT_SECRET_PREFIX = "sgae_";
export const AGENT_GUARD_EXPORT_SECRET_KEY_ENV = "AGENT_GUARD_EXPORT_SECRET_KEY";
export const AGENT_GUARD_EXPORT_EVENT_TYPES = [
  "agentguard.activity.evaluated",
  "agentguard.policy.blocked",
  "agentguard.review.required",
] as const;

export type AgentExportDestinationType = "webhook" | "siem";
export type AgentExportDestinationStatus = "enabled" | "disabled";
export type AgentExportEventType = (typeof AGENT_GUARD_EXPORT_EVENT_TYPES)[number];

export type AgentExportDestinationRecord = {
  id: string;
  org_id: string;
  name: string;
  destination_type: AgentExportDestinationType;
  status: AgentExportDestinationStatus;
  endpoint_url: string;
  signing_secret_encrypted: string;
  signing_secret_hint: string;
  automatic_delivery_enabled?: boolean | null;
  dry_run_enabled?: boolean | null;
  event_types?: string[] | null;
  owner_name?: string | null;
  owner_email?: string | null;
  escalation_path?: string | null;
  receiver_acknowledgement_status?: AgentExportReceiverAcknowledgementStatus | null;
  receiver_acknowledgement_note?: string | null;
  receiver_acknowledged_at?: string | null;
  receiver_acknowledged_by_email?: string | null;
};

export type AgentExportDestinationValidation =
  | { ok: true; url: string }
  | { ok: false; reason: string };

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  const [a, b] = parts;
  if (a === undefined || b === undefined) return false;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "0:0:0:0:0:0:0:1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

export function validateAgentExportDestinationUrl(
  value: string
): AgentExportDestinationValidation {
  const input = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, reason: "Destination URL must be a valid HTTPS URL." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "Destination URL must use HTTPS." };
  }
  if (parsed.username || parsed.password) {
    return {
      ok: false,
      reason: "Destination URL must not include embedded credentials.",
    };
  }
  if (parsed.hash) {
    return { ok: false, reason: "Destination URL must not include a fragment." };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return {
      ok: false,
      reason: "Destination URL must not target local or internal hostnames.",
    };
  }

  const ipVersion = isIP(hostname);
  if (ipVersion === 4 && isPrivateIpv4(hostname)) {
    return {
      ok: false,
      reason: "Destination URL must not target private or local IP ranges.",
    };
  }
  if (ipVersion === 6 && isPrivateIpv6(hostname)) {
    return {
      ok: false,
      reason: "Destination URL must not target private or local IP ranges.",
    };
  }

  return { ok: true, url: parsed.toString() };
}

export function normalizeAgentExportEventTypes(
  value: string[] | null | undefined
): AgentExportEventType[] {
  const allowed = new Set<string>(AGENT_GUARD_EXPORT_EVENT_TYPES);
  const seen = new Set<string>();
  const output: AgentExportEventType[] = [];

  for (const item of value ?? []) {
    const normalized = item.trim();
    if (!allowed.has(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized as AgentExportEventType);
  }

  return output.length > 0
    ? output
    : [...AGENT_GUARD_EXPORT_EVENT_TYPES];
}

export function destinationAllowsAutomaticExport(
  destination: Pick<
    AgentExportDestinationRecord,
    "status" | "automatic_delivery_enabled" | "event_types"
  >,
  eventType: AgentExportEventType
): boolean {
  return (
    destination.status === "enabled" &&
    destination.automatic_delivery_enabled === true &&
    normalizeAgentExportEventTypes(destination.event_types).includes(eventType)
  );
}

export function generateAgentExportSigningSecret(): string {
  return `${AGENT_GUARD_EXPORT_SECRET_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function hashAgentExportSigningSecret(secret: string): string {
  return createHash("sha256").update(secret.trim(), "utf8").digest("hex");
}

export function signingSecretHint(secret: string): string {
  const trimmed = secret.trim();
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 9)}...${trimmed.slice(-4)}`;
}

export function readAgentExportSecretKey(
  env: NodeJS.ProcessEnv = process.env
): string {
  const key = env[AGENT_GUARD_EXPORT_SECRET_KEY_ENV]?.trim();
  if (!key) {
    throw new Error(`${AGENT_GUARD_EXPORT_SECRET_KEY_ENV} is required`);
  }
  return key;
}

function derivedKey(rawKey: string): Buffer {
  return createHash("sha256")
    .update("shadowguard-agent-export-secret-key", "utf8")
    .update(rawKey, "utf8")
    .digest();
}

function encode(value: Buffer): string {
  return value.toString("base64url");
}

function decode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function encryptAgentExportSigningSecret(
  secret: string,
  rawKey = readAgentExportSecretKey()
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", derivedKey(rawKey), iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1:${encode(iv)}:${encode(tag)}:${encode(ciphertext)}`;
}

export function decryptAgentExportSigningSecret(
  encrypted: string,
  rawKey = readAgentExportSecretKey()
): string {
  const [version, encodedIv, encodedTag, encodedCiphertext] = encrypted.split(":");
  if (
    version !== "v1" ||
    !encodedIv ||
    !encodedTag ||
    !encodedCiphertext
  ) {
    throw new Error("Invalid AgentGuard export signing secret format");
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
