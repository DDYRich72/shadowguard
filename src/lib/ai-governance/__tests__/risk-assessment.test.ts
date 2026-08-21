import { describe, expect, it } from "vitest";
import { assessAIRisk, riskTierFromScore, type RiskAssessmentInput } from "../risk-assessment";

const baseInput: RiskAssessmentInput = {
  dataSensitivity: "internal",
  processesPersonalData: false,
  processesCustomerData: false,
  processesEmployeeData: false,
  regulatedDecisionArea: "none",
  customerFacing: false,
  employeeFacing: true,
  autonomousActions: false,
  humanReviewRequired: true,
  vendorApproved: true,
  hasSoc2: true,
  hasDpa: true,
  loggingEnabled: true,
  businessCriticality: "low",
  usesDataForTraining: false,
};

describe("AI governance risk assessment", () => {
  it("keeps a low-impact approved internal assistant low/medium", () => {
    const result = assessAIRisk(baseInput);
    expect(["low", "medium"]).toContain(result.riskTier);
    expect(result.overallScore).toBeLessThan(55);
  });

  it("elevates regulated customer-facing autonomous use", () => {
    const result = assessAIRisk({
      ...baseInput,
      dataSensitivity: "restricted",
      processesPersonalData: true,
      processesCustomerData: true,
      regulatedDecisionArea: "financial",
      customerFacing: true,
      autonomousActions: true,
      humanReviewRequired: false,
      vendorApproved: false,
      hasSoc2: false,
      hasDpa: false,
      loggingEnabled: false,
      businessCriticality: "high",
      usesDataForTraining: true,
    });

    expect(["high", "critical"]).toContain(result.riskTier);
    expect(result.recommendedControls.some((c) => c.key === "executive-approval")).toBe(true);
    expect(result.recommendedControls.some((c) => c.key === "human-oversight")).toBe(true);
    expect(
      result.recommendedControls.every((control) => control.framework_mappings?.length)
    ).toBe(true);
  });

  it("uses stable tier thresholds", () => {
    expect(riskTierFromScore(10)).toBe("low");
    expect(riskTierFromScore(30)).toBe("medium");
    expect(riskTierFromScore(55)).toBe("high");
    expect(riskTierFromScore(75)).toBe("critical");
  });
});
