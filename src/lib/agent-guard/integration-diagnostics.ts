import { AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT } from "./production-operations";

export type AgentGuardIntegrationDiagnosticFailure = {
  id:
    | "invalid-json"
    | "validation-failed"
    | "invalid-ingest-token"
    | "tool-not-allowed"
    | "rate-limited";
  status: number;
  code: string;
  label: string;
  signal: string;
  likelyCause: string;
  checkNext: readonly string[];
};

export type AgentGuardIntegrationDiagnosticCheck = {
  id:
    | "source-active"
    | "server-side-secret"
    | "tool-scope-match"
    | "safe-test-event"
    | "monitoring-visible"
    | "policy-outcome";
  label: string;
  detail: string;
  href: string;
  cta: string;
};

export type AgentGuardIntegrationDiagnosticCommand = {
  id: "powershell" | "curl" | "node-fetch" | "python-requests";
  label: string;
  runtime: string;
  summary: string;
  code: string;
};

export type AgentGuardIntegrationDiagnostics = {
  title: string;
  overview: string;
  endpoint: typeof AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT;
  failures: readonly AgentGuardIntegrationDiagnosticFailure[];
  checks: readonly AgentGuardIntegrationDiagnosticCheck[];
  commands: readonly AgentGuardIntegrationDiagnosticCommand[];
  boundary: string;
  diagnosticsText: string;
};

export const AGENT_GUARD_INTEGRATION_DIAGNOSTICS_COPY = {
  title: "AgentGuard integration diagnostics",
  overview:
    "Deterministic troubleshooting for customer-controlled server-side wrappers calling the AgentGuard activity endpoint.",
  boundary:
    "Diagnostics are implementation support only. They do not create source keys, recover source keys, store secrets, store raw prompts, change policies, mutate reviews, change export settings, save evidence, create acknowledgements, provide legal advice, certify compliance, attest security, deliver managed connectors, perform automatic monitoring, or enforce policy by themselves.",
} as const;

export const AGENT_GUARD_INTEGRATION_DIAGNOSTIC_FAILURES: readonly AgentGuardIntegrationDiagnosticFailure[] = [
  {
    id: "invalid-json",
    status: 400,
    code: "invalid_json",
    label: "Invalid JSON",
    signal: "The request body could not be parsed as JSON.",
    likelyCause:
      "The wrapper sent malformed JSON, omitted the body, or used a shell quoting pattern that broke the payload.",
    checkNext: [
      "Confirm the request sends content-type: application/json.",
      "Run the copyable PowerShell or cURL diagnostic command from a trusted terminal.",
      "Check that the JSON body starts with an object containing toolName, userEmail, and activityType.",
    ],
  },
  {
    id: "validation-failed",
    status: 400,
    code: "validation_failed",
    label: "Validation failed",
    signal:
      "A required field is missing, a field exceeds limits, or activityType is not supported.",
    likelyCause:
      "The wrapper sent a misspelled field, empty toolName, invalid email, unsupported activityType, oversized content, or non-object metadata.",
    checkNext: [
      "Compare the payload against the current integration contract request fields.",
      "Use one of the supported activityType values from the contract.",
      "Keep metadata as non-content JSON fields and keep raw content only in the optional content field.",
    ],
  },
  {
    id: "invalid-ingest-token",
    status: 401,
    code: "invalid_ingest_token",
    label: "Invalid source key",
    signal:
      "The Authorization bearer value is missing, malformed, unknown, or belongs to a revoked source.",
    likelyCause:
      "The wrapper is missing AGENTGUARD_INGEST_TOKEN, copied the key incorrectly, used an old revoked key, or sent the token without the Bearer prefix.",
    checkNext: [
      "Confirm the source exists and is active on the Ingestion page.",
      "Confirm the secret is stored server-side as AGENTGUARD_INGEST_TOKEN.",
      "Confirm the Authorization header is exactly Authorization: Bearer <source-key>.",
    ],
  },
  {
    id: "tool-not-allowed",
    status: 403,
    code: "tool_not_allowed_for_source",
    label: "Tool scope mismatch",
    signal:
      "The source key is active but scoped to different AI tool names.",
    likelyCause:
      "The submitted toolName does not exactly match the source allowed-tool scope.",
    checkNext: [
      "Open the source row on the Ingestion page and compare its allowed tool names.",
      "Submit the exact expected toolName including spaces and capitalization.",
      "Create a replacement source with the intended allowed-tool scope when the wrapper legitimately needs broader coverage.",
    ],
  },
  {
    id: "rate-limited",
    status: 429,
    code: "rate_limited",
    label: "Rate limited",
    signal:
      "The source or organization sent too many requests during the current rate-limit window.",
    likelyCause:
      "A test loop, retry loop, or busy wrapper is submitting faster than the current ingest allowance.",
    checkNext: [
      "Back off and retry after the Retry-After header or retry_after_seconds response value.",
      "Disable accidental loops before resuming tests.",
      "Use one safe diagnostic event before broadening the pilot traffic pattern.",
    ],
  },
];

