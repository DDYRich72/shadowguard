export type AgentGuardIntegrationExampleId =
  | "generic-fetch"
  | "next-route-handler"
  | "express-wrapper";

export type AgentGuardSourceStatus = "active" | "revoked";

export type AgentGuardSourceHealthId =
  | "working"
  | "never_used"
  | "revoked"
  | "test_failed";

export type AgentGuardTestResultStatus = "accepted" | "blocked" | "failed";

export type AgentGuardSourceForKit = {
  id: string;
  status: AgentGuardSourceStatus;
  lastUsedAt: string | null;
  allowedToolNames?: string[];
};

export type AgentGuardTestResultForKit = {
  status: AgentGuardTestResultStatus;
  sourceId?: string | null;
};

export type AgentGuardChecklistInput = {
  sources: AgentGuardSourceForKit[];
  hasVisibleSourceKey: boolean;
  testResult?: AgentGuardTestResultForKit | null;
};

export type AgentGuardChecklistItem = {
  id:
    | "create-source"
    | "store-key"
    | "send-test"
    | "review-health"
    | "tighten-scope";
  label: string;
  description: string;
};

export type AgentGuardChecklistState = AgentGuardChecklistItem & {
  completed: boolean;
};

export type AgentGuardSourceHealth = {
  id: AgentGuardSourceHealthId;
  label: string;
  tone: "green" | "amber" | "red" | "slate";
  description: string;
};

export type AgentGuardIntegrationExample = {
  id: AgentGuardIntegrationExampleId;
  label: string;
  description: string;
  code: string;
};

export const AGENT_GUARD_FIRST_SOURCE_CHECKLIST: AgentGuardChecklistItem[] = [
  {
    id: "create-source",
    label: "Create a scoped source",
    description: "Name the trusted server, wrapper, or internal service that will submit activity.",
  },
  {
    id: "store-key",
    label: "Store the key server-side",
    description: "Place the one-time source key in a server-side secret or environment variable.",
  },
  {
    id: "send-test",
    label: "Send a test event",
    description: "Use the dashboard test button or a server request to confirm the bearer path works.",
  },
  {
    id: "review-health",
    label: "Review source health",
    description: "Confirm the source moves from never used to working after a successful test.",
  },
  {
    id: "tighten-scope",
    label: "Tighten allowed tools",
    description: "Limit the source to known tool names when the integration only submits specific AI tools.",
  },
];

export const AGENT_GUARD_INTEGRATION_EXAMPLES: AgentGuardIntegrationExample[] = [
  {
    id: "generic-fetch",
    label: "Generic server fetch",
    description: "Use this from a trusted backend job, service, or wrapper before activity leaves your server.",
    code: `const response = await fetch(\`\${process.env.SHADOWGUARD_APP_URL}/api/agent-guard/activity\`, {
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
});

const decision = await response.json();
if (decision.blocked) {
  throw new Error(decision.reason ?? "AgentGuard policy blocked this activity.");
}`,
  },
  {
    id: "next-route-handler",
    label: "Next.js route handler",
    description: "Proxy customer-side app activity through your own server route so the source key stays private.",
    code: `import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { promptText, userEmail } = await request.json();

  const response = await fetch(\`\${process.env.SHADOWGUARD_APP_URL}/api/agent-guard/activity\`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: \`Bearer \${process.env.AGENTGUARD_INGEST_TOKEN}\`,
    },
    body: JSON.stringify({
      toolName: "ChatGPT",
      userEmail,
      activityType: "prompt_sent",
      content: promptText,
      metadata: {
        source: "nextjs-api-wrapper",
      },
    }),
  });

  const decision = await response.json();
  return NextResponse.json(decision, { status: response.status });
}`,
  },
  {
    id: "express-wrapper",
    label: "Express wrapper",
    description: "Use this pattern when an existing Node service mediates AI tool requests.",
    code: `app.post("/internal/agentguard/check", async (req, res) => {
  const response = await fetch(\`\${process.env.SHADOWGUARD_APP_URL}/api/agent-guard/activity\`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: \`Bearer \${process.env.AGENTGUARD_INGEST_TOKEN}\`,
    },
    body: JSON.stringify({
      toolName: req.body.toolName,
      userEmail: req.body.userEmail,
      activityType: req.body.activityType ?? "prompt_sent",
      content: req.body.content ?? "",
      metadata: {
        source: "express-wrapper",
        requestId: req.id,
      },
    }),
  });

  const decision = await response.json();
  res.status(response.status).json(decision);
});`,
  },
];

export function deriveAgentGuardChecklistState(
  input: AgentGuardChecklistInput
): AgentGuardChecklistState[] {
  const hasSource = input.sources.length > 0;
  const hasWorkingSource = input.sources.some(
    (source) => source.status === "active" && Boolean(source.lastUsedAt)
  );
  const hasCompletedTest =
    input.testResult?.status === "accepted" ||
    input.testResult?.status === "blocked" ||
    hasWorkingSource;
  const hasScopedSource = input.sources.some(
    (source) =>
      source.status === "active" && (source.allowedToolNames?.length ?? 0) > 0
  );

  return AGENT_GUARD_FIRST_SOURCE_CHECKLIST.map((item) => {
    let completed = false;
    if (item.id === "create-source") completed = hasSource;
    if (item.id === "store-key") completed = input.hasVisibleSourceKey || hasSource;
    if (item.id === "send-test") completed = hasCompletedTest;
    if (item.id === "review-health") completed = hasWorkingSource;
    if (item.id === "tighten-scope") completed = hasScopedSource;
    return { ...item, completed };
  });
}

export function agentGuardSourceHealth(
  source: AgentGuardSourceForKit,
  latestTestResult?: AgentGuardTestResultForKit | null
): AgentGuardSourceHealth {
  if (source.status === "revoked") {
    return {
      id: "revoked",
      label: "Revoked",
      tone: "slate",
      description: "This source stays visible for history, but it cannot submit new activity.",
    };
  }

  if (
    latestTestResult?.status === "failed" &&
    latestTestResult.sourceId === source.id
  ) {
    return {
      id: "test_failed",
      label: "Test Failed",
      tone: "red",
      description: "The latest dashboard test for this source did not reach ingest successfully.",
    };
  }

  if (source.lastUsedAt) {
    return {
      id: "working",
      label: "Working",
      tone: "green",
      description: "AgentGuard has accepted submitted activity from this source.",
    };
  }

  return {
    id: "never_used",
    label: "Never Used",
    tone: "amber",
    description: "The source exists, but no activity has been accepted from it yet.",
  };
}
