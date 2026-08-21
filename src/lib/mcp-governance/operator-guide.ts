export type MCPGuardGuideStep = {
  id: string;
  label: string;
  pageHref: string;
  pageLabel: string;
  goal: string;
  operatorAction: string;
  evidence: string;
  guardrail: string;
};

export type MCPGuardFieldGroup = {
  id: string;
  label: string;
  fields: string[];
  whenToUse: string;
};

export type MCPGuardTroubleshootingNote = {
  id: string;
  symptom: string;
  check: string;
  href: string;
  hrefLabel: string;
};

export const MCP_GUARD_OPERATOR_GUIDE_COPY = {
  title: "MCPGuard operating guide",
  overview:
    "Use MCPGuard to register MCP servers, score exposed tools, link those tools to accountable AI Systems, intake safe MCP activity events, and surface posture gaps in AgentGuard and governance reporting.",
  boundary:
    "MCPGuard is a governance and evidence workflow. It does not execute MCP tools, connect to MCP clients automatically, broker OAuth tokens, inspect raw files, store raw prompts or tool payloads, provide legal advice, certify compliance, or guarantee security outcomes.",
  safeEventRule:
    "For event intake, use safe samples or customer-approved metadata. Do not paste raw prompts, tool input, tool output, file content, database query results, credentials, tokens, or secrets.",
};

export const MCP_GUARD_GUIDE_SHORTCUTS = [
  {
    id: "inventory",
    href: "/dashboard/mcp-guard/servers",
    label: "Register servers",
    detail: "Start with the MCP servers that agents or assistants can reach.",
    cta: "Open servers",
  },
  {
    id: "tools",
    href: "/dashboard/mcp-guard/tools",
    label: "Score tools",
    detail: "Record each exposed tool, its capabilities, data sensitivity, access flags, owner, approval status, and AI System linkage.",
    cta: "Open tools",
  },
  {
    id: "events",
    href: "/dashboard/mcp-guard/events",
    label: "Intake events",
    detail: "Submit safe MCP activity events and confirm the synchronous AgentGuard policy decision.",
    cta: "Open events",
  },
];

export const MCP_GUARD_OPERATOR_STEPS: MCPGuardGuideStep[] = [
  {
    id: "server-inventory",
    label: "Create the server inventory",
    pageHref: "/dashboard/mcp-guard/servers",
    pageLabel: "MCP Servers",
    goal: "Create one row per MCP server, including transport, environment, owner, approval status, and optional AI System linkage.",
    operatorAction:
      "Add the server before adding tools. Use the URL, command, or host field as a locator, not as a place for credentials.",
    evidence:
      "Server Inventory shows the server, owner or unassigned state, transport, approval, status, and linked AI System.",
    guardrail:
      "Do not store MCP config files, auth tokens, API keys, environment files, or raw server payloads in the server description.",
  },
  {
    id: "tool-inventory",
    label: "Record exposed tools",
    pageHref: "/dashboard/mcp-guard/tools",
    pageLabel: "MCP Tools",
    goal: "Create one row per exposed MCP tool under the right server and let MCPGuard calculate deterministic risk.",
    operatorAction:
      "Set data sensitivity, capabilities, access flags, owner, approval status, and the linked AI System. Use the existing tool row if the tool name already exists under that server.",
    evidence:
      "Tool Inventory shows risk tier and score, capabilities, approval status, linked AI System, owner, and last activity.",
    guardrail:
      "Tool creation is an inventory action only. MCPGuard does not approve a tool by discovering it or by ingesting an event.",
  },
  {
    id: "ai-system-linkage",
    label: "Link tools to accountable AI Systems",
    pageHref: "/dashboard/mcp-guard/tools",
    pageLabel: "MCP Tools",
    goal: "Tie MCP tool exposure to the AI System that owns the workflow, vendor, use case, or agent behavior.",
    operatorAction:
      "Use the AI System dropdown on the tool row after creating the tool, or select the AI System during creation when it is already known.",
    evidence:
      "MCP Tool Inventory and Governance Report no longer show that tool as unlinked.",
    guardrail:
      "If ownership is unclear, leave the tool pending review and treat the missing AI System as a posture gap.",
  },
  {
    id: "event-intake",
    label: "Submit safe MCP activity events",
    pageHref: "/dashboard/mcp-guard/events",
    pageLabel: "Tool Events",
    goal: "Confirm that MCP activity can be evaluated and recorded without persisting raw content.",
    operatorAction:
      "Choose a known server and tool when testing known activity. For unknown activity, leave the dropdowns unknown and provide server/tool names as metadata.",
    evidence:
      "Event Log shows known or unknown status, user, client, decision, risk, stored payload lengths, and a recent timestamp.",
    guardrail:
      "Use safe test text only. The stored payload should show length counts, not raw input or output text.",
  },
  {
    id: "agentguard-visibility",
    label: "Confirm AgentGuard visibility",
    pageHref: "/dashboard/agent-guard/monitoring",
    pageLabel: "AgentGuard Monitoring",
    goal: "Verify MCP activity is visible in AgentGuard monitoring as part of the broader agent activity picture.",
    operatorAction:
      "After event intake, look for the matching `MCPGuard: <tool name>` activity row in AgentGuard Monitoring.",
    evidence:
      "Monitoring shows active tool rows, request count, unique users, last activity, and data-flow summary for the MCPGuard-prefixed tool.",
    guardrail:
      "AgentGuard visibility reflects submitted MCP events; it is not automatic monitoring of every MCP client or local desktop tool.",
  },
  {
    id: "governance-posture",
    label: "Review governance posture",
    pageHref: "/dashboard/governance-report",
    pageLabel: "Governance Report",
    goal: "Use reporting to find high-risk, blocked, pending-review, or unlinked MCP tools before expanding agent access.",
    operatorAction:
      "Review MCPGuard Posture and next actions after creating tools or ingesting events.",
    evidence:
      "Governance Report surfaces MCP tool counts and gaps that need owner review, approval, linkage, or remediation.",
    guardrail:
      "The report is operational evidence and readiness support. It is not legal advice, certification, or an auditor attestation.",
  },
];

