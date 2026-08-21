import { createHash, randomBytes } from "node:crypto";
export {
  AGENT_GUARD_SOURCE_ROTATION_DAYS,
  AGENT_GUARD_SOURCE_ROTATION_WARNING_DAYS,
  agentIngestSourceRotationPosture,
  type AgentIngestSourceRotationPosture,
  type AgentIngestSourceRotationStatus,
  type AgentIngestSourceRotationTone,
} from "./source-key-posture";

export const AGENT_GUARD_INGEST_TOKEN_PREFIX = "sgag_";

export type AgentIngestSourceEnvironment =
  | "production"
  | "staging"
  | "development"
  | "other";

export type AgentIngestSourceStatus = "active" | "revoked";

export type AgentIngestSourceRecord = {
  id: string;
  org_id: string;
  name: string;
  environment: AgentIngestSourceEnvironment;
  status: AgentIngestSourceStatus;
  allowed_tool_names: string[] | null;
};


export type AgentIngestSourceMetadata = {
  id: string;
  name: string;
  environment: AgentIngestSourceEnvironment;
};

export function generateAgentIngestToken(): string {
  return `${AGENT_GUARD_INGEST_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function hashAgentIngestToken(token: string): string {
  return createHash("sha256").update(token.trim(), "utf8").digest("hex");
}

export function tokenHint(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 9)}...${trimmed.slice(-4)}`;
}

export function parseBearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token && token.startsWith(AGENT_GUARD_INGEST_TOKEN_PREFIX)
    ? token
    : null;
}

export function normalizeAllowedToolNames(value: string[] = []): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of value) {
    const name = item.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    output.push(name);
  }

  return output;
}

export function sourceCanSubmitTool(
  allowedToolNames: string[] | null | undefined,
  toolName: string
): boolean {
  const allowed = normalizeAllowedToolNames(allowedToolNames ?? []);
  if (allowed.length === 0) return true;
  const normalizedTool = toolName.trim().toLowerCase();
  return allowed.some((name) => name.toLowerCase() === normalizedTool);
}

export function sourceAttributionMetadata(
  source: AgentIngestSourceMetadata
): Record<string, unknown> {
  return {
    agentGuardSource: {
      id: source.id,
      name: source.name,
      environment: source.environment,
      auth: "source_key",
    },
  };
}

export function mergeSourceMetadata(
  metadata: Record<string, unknown> | undefined,
  source: AgentIngestSourceMetadata
): Record<string, unknown> {
  return {
    ...(metadata ?? {}),
    ...sourceAttributionMetadata(source),
  };
}
