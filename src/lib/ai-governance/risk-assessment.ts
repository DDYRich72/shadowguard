import type {
  AIDataSensitivity,
  AIGovernanceRiskTier,
  RecommendedControl,
} from "./types";
import { frameworkMappingsForControl } from "./frameworks";

export type RegulatedDecisionArea =
  | "none"
  | "hiring"
  | "credit"
  | "insurance"
  | "healthcare"
  | "legal"
  | "financial"
  | "other";

export type BusinessCriticality = "low" | "medium" | "high";

export type RiskAssessmentInput = {
  dataSensitivity: AIDataSensitivity;
  processesPersonalData: boolean;
  processesCustomerData: boolean;
  processesEmployeeData: boolean;
  regulatedDecisionArea: RegulatedDecisionArea;
  customerFacing: boolean;
  employeeFacing: boolean;
  autonomousActions: boolean;
  humanReviewRequired: boolean;
  vendorApproved: boolean;
  hasSoc2: boolean;
  hasDpa: boolean;
  loggingEnabled: boolean;
  businessCriticality: BusinessCriticality;
  usesDataForTraining: boolean;
};

export type RiskAssessmentResult = {
  dataRiskScore: number;
  securityRiskScore: number;
  regulatoryRiskScore: number;
  businessImpactScore: number;
  overallScore: number;
  riskTier: AIGovernanceRiskTier;
  summary: string;
  recommendedControls: RecommendedControl[];
  questionRiskPoints: Record<keyof RiskAssessmentInput, number>;
};

const sensitivityBase: Record<AIDataSensitivity, number> = {
  public: 5,
  internal: 20,
  confidential: 45,
  restricted: 70,
};

const businessBase: Record<BusinessCriticality, number> = {
  low: 10,
  medium: 35,
  high: 60,
};

const regulatedBase: Record<RegulatedDecisionArea, number> = {
  none: 5,
  other: 25,
  hiring: 60,
  credit: 65,
  insurance: 65,
  healthcare: 70,
  legal: 55,
  financial: 60,
};

