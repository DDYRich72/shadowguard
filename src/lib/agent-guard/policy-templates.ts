import type { PolicyAction } from "./engine";
import type { PolicyDraft, PolicyDraftCondition } from "./policy-builder";

export type AgentGuardPolicyTemplateCategory =
  | "credential_exposure"
  | "regulated_data"
  | "file_handling"
  | "critical_risk"
  | "approved_use"
  | "usage_review";

export type AgentGuardPolicyTemplateId =
  | "block-credential-exposure"
  | "warn-confidential-or-regulated-data"
  | "quarantine-file-uploads-for-review"
  | "block-critical-risk-activity"
  | "allow-public-data-to-approved-tools"
  | "warn-prompt-activity-for-review";

export type AgentGuardPolicyTemplate = {
  id: AgentGuardPolicyTemplateId;
  name: string;
  category: AgentGuardPolicyTemplateCategory;
  categoryLabel: string;
  summary: string;
  action: PolicyAction;
  enabled: boolean;
  priority: number;
  conditions: PolicyDraftCondition[];
  guidance: string;
  safetyNote: string;
  broadMatch: boolean;
};

export type AgentGuardPolicyActionGuide = {
  action: PolicyAction;
  label: string;
  summary: string;
  shippedBehavior: string;
  safetyNote: string;
};

export const POLICY_TEMPLATE_CATEGORY_LABELS: Record<
  AgentGuardPolicyTemplateCategory,
  string
> = {
  credential_exposure: "Credential exposure",
  regulated_data: "Regulated data",
  file_handling: "File handling",
  critical_risk: "Critical risk",
  approved_use: "Approved use",
  usage_review: "Usage review",
};

export const AGENT_GUARD_POLICY_ACTION_GUIDE: AgentGuardPolicyActionGuide[] = [
  {
    action: "block",
    label: "Block",
    summary: "Returns a blocked decision to the calling integration.",
    shippedBehavior:
      "Block is the only AgentGuard policy action that changes the synchronous API decision today.",
    safetyNote:
      "The customer-controlled wrapper or integration still has to honor the returned blocked decision.",
  },
  {
    action: "warn",
    label: "Warn",
    summary: "Creates an operator review item when matching submitted activity is stored.",
    shippedBehavior:
      "Warn does not block the request. It feeds the AgentGuard Reviews queue when review storage is available.",
    safetyNote:
      "Use warn for early tuning, regulated-data review, and signals that need human follow-up.",
  },
  {
    action: "quarantine",
    label: "Quarantine",
    summary: "Creates a higher-attention review item for activity that should be held by process.",
    shippedBehavior:
      "Quarantine is a review workflow label today, not an automatic third-party file hold.",
    safetyNote:
      "A customer integration must enforce any actual hold, rollback, or app-level remediation.",
  },
  {
    action: "allow",
    label: "Allow",
    summary: "Documents an approved pattern for low-risk submitted activity.",
    shippedBehavior:
      "Allow is represented in the policy model but does not override a separate matching block policy by itself.",
    safetyNote:
      "Use allow to document expected traffic, then confirm higher-priority block policies still behave as intended.",
  },
];

