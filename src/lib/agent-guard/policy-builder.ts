import {
  evaluatePolicy,
  type ActivityType,
  type AgentActivity,
  type AgentPolicy,
  type DataSensitivity,
  type PolicyAction,
  type PolicyCondition,
  type RiskLevel,
} from "./engine";

export type PolicyConditionField = PolicyCondition["field"];
export type PolicyConditionOperator = PolicyCondition["operator"];

export type PolicyDraftCondition = {
  field: PolicyConditionField;
  operator: PolicyConditionOperator;
  value: string;
};

export type PolicyDraft = {
  id?: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  action: PolicyAction;
  conditions: PolicyDraftCondition[];
};

export type PolicyApiBody = {
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  action: PolicyAction;
  conditions: PolicyCondition[];
};

export type PolicyTestSample = {
  toolName: string;
  userEmail: string;
  activityType: ActivityType;
  sensitivity: DataSensitivity;
  riskLevel: RiskLevel;
  categories: string[];
};

export type PolicyTestResult = {
  matched: boolean;
  action: PolicyAction | null;
  summary: string;
};

export const POLICY_FIELD_OPTIONS: Array<{
  value: PolicyConditionField;
  label: string;
}> = [
  { value: "toolName", label: "Tool" },
  { value: "activityType", label: "Activity type" },
  { value: "sensitivity", label: "Data sensitivity" },
  { value: "riskLevel", label: "Risk level" },
  { value: "userEmail", label: "User email" },
  { value: "dataCategory", label: "Data category" },
];

export const POLICY_OPERATOR_OPTIONS: Array<{
  value: PolicyConditionOperator;
  label: string;
}> = [
  { value: "equals", label: "is" },
  { value: "not_equals", label: "is not" },
  { value: "contains", label: "contains" },
  { value: "in", label: "is one of" },
];

export const POLICY_ACTION_OPTIONS: Array<{
  value: PolicyAction;
  label: string;
}> = [
  { value: "block", label: "Block" },
  { value: "warn", label: "Warn" },
  { value: "quarantine", label: "Quarantine" },
  { value: "allow", label: "Allow" },
];

export const ACTIVITY_TYPE_OPTIONS: Array<{ value: ActivityType; label: string }> = [
  { value: "prompt_sent", label: "Prompt sent" },
  { value: "response_received", label: "Response received" },
  { value: "file_upload", label: "File upload" },
  { value: "file_download", label: "File download" },
  { value: "api_call", label: "API call" },
  { value: "data_export", label: "Data export" },
  { value: "agent_action", label: "Agent action" },
  { value: "tool_invocation", label: "Tool invocation" },
];

export const SENSITIVITY_OPTIONS: Array<{ value: DataSensitivity; label: string }> = [
  { value: "public", label: "Public" },
  { value: "internal", label: "Internal" },
  { value: "confidential", label: "Confidential" },
  { value: "restricted", label: "Restricted" },
];

export const RISK_LEVEL_OPTIONS: Array<{ value: RiskLevel; label: string }> = [
  { value: "none", label: "None" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const FIELD_LABELS = Object.fromEntries(
  POLICY_FIELD_OPTIONS.map((option) => [option.value, option.label])
) as Record<PolicyConditionField, string>;

const OPERATOR_LABELS = Object.fromEntries(
  POLICY_OPERATOR_OPTIONS.map((option) => [option.value, option.label])
) as Record<PolicyConditionOperator, string>;

export const EMPTY_POLICY_DRAFT: PolicyDraft = {
  name: "",
  description: "",
  enabled: true,
  priority: 5,
  action: "block",
  conditions: [
    {
      field: "sensitivity",
      operator: "equals",
      value: "restricted",
    },
  ],
};

export const DEFAULT_POLICY_TEST_SAMPLE: PolicyTestSample = {
  toolName: "ChatGPT",
  userEmail: "analyst@example.com",
  activityType: "prompt_sent",
  sensitivity: "restricted",
  riskLevel: "critical",
  categories: ["API Key"],
};

export function clonePolicyDraft(draft: PolicyDraft): PolicyDraft {
  return {
    ...draft,
    conditions: draft.conditions.map((condition) => ({ ...condition })),
  };
}

export function policyToDraft(policy: AgentPolicy): PolicyDraft {
  return {
    id: policy.id,
    name: policy.name,
    description: policy.description,
    enabled: policy.enabled,
    priority: policy.priority,
    action: policy.action,
    conditions: policy.conditions.map((condition) => ({
      field: condition.field,
      operator: condition.operator,
      value: Array.isArray(condition.value)
        ? condition.value.join(", ")
        : String(condition.value),
    })),
  };
}

function parseConditionValue(condition: PolicyDraftCondition): string | string[] | number {
  const value = condition.value.trim();
  if (condition.operator === "in") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if ((condition.operator === "gte" || condition.operator === "lte") && value !== "") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value;
  }
  return value;
}

export function draftToPolicyBody(draft: PolicyDraft): PolicyApiBody {
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    enabled: draft.enabled,
    priority: Number.isFinite(draft.priority) ? Math.trunc(draft.priority) : 5,
    action: draft.action,
    conditions: draft.conditions.map((condition) => ({
      field: condition.field,
      operator: condition.operator,
      value: parseConditionValue(condition),
    })),
  };
}

export function formatPolicyCondition(condition: PolicyCondition): string {
  const value = Array.isArray(condition.value)
    ? condition.value.join(", ")
    : String(condition.value);
  return `${FIELD_LABELS[condition.field] ?? condition.field} ${
    OPERATOR_LABELS[condition.operator] ?? condition.operator
  } "${value}"`;
}

export function formatDraftCondition(condition: PolicyDraftCondition): string {
  return formatPolicyCondition({
    field: condition.field,
    operator: condition.operator,
    value: parseConditionValue(condition),
  });
}

export function evaluatePolicyDraft(
  draft: PolicyDraft,
  sample: PolicyTestSample
): PolicyTestResult {
  const body = draftToPolicyBody(draft);
  const policy: AgentPolicy = {
    id: draft.id ?? "draft",
    orgId: "draft",
    name: body.name || "Draft policy",
    description: body.description,
    enabled: body.enabled,
    priority: body.priority,
    action: body.action,
    conditions: body.conditions,
    createdAt: "",
    updatedAt: "",
  };
  const activity: AgentActivity = {
    id: "sample",
    orgId: "draft",
    toolName: sample.toolName,
    toolId: "",
    userId: "",
    userEmail: sample.userEmail,
    activityType: sample.activityType,
    timestamp: new Date().toISOString(),
    dataClassification: {
      sensitivity: sample.sensitivity,
      categories: sample.categories,
      piiDetected: sample.categories.some((category) =>
        ["SSN", "Email", "Phone Number", "Credit Card", "IP Address"].includes(category)
      ),
      credentialsDetected: sample.categories.some((category) =>
        ["Password", "API Key", "Token", "Private Key", "AWS Access Key"].includes(category)
      ),
      proprietaryDetected: sample.categories.includes("Proprietary Content"),
      details:
        sample.categories.length > 0
          ? `Detected: ${sample.categories.join(", ")}`
          : "No sensitive data detected",
    },
    riskLevel: sample.riskLevel,
    metadata: {},
    blocked: false,
  };

  const action = evaluatePolicy(policy, activity);
  if (!action) {
    return {
      matched: false,
      action: null,
      summary: "No match for this sample activity.",
    };
  }
  return {
    matched: true,
    action,
    summary: `Matched. The policy action would be ${action}.`,
  };
}
