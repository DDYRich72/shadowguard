export type AgentGuardSdkExampleId =
  | "typescript-helper"
  | "python-requests"
  | "curl-smoke-test"
  | "ai-proxy-wrapper";

export type AgentGuardSdkExample = {
  id: AgentGuardSdkExampleId;
  label: string;
  runtime: string;
  summary: string;
  code: string;
};

export type AgentGuardSdkField = {
  name: string;
  required: boolean;
  description: string;
};

export const AGENT_GUARD_SDK_BOUNDARY =
  "These are copyable starter patterns for customer-controlled server-side integrations. They are not published SDK packages, browser collectors, hosted collectors, managed connectors, or automatic monitoring.";

export const AGENT_GUARD_SDK_ENV_VARS = [
  {
    name: "SHADOWGUARD_APP_URL",
    description:
      "Base URL for the ShadowGuard app that receives AgentGuard activity.",
  },
  {
    name: "AGENTGUARD_INGEST_TOKEN",
    description:
      "One-time source key stored as a server-side secret. Never place this value in browser code.",
  },
] as const;

export const AGENT_GUARD_SDK_REQUEST_FIELDS: AgentGuardSdkField[] = [
  {
    name: "toolName",
    required: true,
    description: "Human-readable AI tool name, such as ChatGPT or GitHub Copilot.",
  },
  {
    name: "userEmail",
    required: true,
    description: "The user associated with the submitted activity.",
  },
  {
    name: "activityType",
    required: true,
    description:
      "One of prompt_sent, response_received, file_upload, file_download, api_call, data_export, agent_action, or tool_invocation.",
  },
  {
    name: "content",
    required: false,
    description:
      "Activity text used for in-memory classification. ShadowGuard stores content length and classification metadata, not the raw text.",
  },
  {
    name: "metadata",
    required: false,
    description:
      "Non-content metadata such as requestId, workflow, toolId, department, or pilot group.",
  },
];

export const AGENT_GUARD_SDK_RESPONSE_FIELDS: AgentGuardSdkField[] = [
  {
    name: "id",
    required: false,
    description: "Accepted AgentGuard activity identifier.",
  },
  {
    name: "blocked",
    required: true,
    description: "Boolean decision returned by enabled block policies.",
  },
  {
    name: "reason",
    required: true,
    description: "Human-readable decision reason.",
  },
  {
    name: "riskLevel",
    required: true,
    description: "Risk level derived from deterministic classification and activity type.",
  },
  {
    name: "policyId",
    required: false,
    description: "Blocking policy id when a block policy matched.",
  },
  {
    name: "policyActions",
    required: false,
    description: "Matched policy action metadata for allow, warn, block, or quarantine workflows.",
  },
];

