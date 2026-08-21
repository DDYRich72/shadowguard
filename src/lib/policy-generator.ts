import type { PolicyGenerateBody } from "./api/schemas";

export type PolicyDraftSourceSummary = {
  inputMode: "manual_request";
  inputLabel: string;
  approvedToolCount: number;
  blockedToolCount: number;
  serverLoadedScanData: false;
  dataBackedGenerationReady: false;
  limitations: string[];
};

export type GeneratedPolicyDraft = {
  markdown: string;
  sourceSummary: PolicyDraftSourceSummary;
};

type ToolEntry = {
  appName: string;
  category?: string;
  riskLevel?: string;
};

type BlockedToolEntry = {
  appName: string;
  reason?: string;
};

const INDUSTRY_GUIDANCE: Record<
  string,
  {
    label: string;
    reviewNote: string;
    specialRules: string[];
  }
> = {
  general: {
    label: "General business",
    reviewNote:
      "Review this draft against internal data handling, vendor review, HR, and security policies before distribution.",
    specialRules: [
      "Do not paste confidential, restricted, regulated, customer, employee, source-code, or credential material into unapproved AI tools.",
      "Use approved tools only for approved use cases and data classes.",
      "Escalate uncertain use cases to the policy owner before sharing data with an AI service.",
    ],
  },
  healthcare: {
    label: "Healthcare review",
    reviewNote:
      "Healthcare use requires customer-side HIPAA, PHI, clinical workflow, and Business Associate Agreement review before distribution.",
    specialRules: [
      "Do not input PHI into AI tools unless the organization has approved the tool, use case, BAA posture, and data handling path.",
      "Clinical or care decisions require qualified human review and customer-owned documentation controls.",
      "De-identified data workflows should be reviewed for re-identification risk before use.",
    ],
  },
  legal: {
    label: "Legal practice review",
    reviewNote:
      "Legal use requires customer-side review for privilege, confidentiality, matter-file documentation, and attorney work-product handling before distribution.",
    specialRules: [
      "Do not input privileged, confidential, matter strategy, settlement, or client-identifying material into unapproved AI tools.",
      "AI-assisted legal research, drafting, or analysis requires qualified attorney review before external use.",
      "Document AI-assisted work according to the firm's matter-file and supervision practices.",
    ],
  },
};

export const POLICY_GENERATOR_BOUNDARY_COPY = {
  draftOnly:
    "This is an editable policy starter, not a final policy, legal advice, compliance determination, certification, auditor attestation, employee acknowledgement, or security warranty.",
  manualInputOnly:
    "This draft is generated from manual form inputs and request-provided tool lists only. ShadowGuard does not yet auto-load scan results, approvals, blocklists, AI Systems, AgentGuard activity, governance reports, or evidence records into this generator.",
  nextDataPath:
    "Next data-backed path: load org-approved tools, blocked tools, discovered AI apps, AI Systems, and governance evidence server-side before generating the draft.",
} as const;

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function industryGuidance(industry: string) {
  return INDUSTRY_GUIDANCE[industry] ?? INDUSTRY_GUIDANCE.general;
}

function formatApprovedTools(tools: ToolEntry[]): string {
  if (tools.length === 0) {
    return [
      "- No approved tools were provided to this draft.",
      "- Treat this section as incomplete until an operator reviews ShadowGuard approvals, discovered AI apps, and AI Systems.",
    ].join("\n");
  }

  return tools
    .map((tool) => {
      const category = tool.category || "Other";
      const riskLevel = tool.riskLevel || "medium";
      return `- **${tool.appName}** (${category}) - draft risk label: ${riskLevel}`;
    })
    .join("\n");
}

function formatBlockedTools(tools: BlockedToolEntry[]): string {
  if (tools.length === 0) {
    return [
      "- No blocked tools were provided to this draft.",
      "- Treat this section as incomplete until an operator reviews ShadowGuard block decisions and customer policy decisions.",
    ].join("\n");
  }

  return tools
    .map((tool) => `- **${tool.appName}**${tool.reason ? ` - ${tool.reason}` : ""}`)
    .join("\n");
}