export const AGENT_GUARD_INTEGRATION_DIAGNOSTIC_CHECKS: readonly AgentGuardIntegrationDiagnosticCheck[] = [
  {
    id: "source-active",
    label: "Confirm active source",
    detail:
      "A source key must exist, be active, and belong to the organization whose wrapper is submitting activity.",
    href: "/dashboard/agent-guard/ingestion",
    cta: "Open ingestion",
  },
  {
    id: "server-side-secret",
    label: "Confirm server-side secret",
    detail:
      "The source key must be stored in a trusted backend secret such as AGENTGUARD_INGEST_TOKEN, not browser code or support notes.",
    href: "/dashboard/agent-guard/guide",
    cta: "Open guide",
  },
  {
    id: "tool-scope-match",
    label: "Confirm exact tool scope",
    detail:
      "If the source is scoped, the submitted toolName must exactly match one of the allowed tool names.",
    href: "/dashboard/agent-guard/ingestion",
    cta: "Review source",
  },
  {
    id: "safe-test-event",
    label: "Send one safe test event",
    detail:
      "Use a placeholder-only diagnostic command or the dashboard test-event button before sending pilot traffic.",
    href: "/dashboard/agent-guard/ingestion",
    cta: "Send test",
  },
  {
    id: "monitoring-visible",
    label: "Confirm Monitoring shows activity",
    detail:
      "After a successful event, Monitoring should show the submitted tool, user count, request count, risk, and data-flow summary.",
    href: "/dashboard/agent-guard/monitoring",
    cta: "Open monitoring",
  },
  {
    id: "policy-outcome",
    label: "Confirm policy outcome when expected",
    detail:
      "If warn, quarantine, or block behavior is expected, confirm enabled policies and review queue rows match the test event.",
    href: "/dashboard/agent-guard/policies",
    cta: "Review policies",
  },
];

export const AGENT_GUARD_INTEGRATION_DIAGNOSTIC_COMMANDS: readonly AgentGuardIntegrationDiagnosticCommand[] = [
  {
    id: "powershell",
    label: "PowerShell",
    runtime: "Windows PowerShell 7+",
    summary:
      "Trusted-terminal diagnostic for Windows operators using server-side environment variables.",
    code: String.raw`$body = @{
  toolName = "ChatGPT"
  userEmail = "employee@example.com"
  activityType = "prompt_sent"
  content = "Safe AgentGuard diagnostic event. No sensitive data."
  metadata = @{
    source = "server-side-wrapper"
    requestId = "diag-001"
  }
} | ConvertTo-Json -Depth 5

$headers = @{
  "content-type" = "application/json"
  "authorization" = "Bearer $env:AGENTGUARD_INGEST_TOKEN"
}

Invoke-RestMethod -Method Post -Uri "$($env:SHADOWGUARD_APP_URL.TrimEnd('/'))/api/agent-guard/activity" -Headers $headers -Body $body`,
  },
  {
    id: "curl",
    label: "cURL",
    runtime: "Shell",
    summary:
      "Trusted-terminal smoke test for macOS, Linux, WSL, or any shell with cURL.",
    code: String.raw`curl -sS -X POST "$SHADOWGUARD_APP_URL/api/agent-guard/activity" \
  -H "content-type: application/json" \
  -H "authorization: Bearer $AGENTGUARD_INGEST_TOKEN" \
  --data '{
    "toolName": "ChatGPT",
    "userEmail": "employee@example.com",
    "activityType": "prompt_sent",
    "content": "Safe AgentGuard diagnostic event. No sensitive data.",
    "metadata": {
      "source": "server-side-wrapper",
      "requestId": "diag-001"
    }
  }'`,
  },
  {
    id: "node-fetch",
    label: "Node fetch",
    runtime: "Node 18+",
    summary:
      "Server-side diagnostic helper with response body logging for customer-owned wrappers.",
    code: String.raw`const baseUrl = (process.env.SHADOWGUARD_APP_URL ?? "").replace(/\/+$/, "");
const token = process.env.AGENTGUARD_INGEST_TOKEN;

if (!baseUrl || !token) {
  throw new Error("Missing SHADOWGUARD_APP_URL or AGENTGUARD_INGEST_TOKEN.");
}

const response = await fetch(baseUrl + "/api/agent-guard/activity", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: "Bearer " + token,
  },
  body: JSON.stringify({
    toolName: "ChatGPT",
    userEmail: "employee@example.com",
    activityType: "prompt_sent",
    content: "Safe AgentGuard diagnostic event. No sensitive data.",
    metadata: {
      source: "server-side-wrapper",
      requestId: "diag-001",
    },
  }),
});

console.log(response.status, await response.json());`,
  },
  {
    id: "python-requests",
    label: "Python requests",
    runtime: "Python 3",
    summary:
      "Server-side diagnostic helper for Python services with status and JSON output.",
    code: String.raw`import os
import requests


base_url = os.environ["SHADOWGUARD_APP_URL"].rstrip("/")
token = os.environ["AGENTGUARD_INGEST_TOKEN"]

response = requests.post(
    f"{base_url}/api/agent-guard/activity",
    headers={
        "content-type": "application/json",
        "authorization": f"Bearer {token}",
    },
    json={
        "toolName": "ChatGPT",
        "userEmail": "employee@example.com",
        "activityType": "prompt_sent",
        "content": "Safe AgentGuard diagnostic event. No sensitive data.",
        "metadata": {
            "source": "server-side-wrapper",
            "requestId": "diag-001",
        },
    },
    timeout=10,
)

print(response.status_code, response.json())`,
  },
];