export const AGENT_GUARD_SDK_EXAMPLES: AgentGuardSdkExample[] = [
  {
    id: "typescript-helper",
    label: "TypeScript helper",
    runtime: "Node 18+",
    summary:
      "Drop this helper into a trusted backend service or internal package used by AI wrappers.",
    code: `type AgentGuardActivityType =
  | "prompt_sent"
  | "response_received"
  | "file_upload"
  | "file_download"
  | "api_call"
  | "data_export"
  | "agent_action"
  | "tool_invocation";

type AgentGuardDecision = {
  id?: string;
  blocked: boolean;
  reason: string;
  riskLevel: "none" | "low" | "medium" | "high" | "critical";
  policyId: string | null;
  policyActions?: Array<{
    policyId: string;
    policyName: string;
    action: "allow" | "warn" | "block" | "quarantine";
    priority: number;
  }>;
};

export async function submitAgentGuardActivity(input: {
  toolName: string;
  userEmail: string;
  activityType: AgentGuardActivityType;
  content?: string;
  metadata?: Record<string, unknown>;
}): Promise<AgentGuardDecision> {
  const baseUrl = process.env.SHADOWGUARD_APP_URL;
  const token = process.env.AGENTGUARD_INGEST_TOKEN;
  if (!baseUrl || !token) {
    throw new Error("Missing AgentGuard server-side environment variables.");
  }

  const response = await fetch(\`\${baseUrl}/api/agent-guard/activity\`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: \`Bearer \${token}\`,
    },
    body: JSON.stringify({
      toolName: input.toolName,
      userEmail: input.userEmail,
      activityType: input.activityType,
      content: input.content ?? "",
      metadata: input.metadata ?? {},
    }),
  });

  const decision = (await response.json()) as AgentGuardDecision;
  if (!response.ok) {
    throw new Error(decision.reason ?? "AgentGuard ingest request failed.");
  }
  return decision;
}`,
  },
  {
    id: "python-requests",
    label: "Python requests",
    runtime: "Python 3",
    summary:
      "Use this from a trusted Python service, API worker, or scheduled backend process.",
    code: `import os
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
    return response.json()


decision = submit_agentguard_activity(
    tool_name="ChatGPT",
    user_email="employee@company.com",
    activity_type="prompt_sent",
    content="Summarize this confidential customer support case.",
    metadata={"source": "python-wrapper", "requestId": "req_123"},
)

if decision.get("blocked"):
    raise RuntimeError(decision.get("reason", "AgentGuard policy blocked this activity."))`,
  },
  {
    id: "curl-smoke-test",
    label: "cURL smoke test",
    runtime: "Shell",
    summary:
      "Use this after creating a source key to confirm the bearer-token ingest path works.",
    code: `curl -sS -X POST "$SHADOWGUARD_APP_URL/api/agent-guard/activity" \\
  -H "content-type: application/json" \\
  -H "authorization: Bearer $AGENTGUARD_INGEST_TOKEN" \\
  --data '{
    "toolName": "ChatGPT",
    "userEmail": "employee@company.com",
    "activityType": "prompt_sent",
    "content": "Summarize this confidential customer support case.",
    "metadata": {
      "source": "curl-smoke-test",
      "requestId": "req_123"
    }
  }'`,
  },
  {
    id: "ai-proxy-wrapper",
    label: "AI proxy wrapper",
    runtime: "Server-side pattern",
    summary:
      "Wrap an internal AI call so AgentGuard can return a decision before the customer-controlled integration proceeds.",
    code: `import { submitAgentGuardActivity } from "./agentguard";

// submitAgentGuardActivity posts to /api/agent-guard/activity with the
// server-side AGENTGUARD_INGEST_TOKEN source key.

export async function runAiRequestWithAgentGuard(input: {
  toolName: string;
  userEmail: string;
  promptText: string;
  requestId: string;
  runAiTool: () => Promise<{ text: string }>;
}) {
  const promptDecision = await submitAgentGuardActivity({
    toolName: input.toolName,
    userEmail: input.userEmail,
    activityType: "prompt_sent",
    content: input.promptText,
    metadata: {
      source: "ai-proxy-wrapper",
      requestId: input.requestId,
      phase: "before-ai-call",
    },
  });

  if (promptDecision.blocked) {
    return {
      blocked: true,
      reason: promptDecision.reason,
      riskLevel: promptDecision.riskLevel,
    };
  }

  const aiResponse = await input.runAiTool();

  await submitAgentGuardActivity({
    toolName: input.toolName,
    userEmail: input.userEmail,
    activityType: "response_received",
    content: aiResponse.text,
    metadata: {
      source: "ai-proxy-wrapper",
      requestId: input.requestId,
      phase: "after-ai-call",
    },
  });

  return {
    blocked: false,
    response: aiResponse,
  };
}`,
  },
];

export function buildAgentGuardSdkReadmeText(): string {
  const envVars = AGENT_GUARD_SDK_ENV_VARS.map(
    (item) => `- ${item.name}: ${item.description}`
  ).join("\n");
  const requestFields = AGENT_GUARD_SDK_REQUEST_FIELDS.map(
    (field) =>
      `- ${field.name}${field.required ? " (required)" : " (optional)"}: ${field.description}`
  ).join("\n");
  const responseFields = AGENT_GUARD_SDK_RESPONSE_FIELDS.map(
    (field) =>
      `- ${field.name}${field.required ? " (expected)" : " (when present)"}: ${field.description}`
  ).join("\n");

  return [
    "# AgentGuard SDK Starter Kit",
    "",
    AGENT_GUARD_SDK_BOUNDARY,
    "",
    "## Server-side environment variables",
    envVars,
    "",
    "## Submit activity",
    "POST /api/agent-guard/activity with Authorization: Bearer <server-side source key>.",
    "",
    "## Request fields",
    requestFields,
    "",
    "## Decision response fields",
    responseFields,
    "",
    "## Implementation boundary",
    "Keep source keys in server-side secrets. Do not store them in browser code, local storage, frontend bundles, or customer-visible logs. AgentGuard returns a decision; customer-controlled wrappers decide how to honor that decision in their own tool flow.",
  ].join("\n");
}
