import { describe, expect, it } from "vitest";
import {
  buildPolicyDecisionReviewInsert,
  isReviewablePolicyAction,
  summarizePolicyDecisionReviews,
} from "../policy-reviews";
import type { AgentPolicyMatch } from "../engine";

function match(overrides: Partial<AgentPolicyMatch>): AgentPolicyMatch {
  return {
    policyId: "policy-1",
    policyName: "Warn on PII",
    policyAction: "warn",
    priority: 2,
    ...overrides,
  };
}

describe("AgentGuard policy decision reviews", () => {
  it("creates review rows only for warn and quarantine actions", () => {
    expect(isReviewablePolicyAction("warn")).toBe(true);
    expect(isReviewablePolicyAction("quarantine")).toBe(true);
    expect(isReviewablePolicyAction("allow")).toBe(false);
    expect(isReviewablePolicyAction("block")).toBe(false);
  });

  it("builds metadata-only review inserts from policy matches", () => {
    const review = buildPolicyDecisionReviewInsert({
      orgId: "org-1",
      activityId: "activity-1",
      match: match({ policyAction: "quarantine", policyName: "Quarantine files" }),
      toolName: "ChatGPT",
      userEmail: "employee@example.com",
      activityType: "file_upload",
      riskLevel: "high",
      dataSensitivity: "confidential",
      dataCategories: ["Email", "Proprietary Content"],
    });

    expect(review).toMatchObject({
      org_id: "org-1",
      activity_id: "activity-1",
      policy_name: "Quarantine files",
      policy_action: "quarantine",
      status: "open",
      tool_name: "ChatGPT",
      user_email: "employee@example.com",
      activity_type: "file_upload",
      risk_level: "high",
      data_sensitivity: "confidential",
      data_categories: ["Email", "Proprietary Content"],
    });
    expect(JSON.stringify(review)).not.toContain("raw");
    expect(JSON.stringify(review)).not.toContain("prompt text");
  });

  it("skips block and allow review inserts", () => {
    expect(
      buildPolicyDecisionReviewInsert({
        orgId: "org-1",
        activityId: "activity-1",
        match: match({ policyAction: "block" }),
        toolName: "ChatGPT",
        userEmail: "employee@example.com",
        activityType: "prompt_sent",
        riskLevel: "critical",
        dataSensitivity: "restricted",
        dataCategories: ["API Key"],
      })
    ).toBeNull();
  });

  it("summarizes review queue counts", () => {
    const summary = summarizePolicyDecisionReviews([
      { status: "open", policyAction: "warn" },
      { status: "investigating", policyAction: "quarantine" },
      { status: "resolved", policyAction: "warn" },
      { status: "dismissed", policyAction: "quarantine" },
    ]);

    expect(summary).toEqual({
      total: 4,
      open: 1,
      investigating: 1,
      resolved: 1,
      dismissed: 1,
      warn: 2,
      quarantine: 2,
      needsAction: 2,
    });
  });
});