function bulletItems(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function failureLines(failures: readonly AgentGuardIntegrationDiagnosticFailure[]): string {
  return failures
    .map((failure) =>
      [
        `### ${failure.status} ${failure.code} - ${failure.label}`,
        "",
        `Signal: ${failure.signal}`,
        `Likely cause: ${failure.likelyCause}`,
        "",
        "Check next:",
        bulletItems(failure.checkNext),
      ].join("\n")
    )
    .join("\n\n");
}

function checkLines(checks: readonly AgentGuardIntegrationDiagnosticCheck[]): string {
  return checks
    .map((check) => `- ${check.label}: ${check.detail} (${check.href})`)
    .join("\n");
}

function commandLines(commands: readonly AgentGuardIntegrationDiagnosticCommand[]): string {
  return commands
    .map((command) =>
      [
        `### ${command.label}`,
        "",
        `${command.runtime}: ${command.summary}`,
        "",
        "```text",
        command.code,
        "```",
      ].join("\n")
    )
    .join("\n\n");
}

export function buildAgentGuardIntegrationDiagnostics(): AgentGuardIntegrationDiagnostics {
  const diagnosticsWithoutText = {
    title: AGENT_GUARD_INTEGRATION_DIAGNOSTICS_COPY.title,
    overview: AGENT_GUARD_INTEGRATION_DIAGNOSTICS_COPY.overview,
    endpoint: AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT,
    failures: AGENT_GUARD_INTEGRATION_DIAGNOSTIC_FAILURES,
    checks: AGENT_GUARD_INTEGRATION_DIAGNOSTIC_CHECKS,
    commands: AGENT_GUARD_INTEGRATION_DIAGNOSTIC_COMMANDS,
    boundary: AGENT_GUARD_INTEGRATION_DIAGNOSTICS_COPY.boundary,
  };

  const diagnosticsText = [
    `# ${diagnosticsWithoutText.title}`,
    "",
    diagnosticsWithoutText.overview,
    "",
    `Endpoint: ${diagnosticsWithoutText.endpoint.method} ${diagnosticsWithoutText.endpoint.url}`,
    "",
    `Boundary: ${diagnosticsWithoutText.boundary}`,
    "",
    "## Failure diagnostics",
    "",
    failureLines(diagnosticsWithoutText.failures),
    "",
    "## Operator next checks",
    "",
    checkLines(diagnosticsWithoutText.checks),
    "",
    "## Copyable diagnostic commands",
    "",
    commandLines(diagnosticsWithoutText.commands),
  ].join("\n");

  return {
    ...diagnosticsWithoutText,
    diagnosticsText,
  };
}
