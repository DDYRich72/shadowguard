import { AIToolEntry } from "./types";

interface RiskScoreResult {
  overall: number;
  data_access: number;
  security_posture: number;
  compliance_flags: number;
  adoption_breadth: number;
  risk_level: "critical" | "high" | "medium" | "low";
  factors: string[];
}

// Weight distribution for risk scoring
const WEIGHTS = {
  data_access: 0.35,
  security_posture: 0.3,
  compliance_flags: 0.2,
  adoption_breadth: 0.15,
};

/**
 * Calculate risk score for a connected AI tool
 */
export function calculateRiskScore(
  tool: AIToolEntry,
  permissions: string[],
  connectedUsers: number,
  totalOrgUsers: number
): RiskScoreResult {
  const factors: string[] = [];

  // ── Data Access Score (0-100) ──
  let dataAccess = 0;
  const permissionRisk = assessPermissions(permissions);
  const scopeRisk =
    tool.data_access_scope === "high" ? 80 : tool.data_access_scope === "medium" ? 50 : 25;

  dataAccess = Math.round(permissionRisk * 0.6 + scopeRisk * 0.4);

  if (dataAccess >= 70) {
    factors.push("High data access scope — can read emails, files, or messages");
  } else if (dataAccess >= 40) {
    factors.push("Moderate data access — limited to specific resources");
  }

  // ── Security Posture Score (0-100, higher = worse) ──
  let securityPosture = 100; // Start at max risk
  if (tool.has_soc2) securityPosture -= 35;
  if (tool.has_gdpr) securityPosture -= 15;
  securityPosture = Math.max(0, securityPosture);

  if (securityPosture >= 70) {
    factors.push("No SOC 2 or security certifications verified");
  } else if (tool.has_soc2) {
    factors.push("SOC 2 certified — reduces risk");
  }

  // ── Compliance Flags Score (0-100, higher = worse) ──
  let complianceFlags = 60; // Base compliance concern
  if (tool.has_hipaa) complianceFlags -= 25;
  if (tool.has_gdpr) complianceFlags -= 15;
  if (tool.data_residency === "unknown") complianceFlags += 30;
  if (tool.data_residency === "global") complianceFlags -= 5;
  if (tool.data_residency === "eu") complianceFlags -= 10;
  complianceFlags = Math.max(0, Math.min(100, complianceFlags));

  if (complianceFlags >= 60) {
    factors.push("Compliance posture unclear — no HIPAA/GDPR verification");
  }
  if (tool.data_residency === "unknown") {
    factors.push("Data residency unknown — may store data in non-compliant regions");
  }

  // ── Adoption Breadth Score (0-100) ──
  const adoptionRatio = totalOrgUsers > 0 ? connectedUsers / totalOrgUsers : 0;
  const adoptionBreadth = Math.round(adoptionRatio * 100);

  if (adoptionRatio >= 0.3) {
    factors.push(`Used by ${Math.round(adoptionRatio * 100)}% of organization — widespread adoption`);
  } else if (adoptionRatio >= 0.1) {
    factors.push(`Used by ${connectedUsers} employees — moderate adoption`);
  }

  // ── Overall Score ──
  const overall = Math.round(
    dataAccess * WEIGHTS.data_access +
    securityPosture * WEIGHTS.security_posture +
    complianceFlags * WEIGHTS.compliance_flags +
    adoptionBreadth * WEIGHTS.adoption_breadth
  );

  // ── Risk Level ──
  let risk_level: "critical" | "high" | "medium" | "low";
  if (overall >= 80) risk_level = "critical";
  else if (overall >= 60) risk_level = "high";
  else if (overall >= 40) risk_level = "medium";
  else risk_level = "low";

  return {
    overall: Math.min(100, Math.max(0, overall)),
    data_access: Math.min(100, Math.max(0, dataAccess)),
    security_posture: Math.min(100, Math.max(0, securityPosture)),
    compliance_flags: Math.min(100, Math.max(0, complianceFlags)),
    adoption_breadth: Math.min(100, Math.max(0, adoptionBreadth)),
    risk_level,
    factors,
  };
}

/**
 * Assess risk level of OAuth permissions granted to an app
 */
function assessPermissions(permissions: string[]): number {
  let score = 0;
  const permissionLower = permissions.map((p) => p.toLowerCase());

  // High-risk permissions
  const highRisk = [
    "mail.read", "mail.send", "gmail.read", "gmail.send",
    "drive.read", "drive.write", "docs.readonly", "spreadsheets.readonly",
    "calendar.read", "calendar.write",
    "contacts.read", "directory.readonly",
    "userinfo.email", "userinfo.profile",
  ];

  // Medium-risk permissions
  const mediumRisk = [
    "profile", "email", "openid",
    "drive.metadata.readonly",
    "tasks.readonly",
    "photos.readonly",
  ];

  for (const perm of permissionLower) {
    if (highRisk.some((hr) => perm.includes(hr))) {
      score += 20;
    } else if (mediumRisk.some((mr) => perm.includes(mr))) {
      score += 10;
    }
  }

  return Math.min(100, score);
}

/**
 * Get color class for risk level
 */
export function getRiskColor(level: "critical" | "high" | "medium" | "low"): string {
  switch (level) {
    case "critical":
      return "bg-[color:var(--risk)] text-white border-transparent";
    case "high":
      return "bg-[color:var(--risk)]/85 text-white border-transparent";
    case "medium":
      return "bg-[color:var(--warning)]/20 text-[color:var(--warning)] border-[color:var(--warning)]/30";
    case "low":
      return "bg-muted text-muted-foreground border-border";
  }
}

/**
 * Get badge variant for risk level
 */
export function getRiskBadgeVariant(level: "critical" | "high" | "medium" | "low"): "default" | "secondary" | "destructive" | "outline" {
  switch (level) {
    case "critical": return "destructive";
    case "high": return "destructive";
    case "medium": return "outline";
    case "low": return "secondary";
  }
}
