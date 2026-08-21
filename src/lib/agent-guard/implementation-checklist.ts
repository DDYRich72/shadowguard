import {
  AGENT_GUARD_OPERATOR_GUIDE_PHASES,
  AGENT_GUARD_OPERATOR_GUIDE_TROUBLESHOOTING,
} from "./operator-guide";
import { AGENT_GUARD_RECEIVER_CHECKLIST } from "./receiver-kit";
import { SHADOWGUARD_PRODUCTION_BASE_URL } from "./production-operations";
import {
  AGENT_GUARD_SDK_ENV_VARS,
  AGENT_GUARD_SDK_EXAMPLES,
  AGENT_GUARD_SDK_REQUEST_FIELDS,
  AGENT_GUARD_SDK_RESPONSE_FIELDS,
} from "./sdk-starter-kit";

export type AgentGuardImplementationChecklistItem = {
  id: string;
  title: string;
  detail: string;
};

export type AgentGuardImplementationChecklistSection = {
  id: string;
  title: string;
  summary: string;
  items: AgentGuardImplementationChecklistItem[];
};

export type AgentGuardImplementationChecklist = {
  title: string;
  generatedAt: string;
  organizationName: string;
  baseUrl: string;
  sections: AgentGuardImplementationChecklistSection[];
  boundary: string;
  checklistText: string;
};

export const AGENT_GUARD_IMPLEMENTATION_CHECKLIST_COPY = {
  title: "AgentGuard implementation checklist",
  overview:
    "Downloadable customer-engineer handoff for customer-controlled server-side AgentGuard source implementations.",
  boundary:
    "This checklist is implementation support for customer-controlled server-side activity submission. It is not legal advice, not a certification, not a compliance determination, not an auditor attestation, not a managed connector, not automatic monitoring, and not enforcement.",
  noSecrets:
    "Do not paste source keys, signing secrets, private keys, raw prompts, responses, files, messages, or customer data into this checklist or related evidence notes.",
} as const;

function oneLine(value: string | null | undefined, fallback: string): string {
  const normalized = value?.replace(/[\r\n\t]+/g, " ").trim();
  return normalized ? normalized.slice(0, 160) : fallback;
}