export const AGENT_GUARD_POLICY_TEMPLATES: AgentGuardPolicyTemplate[] = [
  {
    id: "block-credential-exposure",
    name: "Block credential exposure",
    category: "credential_exposure",
    categoryLabel: POLICY_TEMPLATE_CATEGORY_LABELS.credential_exposure,
    summary: "Stop submitted activity classified as restricted before it leaves a customer-controlled wrapper.",
    action: "block",
    enabled: true,
    priority: 1,
    conditions: [
      {
        field: "sensitivity",
        operator: "equals",
        value: "restricted",
      },
    ],
    guidance:
      "Use this as the first hard-stop policy for API keys, tokens, passwords, and other restricted data detected in submitted content.",
    safetyNote:
      "Confirm the submitting integration honors blocked decisions before relying on this as an enforcement control.",
    broadMatch: false,
  },
  {
    id: "warn-confidential-or-regulated-data",
    name: "Warn on confidential or regulated data",
    category: "regulated_data",
    categoryLabel: POLICY_TEMPLATE_CATEGORY_LABELS.regulated_data,
    summary: "Route likely personal, customer, or confidential data flows to operator review.",
    action: "warn",
    enabled: true,
    priority: 2,
    conditions: [
      {
        field: "sensitivity",
        operator: "equals",
        value: "confidential",
      },
    ],
    guidance:
      "Start here when you want human review for PII, customer context, proprietary material, or regulated-data indicators without blocking the user flow.",
    safetyNote:
      "This can create frequent review items in data-heavy workflows; tune by source, tool, or category after observing volume.",
    broadMatch: true,
  },
  {
    id: "quarantine-file-uploads-for-review",
    name: "Quarantine file uploads for review",
    category: "file_handling",
    categoryLabel: POLICY_TEMPLATE_CATEGORY_LABELS.file_handling,
    summary: "Flag file uploads to AI tools for higher-attention review.",
    action: "quarantine",
    enabled: false,
    priority: 4,
    conditions: [
      {
        field: "activityType",
        operator: "equals",
        value: "file_upload",
      },
    ],
    guidance:
      "Use this when uploaded documents should be inspected by policy owners before a customer integration treats the action as approved.",
    safetyNote:
      "Quarantine is a dashboard review label unless the source integration actually holds or reverses the file action.",
    broadMatch: true,
  },
  {
    id: "block-critical-risk-activity",
    name: "Block critical-risk activity",
    category: "critical_risk",
    categoryLabel: POLICY_TEMPLATE_CATEGORY_LABELS.critical_risk,
    summary: "Stop submitted activity after deterministic classification marks it critical.",
    action: "block",
    enabled: true,
    priority: 3,
    conditions: [
      {
        field: "riskLevel",
        operator: "equals",
        value: "critical",
      },
    ],
    guidance:
      "Use this as a second hard-stop for activity that combines high-risk action type, sensitive content, or credential indicators.",
    safetyNote:
      "Review dry-run examples before enabling in a live wrapper, because critical risk depends on the submitted event details.",
    broadMatch: false,
  },
  {
    id: "allow-public-data-to-approved-tools",
    name: "Allow public data to approved tools",
    category: "approved_use",
    categoryLabel: POLICY_TEMPLATE_CATEGORY_LABELS.approved_use,
    summary: "Document low-risk use of approved tools with public data.",
    action: "allow",
    enabled: false,
    priority: 10,
    conditions: [
      {
        field: "toolName",
        operator: "in",
        value: "ChatGPT Team, Microsoft Copilot, Claude Enterprise",
      },
      {
        field: "sensitivity",
        operator: "equals",
        value: "public",
      },
    ],
    guidance:
      "Edit the tool names to match the customer's approved AI tools before saving this policy.",
    safetyNote:
      "Allow documents expected traffic; it does not bypass a separate matching block policy on its own.",
    broadMatch: false,
  },
  {
    id: "warn-prompt-activity-for-review",
    name: "Warn on selected prompt activity",
    category: "usage_review",
    categoryLabel: POLICY_TEMPLATE_CATEGORY_LABELS.usage_review,
    summary: "Create a low-risk review starter for prompt traffic while tuning source coverage.",
    action: "warn",
    enabled: false,
    priority: 11,
    conditions: [
      {
        field: "activityType",
        operator: "equals",
        value: "prompt_sent",
      },
    ],
    guidance:
      "Use this temporarily for narrow pilots or demos where operators need to verify that prompt events are entering the review flow.",
    safetyNote:
      "This is not a volume threshold or anomaly detector. Keep it disabled until scoped to a known source, tool, or pilot group.",
    broadMatch: true,
  },
];

export function policyTemplateToDraft(
  template: AgentGuardPolicyTemplate
): PolicyDraft {
  return {
    name: template.name,
    description: `${template.summary} ${template.guidance}`,
    enabled: template.enabled,
    priority: template.priority,
    action: template.action,
    conditions: template.conditions.map((condition) => ({ ...condition })),
  };
}

export function policyTemplatesByCategory(
  templates: AgentGuardPolicyTemplate[] = AGENT_GUARD_POLICY_TEMPLATES
): Array<{
  category: AgentGuardPolicyTemplateCategory;
  label: string;
  templates: AgentGuardPolicyTemplate[];
}> {
  return Object.entries(POLICY_TEMPLATE_CATEGORY_LABELS)
    .map(([category, label]) => ({
      category: category as AgentGuardPolicyTemplateCategory,
      label,
      templates: templates.filter((template) => template.category === category),
    }))
    .filter((group) => group.templates.length > 0);
}