function formatDetailedApprovedTools(tools: ToolEntry[]): string {
  if (tools.length === 0) {
    return "No approved tools were provided to this draft.";
  }

  return tools
    .map((tool) => {
      const category = tool.category || "Other";
      const riskLevel = tool.riskLevel || "medium";
      return [
        `### ${tool.appName}`,
        `- Category: ${category}`,
        `- Draft risk label: ${riskLevel}`,
        "- Status: Provided as approved input for this draft only",
      ].join("\n");
    })
    .join("\n\n");
}

function formatList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

export function buildPolicyDraftSourceSummary(
  body: Pick<PolicyGenerateBody, "approvedTools" | "blockedTools">
): PolicyDraftSourceSummary {
  return {
    inputMode: "manual_request",
    inputLabel: "Manual/request-provided inputs only",
    approvedToolCount: body.approvedTools.length,
    blockedToolCount: body.blockedTools.length,
    serverLoadedScanData: false,
    dataBackedGenerationReady: false,
    limitations: [
      "No server-side scan result loading",
      "No automatic approved-tool loading",
      "No automatic blocked-tool loading",
      "No AI Systems, AgentGuard, governance report, or evidence-record loading",
    ],
  };
}

export function generatePolicyDraft(
  body: PolicyGenerateBody,
  generatedAt = new Date()
): GeneratedPolicyDraft {
  const guidance = industryGuidance(body.industry);
  const date = formatDate(generatedAt);
  const orgName = String(body.orgName || "Your Organization").slice(0, 200);
  const sourceSummary = buildPolicyDraftSourceSummary(body);
  const approvedTools = formatApprovedTools(body.approvedTools);
  const blockedTools = formatBlockedTools(body.blockedTools);
  const detailedApprovedTools = formatDetailedApprovedTools(body.approvedTools);

  const markdown = `# AI Usage Policy Draft

**Draft date:** ${date}
**Organization:** ${orgName}
**Industry posture:** ${guidance.label}
**Risk tolerance:** ${body.riskTolerance}
**Input source:** ${sourceSummary.inputLabel}
**Review status:** Internal review required before distribution

## Draft Boundary

${POLICY_GENERATOR_BOUNDARY_COPY.draftOnly}

${POLICY_GENERATOR_BOUNDARY_COPY.manualInputOnly}

${guidance.reviewNote}

## 1. Purpose

This draft describes how personnel should request, use, review, and escalate AI tool usage for ${orgName}. It is intended to help internal teams start a policy review from a consistent structure.

## 2. Scope

This draft applies to employees, contractors, and third-party users who access, use, configure, or approve AI tools on behalf of ${orgName}.

## 3. Approved AI Tools

${approvedTools}

Any AI tool not listed in the final approved-tool section should require customer-defined approval before use.

## 4. Prohibited Uses

${formatList(guidance.specialRules)}
- Never share passwords, API keys, bearer tokens, signing secrets, private keys, or recovery codes with AI tools.
- Do not rely on AI output for legal, compliance, security, financial, employment, clinical, or customer-impacting decisions without qualified human review.

## 5. Data Classification Guidance

| Data classification | Draft AI usage posture |
| --- | --- |
| Public | May be allowed with approved tools and approved use cases. |
| Internal | Use approved tools only; avoid unnecessary data sharing. |
| Confidential | Requires explicit owner approval and vendor/data-handling review. |
| Restricted | Do not use external AI tools unless leadership, security, and applicable compliance owners approve the exact workflow. |

## 6. Detailed Approved Tool List

${detailedApprovedTools}

## 7. Blocked Tools

${blockedTools}

## 8. Reporting And Escalation

If personnel discover unauthorized AI usage or possible data exposure involving AI tools, they should report it through the organization's security or governance process and preserve relevant metadata for investigation.

## 9. Review Cadence

Review this policy draft before distribution, after major AI tool changes, and at least quarterly during active AI governance rollout.

## 10. Data-Backed Generation Path

${POLICY_GENERATOR_BOUNDARY_COPY.nextDataPath}

Until that path is implemented, operators should manually compare this draft against ShadowGuard scan results, approved tools, blocked tools, AI Systems, governance reports, and evidence records before treating it as ready for approval.

---

Generated by ShadowGuard draft support on ${date}.`;

  return {
    markdown,
    sourceSummary,
  };
}