function normalizeBaseUrl(value: string | null | undefined): string {
  const normalized = oneLine(value, SHADOWGUARD_PRODUCTION_BASE_URL).replace(/\/+$/g, "");
  if (!/^https?:\/\//.test(normalized)) return SHADOWGUARD_PRODUCTION_BASE_URL;
  return normalized;
}

function checkboxItems(items: AgentGuardImplementationChecklistItem[]): string {
  return items
    .map((item) => `- [ ] ${item.title}: ${item.detail}`)
    .join("\n");
}

function bulletItems(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function checklistToMarkdown(input: {
  title: string;
  generatedAt: string;
  organizationName: string;
  baseUrl: string;
  sections: AgentGuardImplementationChecklistSection[];
  boundary: string;
}): string {
  const sections = input.sections
    .map((section) =>
      [
        `## ${section.title}`,
        "",
        section.summary,
        "",
        checkboxItems(section.items),
      ].join("\n")
    )
    .join("\n\n");

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
  const examples = AGENT_GUARD_SDK_EXAMPLES.map(
    (example) => `- ${example.label}: ${example.summary}`
  ).join("\n");
  const receiverItems = AGENT_GUARD_RECEIVER_CHECKLIST.map(
    (item) => `- ${item.title}: ${item.detail}`
  ).join("\n");
  const troubleshooting = AGENT_GUARD_OPERATOR_GUIDE_TROUBLESHOOTING.map(
    (note) => `- ${note.symptom} ${note.check}`
  ).join("\n");
  const guidePath = AGENT_GUARD_OPERATOR_GUIDE_PHASES.map(
    (phase) => phase.label
  ).join(" -> ");

  return [
    `# ${input.title}`,
    "",
    `Generated: ${input.generatedAt}`,
    `Organization: ${input.organizationName}`,
    `ShadowGuard URL: ${input.baseUrl}`,
    "",
    AGENT_GUARD_IMPLEMENTATION_CHECKLIST_COPY.overview,
    "",
    `Boundary: ${input.boundary}`,
    "",
    `Secret handling: ${AGENT_GUARD_IMPLEMENTATION_CHECKLIST_COPY.noSecrets}`,
    "",
    `Operator path reference: ${guidePath}`,
    "",
    sections,
    "",
    "## Server-side environment variables",
    "",
    envVars,
    "",
    "## Submit activity endpoint",
    "",
    `POST ${input.baseUrl}/api/agent-guard/activity with Authorization: Bearer <source-key>.`,
    "",
    "## Request fields",
    "",
    requestFields,
    "",
    "## Decision response fields",
    "",
    responseFields,
    "",
    "## Starter examples available in ShadowGuard",
    "",
    examples,
    "",
    "## Optional export receiver checklist",
    "",
    receiverItems,
    "",
    "## Troubleshooting",
    "",
    troubleshooting,
    "",
    "## Exclusions",
    "",
    bulletItems([
      "No source keys, signing secrets, private keys, raw prompts, responses, files, messages, or customer data are included in this checklist.",
      "No browser collector, hosted collector, universal activity capture, managed SIEM connector, managed SOAR connector, ticketing connector, chat connector, email connector, or native vendor connector is included.",
      "No automatic source creation, policy change, review mutation, export change, evidence save, acknowledgement creation, source promotion, rotation execution, or enforcement change is performed by downloading this checklist.",
      "This checklist helps prepare implementation and evidence conversations; it does not provide legal advice, certification, compliance determination, or auditor attestation.",
    ]),
  ].join("\n");
}

export function buildAgentGuardImplementationChecklist(input: {
  generatedAt?: string;
  organizationName?: string | null;
  baseUrl?: string | null;
} = {}): AgentGuardImplementationChecklist {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const organizationName = oneLine(input.organizationName, "Current organization");
  const baseUrl = normalizeBaseUrl(input.baseUrl);

  const sections: AgentGuardImplementationChecklistSection[] = [
    {
      id: "prepare-source",
      title: "Prepare the source",
      summary:
        "Confirm the customer-controlled system that will submit activity and keep key material server-side.",
      items: [
        {
          id: "assign-owner",
          title: "Assign an implementation owner",
          detail:
            "Name the engineer or team responsible for the server-side wrapper, source scope, test event, and rollout evidence.",
        },
        {
          id: "confirm-tool-scope",
          title: "Confirm allowed tool scope",
          detail:
            "Use exact AI tool names when the wrapper only handles known tools; leave source scope broad only for a trusted source that may submit any named AI tool.",
        },
        {
          id: "store-source-key",
          title: "Store the source key server-side",
          detail:
            "Save the one-time source key as a server-side secret such as AGENTGUARD_INGEST_TOKEN; never place it in browser code, local storage, tickets, evidence notes, or customer-visible logs.",
        },
      ],
    },
    {
      id: "submit-activity",
      title: "Submit safe activity",
      summary:
        "Use the bearer-token ingest path to submit safe sample activity and confirm metadata-only storage.",
      items: [
        {
          id: "configure-base-url",
          title: "Configure the app URL",
          detail:
            "Set SHADOWGUARD_APP_URL to the ShadowGuard deployment URL and call /api/agent-guard/activity from a trusted backend service.",
        },
        {
          id: "post-safe-event",
          title: "Send a safe test event",
          detail:
            "POST safe sample content with Authorization: Bearer <source-key>, toolName, userEmail, activityType, optional content, and non-content metadata.",
        },
        {
          id: "confirm-response",
          title: "Confirm the decision response",
          detail:
            "Capture the returned id, blocked flag, reason, riskLevel, policyId, and policyActions when present.",
        },
      ],
    },
    {
      id: "prove-policy-outcomes",
      title: "Prove policy outcomes",
      summary:
        "Confirm the submitted activity appears in ShadowGuard and produces expected policy behavior before expanding pilot coverage.",
      items: [
        {
          id: "confirm-source-attribution",
          title: "Confirm source attribution",
          detail:
            "Verify the activity appears under the intended source, updates last-used metadata, and does not persist raw prompt, response, file, or message content.",
        },
        {
          id: "review-policy-behavior",
          title: "Review policy behavior",
          detail:
            "Confirm expected allow, block, warn, or quarantine outcomes with the ShadowGuard operator before increasing scope.",
        },
        {
          id: "work-review-queue",
          title: "Work warn and quarantine reviews",
          detail:
            "Resolve, dismiss, or assign review queue items so the pilot does not expand with unclear outcomes.",
        },
      ],
    },
    {
      id: "record-evidence",
      title: "Record metadata-only evidence",
      summary:
        "Document the implementation without storing secrets, raw content, or legal/compliance conclusions.",
      items: [
        {
          id: "record-owner",
          title: "Record owner and wrapper location",
          detail:
            "Add implementation evidence with owner or team, wrapper location, evidence URL, checklist state, status, and short notes.",
        },
        {
          id: "avoid-sensitive-material",
          title: "Keep evidence metadata-only",
          detail:
            "Do not paste source keys, private keys, raw prompts, responses, files, or message content into evidence fields.",
        },
        {
          id: "save-readiness-evidence",
          title: "Save readiness evidence when appropriate",
          detail:
            "Use ShadowGuard readiness evidence and the enterprise runbook once source, policy, review, export, and evidence posture are ready enough for enterprise review.",
        },
      ],
    },
    {
      id: "prepare-receiver-and-rotation",
      title: "Prepare receiver and rotation",
      summary:
        "Prepare optional outbound receiver work and a practical source-key rotation handoff before broader rollout.",
      items: [
        {
          id: "receiver-path",
          title: "Prepare optional receiver path",
          detail:
            "If outbound export is needed, implement a customer-owned HTTPS receiver that verifies ShadowGuard signing headers and stores metadata-only payload fields.",
        },
        {
          id: "rotation-schedule",
          title: "Schedule source-key rotation",
          detail:
            "Create a replacement source key, update the server-side secret, send a safe test event, confirm source attribution, then revoke the old key.",
        },
        {
          id: "rollout-boundary",
          title: "Confirm rollout boundary",
          detail:
            "Treat AgentGuard decisions as input to the customer-controlled wrapper; the wrapper decides how to honor allow, warn, block, or quarantine outcomes.",
        },
      ],
    },
  ];

  const checklistText = checklistToMarkdown({
    title: AGENT_GUARD_IMPLEMENTATION_CHECKLIST_COPY.title,
    generatedAt,
    organizationName,
    baseUrl,
    sections,
    boundary: AGENT_GUARD_IMPLEMENTATION_CHECKLIST_COPY.boundary,
  });

  return {
    title: AGENT_GUARD_IMPLEMENTATION_CHECKLIST_COPY.title,
    generatedAt,
    organizationName,
    baseUrl,
    sections,
    boundary: AGENT_GUARD_IMPLEMENTATION_CHECKLIST_COPY.boundary,
    checklistText,
  };
}
