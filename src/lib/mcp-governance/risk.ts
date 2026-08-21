import type {
  MCPCapabilityCategory,
  MCPPostureSummary,
  MCPTool,
  MCPToolRiskInput,
  MCPToolRiskResult,
} from "./types";
import type { AIDataSensitivity, AIGovernanceRiskTier } from "@/lib/ai-governance/types";

const sensitivityPoints: Record<AIDataSensitivity, number> = {
  public: 0,
  internal: 10,
  confidential: 25,
  restricted: 35,
};

const capabilityPoints: Record<MCPCapabilityCategory, number> = {
  read: 5,
  write: 20,
  execute: 25,
  data_export: 25,
  credential_access: 35,
  admin: 30,
  external_network: 20,
  file_access: 15,
  database_access: 25,
  custom: 10,
};

function tierFromScore(score: number): AIGovernanceRiskTier {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function labelCategory(category: string): string {
  return category.replace(/_/g, " ");
}

export function calculateMCPToolRisk(input: MCPToolRiskInput): MCPToolRiskResult {
  const factors: string[] = [];
  let score = 10;

  const sensitivity = sensitivityPoints[input.dataSensitivity];
  score += sensitivity;
  if (sensitivity > 0) {
    factors.push(`${input.dataSensitivity} data sensitivity`);
  }

  const uniqueCategories = Array.from(new Set(input.capabilityCategories));
  const categoryScore = Math.min(
    45,
    uniqueCategories.reduce((sum, category) => sum + (capabilityPoints[category] ?? 0), 0)
  );
  score += categoryScore;
  for (const category of uniqueCategories) {
    factors.push(`${labelCategory(category)} capability`);
  }

  if (input.externalAccess) {
    score += 15;
    factors.push("external network access");
  }
  if (input.writeAccess) {
    score += 15;
    factors.push("write access");
  }
  if (input.credentialAccess) {
    score += 25;
    factors.push("credential access");
  }

  switch (input.approvalStatus) {
    case "approved":
      score -= 10;
      factors.push("approved tool");
      break;
    case "pending_review":
      score += 10;
      factors.push("pending review");
      break;
    case "deprecated":
      score += 20;
      factors.push("deprecated tool");
      break;
    case "blocked":
      score += 40;
      factors.push("blocked tool");
      break;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score,
    tier: tierFromScore(score),
    factors,
  };
}

export function buildMCPPostureSummary(tools: MCPTool[] = []): MCPPostureSummary {
  return {
    totalTools: tools.length,
    highRiskTools: tools.filter(
      (tool) => tool.risk_tier === "critical" || tool.risk_tier === "high"
    ),
    pendingReviewTools: tools.filter((tool) => tool.approval_status === "pending_review"),
    blockedTools: tools.filter(
      (tool) => tool.approval_status === "blocked" || tool.status === "blocked"
    ),
    unlinkedTools: tools.filter((tool) => !tool.ai_system_id),
  };
}