export const MCP_GUARD_FIELD_GROUPS: MCPGuardFieldGroup[] = [
  {
    id: "server-fields",
    label: "Server fields",
    fields: [
      "Server name",
      "URL, command, or host",
      "Transport",
      "Environment",
      "Owner",
      "Owner email",
      "Department",
      "Initial approval",
      "Linked AI System",
      "Description",
    ],
    whenToUse:
      "Use these fields to identify where the MCP server lives, who owns it, and whether it is approved, blocked, or still pending review.",
  },
  {
    id: "tool-fields",
    label: "Tool fields",
    fields: [
      "MCP server",
      "Tool name",
      "Data sensitivity",
      "Linked AI System",
      "Owner",
      "Owner email",
      "Initial approval",
      "Description",
      "Capabilities",
      "Access flags",
    ],
    whenToUse:
      "Use these fields to drive the risk score and show whether the tool has accountability, approval, and a live activity trail.",
  },
  {
    id: "event-fields",
    label: "Event intake fields",
    fields: [
      "MCP server",
      "MCP tool",
      "Tool name",
      "User email",
      "Server name",
      "Client",
      "Activity type",
      "Resource label",
      "Input content sample",
      "Output content sample",
    ],
    whenToUse:
      "Use these fields to simulate or record safe MCP activity and receive an allow, warn, block, or quarantine decision.",
  },
];

export const MCP_GUARD_SAFE_EVENT_SAMPLE = {
  knownToolInput: "Read request for /docs/smoke-test.md. No secrets.",
  knownToolOutput: "Smoke output only. No raw customer content.",
  unknownToolInput: "Unknown tool activity sample. Metadata only.",
  resourceLabel: "smoke-readme-file",
};

export const MCP_GUARD_TROUBLESHOOTING: MCPGuardTroubleshootingNote[] = [
  {
    id: "duplicate-tool",
    symptom: "Creating a tool says it already exists.",
    check:
      "MCP tool names must be unique under the same MCP server. Use the existing Tool Inventory row or choose a different name.",
    href: "/dashboard/mcp-guard/tools",
    hrefLabel: "Open tools",
  },
  {
    id: "unknown-event",
    symptom: "An event shows as unknown.",
    check:
      "Confirm the event selected the registered server and tool. Unknown events are allowed for evidence, but they do not auto-create approved tool records.",
    href: "/dashboard/mcp-guard/events",
    hrefLabel: "Open events",
  },
  {
    id: "last-activity",
    symptom: "Last Activity did not update.",
    check:
      "Only known events linked to a registered MCP tool update the tool's last activity timestamp.",
    href: "/dashboard/mcp-guard/events",
    hrefLabel: "Open events",
  },
  {
    id: "agentguard-row",
    symptom: "AgentGuard Monitoring does not show MCP activity.",
    check:
      "Confirm event intake succeeded and then look for the `MCPGuard:` prefix in AgentGuard Monitoring.",
    href: "/dashboard/agent-guard/monitoring",
    hrefLabel: "Open monitoring",
  },
  {
    id: "governance-posture",
    symptom: "Governance Report is missing MCP posture.",
    check:
      "Confirm at least one MCP tool exists and refresh the Governance Report. High-risk, pending-review, blocked, or unlinked tools should surface as posture gaps.",
    href: "/dashboard/governance-report",
    hrefLabel: "Open report",
  },
];

export function mcpGuardOperatorGuideCounts() {
  return {
    shortcuts: MCP_GUARD_GUIDE_SHORTCUTS.length,
    steps: MCP_GUARD_OPERATOR_STEPS.length,
    fieldGroups: MCP_GUARD_FIELD_GROUPS.length,
    troubleshootingNotes: MCP_GUARD_TROUBLESHOOTING.length,
  };
}
