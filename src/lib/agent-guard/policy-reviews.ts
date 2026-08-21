import type {
  ActivityType,
  AgentPolicyMatch,
  DataSensitivity,
  PolicyAction,
  RiskLevel,
} from "./engine";

export type AgentPolicyDecisionReviewStatus =
  | "open"
  | "investigating"
  | "resolved"
  | "dismissed";

export type ReviewablePolicyAction = Extract<PolicyAction, "warn" | "quarantine">;

export type AgentPolicyDecisionReviewInsert = {
  org_id: string;
  activity_id: string;
  policy_id: string | null;
  policy_name: string;
  policy_action: ReviewablePolicyAction;
  status: AgentPolicyDecisionReviewStatus;
  tool_name: string;
  user_email: string;
  activity_type: ActivityType;
  risk_level: RiskLevel;
  data_sensitivity: DataSensitivity;
  data_categories: string[];
  assigned_to: string;
  review_note: string;
};

export type AgentPolicyDecisionReviewSummary = {
  total: number;
  open: number;
  investigating: number;
  resolved: number;
  dismissed: number;
  warn: number;
  quarantine: number;
  needsAction: number;
};

export const AGENT_POLICY_REVIEW_STATUS_OPTIONS: Array<{
  value: AgentPolicyDecisionReviewStatus;
  label: string;
}> = [
  { value: "open", label: "Open" },
  { value: "investigating", label: "Investigating" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

export const AGENT_POLICY_REVIEW_ACTION_OPTIONS: Array<{
  value: ReviewablePolicyAction;
  label: string;
}> = [
  { value: "warn", label: "Warn" },
  { value: "quarantine", label: "Quarantine" },
];

export function isReviewablePolicyAction(
  action: PolicyAction
): action is ReviewablePolicyAction {
  return action === "warn" || action === "quarantine";
}

export function buildPolicyDecisionReviewInsert(input: {
  orgId: string;
  activityId: string;
  match: AgentPolicyMatch;
  toolName: string;
  userEmail: string;
  activityType: ActivityType;
  riskLevel: RiskLevel;
  dataSensitivity: DataSensitivity;
  dataCategories: string[];
}): AgentPolicyDecisionReviewInsert | null {
  if (!isReviewablePolicyAction(input.match.policyAction)) return null;

  return {
    org_id: input.orgId,
    activity_id: input.activityId,
    policy_id: input.match.policyId || null,
    policy_name: input.match.policyName,
    policy_action: input.match.policyAction,
    status: "open",
    tool_name: input.toolName,
    user_email: input.userEmail,
    activity_type: input.activityType,
    risk_level: input.riskLevel,
    data_sensitivity: input.dataSensitivity,
    data_categories: input.dataCategories,
    assigned_to: "",
    review_note: "",
  };
}

export function summarizePolicyDecisionReviews(
  reviews: Array<{
    status: AgentPolicyDecisionReviewStatus;
    policyAction: ReviewablePolicyAction;
  }>
): AgentPolicyDecisionReviewSummary {
  const summary: AgentPolicyDecisionReviewSummary = {
    total: reviews.length,
    open: 0,
    investigating: 0,
    resolved: 0,
    dismissed: 0,
    warn: 0,
    quarantine: 0,
    needsAction: 0,
  };

  for (const review of reviews) {
    summary[review.status] += 1;
    summary[review.policyAction] += 1;
  }
  summary.needsAction = summary.open + summary.investigating;
  return summary;
}

export function policyReviewStatusLabel(
  status: AgentPolicyDecisionReviewStatus
): string {
  return (
    AGENT_POLICY_REVIEW_STATUS_OPTIONS.find((option) => option.value === status)
      ?.label ?? status
  );
}
