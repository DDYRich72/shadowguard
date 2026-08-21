import { LIMITS } from "@/lib/validate";
import {
  AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT,
  SHADOWGUARD_PRODUCTION_BASE_URL,
} from "./production-operations";

export const AGENT_GUARD_INTEGRATION_CONTRACT_VERSION =
  "agentguard.activity.v1";

export const AGENT_GUARD_INTEGRATION_ACTIVITY_TYPES = [
  "prompt_sent",
  "response_received",
  "file_upload",
  "file_download",
  "api_call",
  "data_export",
  "agent_action",
  "tool_invocation",
] as const;

export const AGENT_GUARD_INTEGRATION_RISK_LEVELS = [
  "none",
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type AgentGuardIntegrationContractField = {
  name: string;
  type: string;
  required: boolean;
  maxLength?: number;
  allowedValues?: readonly string[];
  description: string;
};

export type AgentGuardIntegrationContractError = {
  status: number;
  code: string;
  meaning: string;
  operatorAction: string;
};

export type AgentGuardIntegrationSamplePayload = {
  id: string;
  label: string;
  intent: string;
  payload: Record<string, unknown>;
};

export type AgentGuardIntegrationExample = {
  id: "curl" | "node-fetch" | "next-route-handler" | "python-requests";
  label: string;
  runtime: string;
  summary: string;
  code: string;
};

export type AgentGuardIntegrationContract = {
  title: string;
  version: typeof AGENT_GUARD_INTEGRATION_CONTRACT_VERSION;
  generatedAt: string;
  organizationName: string;
  endpoint: {
    method: "POST";
    url: string;
    path: string;
  };
  headers: AgentGuardIntegrationContractField[];
  requestFields: AgentGuardIntegrationContractField[];
  responseFields: AgentGuardIntegrationContractField[];
  errorCodes: AgentGuardIntegrationContractError[];
  samplePayloads: AgentGuardIntegrationSamplePayload[];
  examples: AgentGuardIntegrationExample[];
  boundary: string;
  contractMarkdown: string;
};

export const AGENT_GUARD_INTEGRATION_CONTRACT_COPY = {
  title: "AgentGuard enterprise integration contract",
  overview:
    "Versioned contract for customer-controlled server-side wrappers that submit activity to AgentGuard.",
  boundary:
    "This contract documents customer-controlled server-side activity submission. It is not a managed connector, browser collector, hosted collector, universal monitor, published SDK package, legal advice, certification, compliance determination, auditor attestation, security warranty, source-key recovery, secret vault, raw-content archive, or automatic enforcement.",
  noSecrets:
    "Use placeholders only. Do not paste source keys, signing secrets, private keys, raw prompts, responses, files, messages, real credentials, or customer data into implementation notes, tickets, or shared examples.",
} as const;

export const AGENT_GUARD_INTEGRATION_HEADERS: AgentGuardIntegrationContractField[] = [
  {
    name: "content-type",
    type: "HTTP header",
    required: true,
    description: "Must be application/json.",
  },
  {
    name: "authorization",
    type: "HTTP header",
    required: true,
    description:
      "Bearer source key stored only in a server-side secret such as AGENTGUARD_INGEST_TOKEN.",
  },
];

export const AGENT_GUARD_INTEGRATION_REQUEST_FIELDS: AgentGuardIntegrationContractField[] = [
  {
    name: "toolName",
    type: "string",
    required: true,
    maxLength: LIMITS.toolName,
    description:
      "Human-readable AI tool name. Use exact names when source scope is limited to specific tools.",
  },
  {
    name: "userEmail",
    type: "email string",
    required: true,
    maxLength: LIMITS.userEmail,
    description:
      "User associated with the submitted activity. The API normalizes valid email values.",
  },
  {
    name: "activityType",
    type: "enum",
    required: true,
    allowedValues: AGENT_GUARD_INTEGRATION_ACTIVITY_TYPES,
    description:
      "Activity category used for deterministic risk and policy evaluation.",
  },
  {
    name: "content",
    type: "string",
    required: false,
    maxLength: LIMITS.activityContent,
    description:
      "Optional text classified in memory. ShadowGuard stores content length and classification metadata, not raw content.",
  },
  {
    name: "metadata",
    type: "object",
    required: false,
    description:
      "Optional non-content metadata such as requestId, workflow, toolId, department, pilotGroup, or source system. Do not send raw content in metadata.",
  },
];

export const AGENT_GUARD_INTEGRATION_RESPONSE_FIELDS: AgentGuardIntegrationContractField[] = [
  {
    name: "id",
    type: "string",
    required: false,
    description: "Accepted AgentGuard activity identifier when the row is stored.",
  },
  {
    name: "blocked",
    type: "boolean",
    required: true,
    description:
      "Synchronous block decision from enabled block policies. Customer wrappers decide how to honor it.",
  },
  {
    name: "reason",
    type: "string",
    required: true,
    description: "Human-readable decision reason.",
  },
  {
    name: "riskLevel",
    type: "enum",
    required: true,
    allowedValues: AGENT_GUARD_INTEGRATION_RISK_LEVELS,
    description: "Deterministic risk level from classification and activity type.",
  },
  {
    name: "policyId",
    type: "string | null",
    required: false,
    description: "Blocking policy identifier when a block policy matched.",
  },
  {
    name: "policyActions",
    type: "array",
    required: false,
    description:
      "Matched policy action metadata for allow, warn, block, or quarantine workflows.",
  },
];

export const AGENT_GUARD_INTEGRATION_ERROR_CODES: AgentGuardIntegrationContractError[] = [
  {
    status: 400,
    code: "invalid_json",
    meaning: "The request body was not valid JSON.",
    operatorAction: "Send application/json and valid JSON syntax.",
  },
  {
    status: 400,
    code: "validation_failed",
    meaning:
      "A required field is missing, an enum value is unsupported, or a string exceeds limits.",
    operatorAction: "Check toolName, userEmail, activityType, content length, and metadata shape.",
  },
  {
    status: 401,
    code: "invalid_ingest_token",
    meaning: "The bearer source key is missing, malformed, unknown, or revoked.",
    operatorAction:
      "Confirm the server-side AGENTGUARD_INGEST_TOKEN value and source status.",
  },
  {
    status: 401,
    code: "unauthorized",
    meaning:
      "Dashboard-session submission was attempted without a valid signed-in session.",
    operatorAction:
      "For customer wrappers, use Authorization: Bearer <source-key> from a trusted backend.",
  },
  {
    status: 403,
    code: "tool_not_allowed_for_source",
    meaning: "The source key is scoped to different AI tool names.",
    operatorAction:
      "Update the source allowed-tool scope or submit the exact expected tool name.",
  },
  {
    status: 429,
    code: "rate_limited",
    meaning: "The source or organization exceeded the ingest rate limit.",
    operatorAction:
      "Back off and retry after the retry_after_seconds value or Retry-After header.",
  },
];

export const AGENT_GUARD_INTEGRATION_SAMPLE_PAYLOADS: AgentGuardIntegrationSamplePayload[] = [
  {
    id: "baseline",
    label: "Baseline safe activity",
    intent: "Proves the bearer source-key path and source attribution.",
    payload: {
      toolName: "ChatGPT",
      userEmail: "employee@example.com",
      activityType: "prompt_sent",
      content: "Summarize this approved internal FAQ for a customer support reply.",
      metadata: {
        source: "server-side-wrapper",
        requestId: "req_demo_baseline",
        workflow: "support_summary",
      },
    },
  },
  {
    id: "metadata-only",
    label: "Metadata-only activity",
    intent: "Records an event when content is not available to the wrapper.",
    payload: {
      toolName: "GitHub Copilot",
      userEmail: "engineer@example.com",
      activityType: "tool_invocation",
      metadata: {
        source: "server-side-wrapper",
        requestId: "req_demo_metadata",
        repository: "internal-service",
      },
    },
  },
  {
    id: "pii-like-review",
    label: "PII-like review training event",
    intent:
      "Exercises policy/review behavior with non-customer sample data and no real protected information.",
    payload: {
      toolName: "ChatGPT",
      userEmail: "analyst@example.com",
      activityType: "prompt_sent",
      content:
        "Review a sample customer record for Jane Example at jane@example.com. This is training data only.",
      metadata: {
        source: "server-side-wrapper",
        requestId: "req_demo_pii_review",
        dataset: "training-sample",
      },
    },
  },
  {
    id: "credential-block-training",
    label: "Credential block training event",
    intent:
      "Exercises critical-risk policy behavior with a fake placeholder token, never a real secret.",
    payload: {
      toolName: "Unknown AI Assistant",
      userEmail: "ops@example.com",
      activityType: "prompt_sent",
      content: "api_key = demo-key-do-not-use",
      metadata: {
        source: "server-side-wrapper",
        requestId: "req_demo_credential_training",
        dataset: "training-sample",
      },
    },
  },
];

export const AGENT_GUARD_INTEGRATION_EXAMPLES: AgentGuardIntegrationExample[] = [
  {
    id: "curl",
    label: "cURL",
    runtime: "Shell",
    summary: "Smoke test from a trusted terminal with server-side environment variables.",
    code: String.raw`curl -sS -X POST "$SHADOWGUARD_APP_URL/api/agent-guard/activity" \
  -H "content-type: application/json" \
  -H "authorization: Bearer $AGENTGUARD_INGEST_TOKEN" \
  --data '{
    "toolName": "ChatGPT",
    "userEmail": "employee@example.com",
    "activityType": "prompt_sent",
    "content": "Summarize this approved internal FAQ for a customer support reply.",
    "metadata": {
      "source": "server-side-wrapper",
      "requestId": "req_demo_baseline"
    }
  }'`,
  },
  {
    id: "node-fetch",
    label: "Node fetch",
    runtime: "Node 18+",
    summary: "Reusable server-side submission helper for a customer-owned wrapper.",
    code: String.raw`type AgentGuardActivityType =
  | "prompt_sent"
  | "response_received"
  | "file_upload"
  | "file_download"
  | "api_call"
  | "data_export"
  | "agent_action"
  | "tool_invocation";

export async function submitAgentGuardActivity(input: {
  toolName: string;
  userEmail: string;
  activityType: AgentGuardActivityType;
  content?: string;
  metadata?: Record<string, unknown>;
}) {
  const baseUrl = process.env.SHADOWGUARD_APP_URL;
  const token = process.env.AGENTGUARD_INGEST_TOKEN;
  if (!baseUrl || !token) {
    throw new Error("Missing AgentGuard server-side environment variables.");
  }

  const endpoint = baseUrl.replace(/\/+$/, "") + "/api/agent-guard/activity";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + token,
    },
    body: JSON.stringify(input),
  });

  const decision = await response.json();
  if (!response.ok) {
    throw new Error(decision.reason ?? decision.message ?? decision.error);
  }
  return decision;
}`,
  },
  {
    id: "next-route-handler",
    label: "Next.js Route Handler proxy",
    runtime: "Next.js server",
    summary: "Server-side proxy pattern for a customer-controlled app route.",
    code: String.raw`import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const response = await fetch(
    (process.env.SHADOWGUARD_APP_URL ?? "").replace(/\/+$/, "") +
      "/api/agent-guard/activity",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + process.env.AGENTGUARD_INGEST_TOKEN,
      },
      body: JSON.stringify({
        toolName: body.toolName,
        userEmail: body.userEmail,
        activityType: body.activityType,
        content: body.content ?? "",
        metadata: {
          source: "customer-next-route",
          requestId: body.requestId,
        },
      }),
    }
  );

  const decision = await response.json();
  if (decision.blocked) {
    return NextResponse.json(decision, { status: 403 });
  }
  return NextResponse.json(decision, { status: response.status });
}`,
  },
  {
    id: "python-requests",
    label: "Python requests",
    runtime: "Python 3",
    summary: "Server-side submission helper for a Python service or worker.",
    code: String.raw`import os
import requests


def submit_agentguard_activity(tool_name, user_email, activity_type, content="", metadata=None):
    base_url = os.environ["SHADOWGUARD_APP_URL"].rstrip("/")
    token = os.environ["AGENTGUARD_INGEST_TOKEN"]
    response = requests.post(
        f"{base_url}/api/agent-guard/activity",
        headers={
            "content-type": "application/json",
            "authorization": f"Bearer {token}",
        },
        json={
            "toolName": tool_name,
            "userEmail": user_email,
            "activityType": activity_type,
            "content": content,
            "metadata": metadata or {},
        },
        timeout=10,
    )
    response.raise_for_status()
    return response.json()`,
  },
];

const RESERVED_METADATA_KEYS = [
  "content",
  "prompt",
  "text",
  "message",
  "body",
  "raw",
  "payload",
] as const;

function oneLine(value: string | null | undefined, fallback: string): string {
  const normalized = value?.replace(/[\r\n\t]+/g, " ").trim();
  return normalized ? normalized.slice(0, 160) : fallback;
}

function normalizeBaseUrl(value: string | null | undefined): string {
  const normalized = oneLine(value, SHADOWGUARD_PRODUCTION_BASE_URL).replace(/\/+$/g, "");
  if (!/^https?:\/\//.test(normalized)) return SHADOWGUARD_PRODUCTION_BASE_URL;
  return normalized;
}

function bulletItems(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function fieldRows(fields: readonly AgentGuardIntegrationContractField[]): string {
  return fields
    .map((field) => {
      const required = field.required ? "required" : "optional";
      const allowedValues = field.allowedValues?.length
        ? ` Allowed values: ${field.allowedValues.join(", ")}.`
        : "";
      const maxLength = field.maxLength ? ` Max length: ${field.maxLength}.` : "";
      return `- ${field.name} (${required}, ${field.type}): ${field.description}${maxLength}${allowedValues}`;
    })
    .join("\n");
}

function sampleRows(samples: readonly AgentGuardIntegrationSamplePayload[]): string {
  return samples
    .map((sample) =>
      [
        `### ${sample.label}`,
        "",
        sample.intent,
        "",
        "```json",
        JSON.stringify(sample.payload, null, 2),
        "```",
      ].join("\n")
    )
    .join("\n\n");
}

function exampleRows(examples: readonly AgentGuardIntegrationExample[]): string {
  return examples
    .map((example) =>
      [
        `### ${example.label}`,
        "",
        `${example.runtime}: ${example.summary}`,
        "",
        "```ts",
        example.code,
        "```",
      ].join("\n")
    )
    .join("\n\n");
}

function errorRows(errors: readonly AgentGuardIntegrationContractError[]): string {
  return errors
    .map(
      (error) =>
        `- ${error.status} ${error.code}: ${error.meaning} Action: ${error.operatorAction}`
    )
    .join("\n");
}

function contractToMarkdown(input: Omit<AgentGuardIntegrationContract, "contractMarkdown">) {
  return [
    `# ${input.title}`,
    "",
    `Version: ${input.version}`,
    `Generated: ${input.generatedAt}`,
    `Organization: ${input.organizationName}`,
    "",
    AGENT_GUARD_INTEGRATION_CONTRACT_COPY.overview,
    "",
    `Boundary: ${input.boundary}`,
    "",
    `Secret handling: ${AGENT_GUARD_INTEGRATION_CONTRACT_COPY.noSecrets}`,
    "",
    "## Endpoint",
    "",
    `${input.endpoint.method} ${input.endpoint.url}`,
    "",
    "## Required headers",
    "",
    fieldRows(input.headers),
    "",
    "## Request fields",
    "",
    fieldRows(input.requestFields),
    "",
    "## Response fields",
    "",
    fieldRows(input.responseFields),
    "",
    "## Metadata guardrails",
    "",
    bulletItems([
      "Keep source keys in server-side secrets only.",
      "Use metadata for routing and correlation fields, not raw prompt or response content.",
      `Reserved raw-content-like metadata keys are sanitized when present: ${RESERVED_METADATA_KEYS.join(", ")}.`,
      "The customer-controlled wrapper decides how to honor allow, warn, block, or quarantine outcomes.",
    ]),
    "",
    "## Error codes",
    "",
    errorRows(input.errorCodes),
    "",
    "## Safe sample payloads",
    "",
    sampleRows(input.samplePayloads),
    "",
    "## Server-side examples",
    "",
    exampleRows(input.examples),
    "",
    "## Exclusions",
    "",
    bulletItems([
      "No managed connector, hosted collector, browser collector, universal monitor, published SDK package, source-key recovery, secret vault, or raw-content archive is included.",
      "No automatic source creation, policy change, review mutation, export change, evidence save, acknowledgement creation, source promotion, or enforcement change is performed by this contract.",
      "This contract supports implementation and evidence conversations; it does not provide legal advice, certification, compliance determination, auditor attestation, or security warranty.",
    ]),
  ].join("\n");
}

export function buildAgentGuardIntegrationContract(input: {
  generatedAt?: string;
  organizationName?: string | null;
  baseUrl?: string | null;
} = {}): AgentGuardIntegrationContract {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const organizationName = oneLine(input.organizationName, "Current organization");
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const endpoint = {
    method: "POST" as const,
    url: `${baseUrl}${AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.path}`,
    path: AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.path,
  };
  const contractWithoutMarkdown = {
    title: AGENT_GUARD_INTEGRATION_CONTRACT_COPY.title,
    version: AGENT_GUARD_INTEGRATION_CONTRACT_VERSION,
    generatedAt,
    organizationName,
    endpoint,
    headers: AGENT_GUARD_INTEGRATION_HEADERS,
    requestFields: AGENT_GUARD_INTEGRATION_REQUEST_FIELDS,
    responseFields: AGENT_GUARD_INTEGRATION_RESPONSE_FIELDS,
    errorCodes: AGENT_GUARD_INTEGRATION_ERROR_CODES,
    samplePayloads: AGENT_GUARD_INTEGRATION_SAMPLE_PAYLOADS,
    examples: AGENT_GUARD_INTEGRATION_EXAMPLES,
    boundary: AGENT_GUARD_INTEGRATION_CONTRACT_COPY.boundary,
  } satisfies Omit<AgentGuardIntegrationContract, "contractMarkdown">;

  return {
    ...contractWithoutMarkdown,
    contractMarkdown: contractToMarkdown(contractWithoutMarkdown),
  };
}