function cap(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function riskTierFromScore(score: number): AIGovernanceRiskTier {
  if (score >= 75) return "critical";
  if (score >= 55) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function control(
  key: string,
  title: string,
  category: string,
  reason: string,
  priority: "required" | "recommended" = "required"
): RecommendedControl {
  return {
    key,
    title,
    category,
    reason,
    priority,
    framework_mappings: frameworkMappingsForControl({ key, category }),
  };
}

export function assessAIRisk(input: RiskAssessmentInput): RiskAssessmentResult {
  const questionRiskPoints: RiskAssessmentResult["questionRiskPoints"] = {
    dataSensitivity: sensitivityBase[input.dataSensitivity],
    processesPersonalData: input.processesPersonalData ? 15 : 0,
    processesCustomerData: input.processesCustomerData ? 10 : 0,
    processesEmployeeData: input.processesEmployeeData ? 10 : 0,
    regulatedDecisionArea: regulatedBase[input.regulatedDecisionArea],
    customerFacing: input.customerFacing ? 15 : 0,
    employeeFacing: input.employeeFacing ? 8 : 0,
    autonomousActions: input.autonomousActions ? 15 : 0,
    humanReviewRequired: input.humanReviewRequired ? -10 : 15,
    vendorApproved: input.vendorApproved ? 0 : 30,
    hasSoc2: input.hasSoc2 ? 0 : 25,
    hasDpa: input.hasDpa ? 0 : 15,
    loggingEnabled: input.loggingEnabled ? 0 : 15,
    businessCriticality: businessBase[input.businessCriticality],
    usesDataForTraining: input.usesDataForTraining ? 15 : 0,
  };

  const dataRiskScore = cap(
    questionRiskPoints.dataSensitivity +
      questionRiskPoints.processesPersonalData +
      questionRiskPoints.processesCustomerData +
      questionRiskPoints.processesEmployeeData +
      questionRiskPoints.usesDataForTraining
  );

  const securityRiskScore = cap(
    10 +
      questionRiskPoints.vendorApproved +
      questionRiskPoints.hasSoc2 +
      questionRiskPoints.hasDpa +
      questionRiskPoints.loggingEnabled +
      questionRiskPoints.autonomousActions
  );

  const regulatoryRiskScore = cap(
    questionRiskPoints.regulatedDecisionArea +
      (input.processesPersonalData ? 10 : 0) +
      (input.customerFacing ? 10 : 0) +
      (input.humanReviewRequired ? 0 : 15)
  );

  const businessImpactScore = cap(
    questionRiskPoints.businessCriticality +
      questionRiskPoints.customerFacing +
      questionRiskPoints.employeeFacing +
      questionRiskPoints.autonomousActions +
      questionRiskPoints.humanReviewRequired
  );

  const overallScore = cap(
    dataRiskScore * 0.35 +
      securityRiskScore * 0.25 +
      regulatoryRiskScore * 0.25 +
      businessImpactScore * 0.15
  );
  const riskTier = riskTierFromScore(overallScore);
  const recommendedControls = recommendControls(input, riskTier);

  return {
    dataRiskScore,
    securityRiskScore,
    regulatoryRiskScore,
    businessImpactScore,
    overallScore,
    riskTier,
    summary: summarizeRisk(riskTier, input),
    recommendedControls,
    questionRiskPoints,
  };
}

function recommendControls(
  input: RiskAssessmentInput,
  riskTier: AIGovernanceRiskTier
): RecommendedControl[] {
  const controls: RecommendedControl[] = [
    control(
      "owner-assigned",
      "Assign accountable AI system owner",
      "Ownership",
      "Every AI system needs a named business owner."
    ),
    control(
      "approved-use-case",
      "Document approved use case and prohibited use",
      "Policy",
      "Users need clear boundaries for how this AI system may be used."
    ),
  ];

  if (!input.vendorApproved || !input.hasSoc2 || !input.hasDpa) {
    controls.push(
      control(
        "vendor-review",
        "Complete vendor security and privacy review",
        "Vendor",
        "Vendor posture is incomplete for this AI system."
      )
    );
  }

  if (
    input.processesPersonalData ||
    input.processesCustomerData ||
    input.dataSensitivity === "confidential" ||
    input.dataSensitivity === "restricted"
  ) {
    controls.push(
      control(
        "data-handling-rules",
        "Define allowed data types and retention rules",
        "Data",
        "The system may process sensitive or regulated data."
      )
    );
  }

  if (!input.humanReviewRequired || input.autonomousActions) {
    controls.push(
      control(
        "human-oversight",
        "Require human review for material outputs or actions",
        "Oversight",
        "Autonomous or unreviewed AI use can create customer, legal, or operational harm."
      )
    );
  }

  if (!input.loggingEnabled) {
    controls.push(
      control(
        "usage-logging",
        "Enable usage logging or reviewable activity records",
        "Auditability",
        "Governance requires evidence of use and review."
      )
    );
  }

  if (input.regulatedDecisionArea !== "none") {
    controls.push(
      control(
        "regulated-use-review",
        "Review regulated or high-impact decision use",
        "Compliance",
        "The use case may affect rights, eligibility, financial outcomes, or regulated services."
      )
    );
  }

  if (riskTier === "critical" || riskTier === "high") {
    controls.push(
      control(
        "executive-approval",
        "Require leadership approval before production use",
        "Approval",
        "High-risk AI systems need explicit acceptance of residual risk."
      )
    );
  }

  if (input.usesDataForTraining) {
    controls.push(
      control(
        "training-data-opt-out",
        "Confirm vendor model-training opt-out or contractual protection",
        "Vendor",
        "Customer or company data should not train external models without approval."
      )
    );
  }

  return controls;
}

function summarizeRisk(
  tier: AIGovernanceRiskTier,
  input: RiskAssessmentInput
): string {
  const details: string[] = [];
  if (input.dataSensitivity === "confidential" || input.dataSensitivity === "restricted") {
    details.push("sensitive data");
  }
  if (input.customerFacing) details.push("customer-facing use");
  if (input.regulatedDecisionArea !== "none") details.push("regulated decision impact");
  if (input.autonomousActions) details.push("autonomous action");
  if (!input.vendorApproved) details.push("unapproved vendor");

  if (details.length === 0) {
    return `This system is currently ${tier} risk based on the assessment answers.`;
  }

  return `This system is ${tier} risk because it involves ${details.join(", ")}.`;
}
