/**
 * Agent Guard — Core Engine
 * Monitors AI tool behavior, classifies data flows, detects risks
 */

// ── Data Classification ──

export type DataSensitivity =
  | "public"
  | "internal"
  | "confidential"
  | "restricted";

export interface DataClassification {
  sensitivity: DataSensitivity;
  categories: string[];
  piiDetected: boolean;
  credentialsDetected: boolean;
  proprietaryDetected: boolean;
  details: string;
}

// Phone patterns target formatted numbers and E.164 only. The old
// \b\d{10,}\b caught any 10+ digit integer — Unix timestamps, order IDs,
// product SKUs, UUIDs-without-dashes — and produced loud false positives.
// Email char class is [A-Za-z]; the old [A-Z|a-z] was the classic
// pipe-in-char-class bug (matched a literal "|").
const PII_PATTERNS = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/, label: "SSN" },
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, label: "Email" },
  { pattern: /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/, label: "Phone Number" },
  { pattern: /\+\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/, label: "Phone Number" },
  { pattern: /\b(?:\d{4}[- ]?){3}\d{4}\b/, label: "Credit Card" },
  { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, label: "IP Address" },
];

const CREDENTIAL_PATTERNS = [
  { pattern: /(?:password|passwd|pwd)\s*[:=]\s*.+/i, label: "Password" },
  { pattern: /(?:api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*.+/i, label: "API Key" },
  { pattern: /(?:token|bearer|jwt)\s*[:=]\s*[A-Za-z0-9._-]+/i, label: "Token" },
  { pattern: /-----BEGIN (?:RSA )?PRIVATE KEY-----/, label: "Private Key" },
  { pattern: /AKIA[0-9A-Z]{16}/, label: "AWS Access Key" },
];

const PROPRIETARY_MARKERS = [
  "proprietary", "confidential", "internal only", "do not share",
  "trade secret", "company confidential", "not for distribution",
  "internal use only", "restricted",
];

export function classifyData(content: string): DataClassification {
  const categories: string[] = [];
  let sensitivity: DataSensitivity = "public";
  let piiDetected = false;
  let credentialsDetected = false;
  let proprietaryDetected = false;

  // Check PII
  for (const { pattern, label } of PII_PATTERNS) {
    if (pattern.test(content)) {
      piiDetected = true;
      categories.push(label);
      sensitivity = "confidential";
    }
  }

  // Check credentials
  for (const { pattern, label } of CREDENTIAL_PATTERNS) {
    if (pattern.test(content)) {
      credentialsDetected = true;
      categories.push(label);
      sensitivity = "restricted";
    }
  }

  // Check proprietary markers
  const lowerContent = content.toLowerCase();
  for (const marker of PROPRIETARY_MARKERS) {
    if (lowerContent.includes(marker)) {
      proprietaryDetected = true;
      categories.push("Proprietary Content");
      if (sensitivity !== "restricted") sensitivity = "confidential";
    }
  }

  // Length heuristic — long prompts often contain context dumps
  if (content.length > 2000 && sensitivity === "public") {
    sensitivity = "internal";
    categories.push("Large Context Block");
  }

  return {
    sensitivity,
    categories,
    piiDetected,
    credentialsDetected,
    proprietaryDetected,
    details: categories.length > 0
      ? `Detected: ${categories.join(", ")}`
      : "No sensitive data detected",
  };
}

// ── Activity Tracking ──

export type ActivityType =
  | "prompt_sent"
  | "response_received"
  | "file_upload"
  | "file_download"
  | "api_call"
  | "data_export"
  | "agent_action"
  | "tool_invocation";

export type RiskLevel = "critical" | "high" | "medium" | "low" | "none";

export interface AgentActivity {
  id: string;
  orgId: string;
  toolName: string;
  toolId: string;
  userId: string;
  userEmail: string;
  activityType: ActivityType;
  timestamp: string;
  dataClassification: DataClassification;
  riskLevel: RiskLevel;
  metadata: Record<string, unknown>;
  blocked: boolean;
  blockReason?: string;
}

export function assessActivityRisk(activity: {
  activityType: ActivityType;
  dataClassification: DataClassification;
}): { riskLevel: RiskLevel; factors: string[] } {
  const factors: string[] = [];
  let score = 0;

  // Activity type risk
  const typeRisk: Record<ActivityType, number> = {
    prompt_sent: 10,
    response_received: 5,
    file_upload: 30,
    file_download: 25,
    api_call: 20,
    data_export: 40,
    agent_action: 35,
    tool_invocation: 25,
  };
  score += typeRisk[activity.activityType] || 10;
  factors.push(`Activity: ${activity.activityType}`);

  // Data sensitivity multiplier
  const sensitivityMultiplier: Record<DataSensitivity, number> = {
    public: 1,
    internal: 1.5,
    confidential: 2.5,
    restricted: 4,
  };
  const mult = sensitivityMultiplier[activity.dataClassification.sensitivity];
  score = Math.round(score * mult);

  if (activity.dataClassification.piiDetected) {
    score += 20;
    factors.push("PII detected in data flow");
  }
  if (activity.dataClassification.credentialsDetected) {
    score += 40;
    factors.push("Credentials detected in data flow");
  }
  if (activity.dataClassification.proprietaryDetected) {
    score += 15;
    factors.push("Proprietary content detected");
  }

  // Cap at 100
  score = Math.min(score, 100);

  let riskLevel: RiskLevel;
  if (score >= 80) riskLevel = "critical";
  else if (score >= 60) riskLevel = "high";
  else if (score >= 35) riskLevel = "medium";
  else if (score >= 15) riskLevel = "low";
  else riskLevel = "none";

  return { riskLevel, factors };
}

// ── Policy Engine ──

export type PolicyAction = "allow" | "warn" | "block" | "quarantine";

export interface AgentPolicy {
  id: string;
  orgId: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number; // Lower = evaluated first
  conditions: PolicyCondition[];
  action: PolicyAction;
  createdAt: string;
  updatedAt: string;
}

export interface AgentPolicyMatch {
  policyId: string;
  policyName: string;
  policyAction: PolicyAction;
  priority: number;
}

export interface PolicyCondition {
  field: "toolName" | "activityType" | "sensitivity" | "riskLevel" | "userEmail" | "dataCategory";
  operator: "equals" | "not_equals" | "contains" | "in" | "gte" | "lte";
  value: string | string[] | number;
}

export function evaluatePolicy(
  policy: AgentPolicy,
  activity: AgentActivity
): PolicyAction | null {
  if (!policy.enabled) return null;

  const allMatch = policy.conditions.every((condition) => {
    const fieldValue = getFieldValue(activity, condition.field);
    return matchCondition(fieldValue, condition);
  });

  return allMatch ? policy.action : null;
}

export function evaluatePolicyMatches(
  activity: AgentActivity,
  policies: AgentPolicy[]
): AgentPolicyMatch[] {
  return [...policies]
    .filter((policy) => policy.enabled)
    .sort((left, right) => left.priority - right.priority)
    .flatMap((policy) => {
      const action = evaluatePolicy(policy, activity);
      return action
        ? [
            {
              policyId: policy.id,
              policyName: policy.name,
              policyAction: action,
              priority: policy.priority,
            },
          ]
        : [];
    });
}

type PolicyFieldValue = string | string[] | number | null;

function getFieldValue(activity: AgentActivity, field: string): PolicyFieldValue {
  switch (field) {
    case "toolName": return activity.toolName;
    case "activityType": return activity.activityType;
    case "sensitivity": return activity.dataClassification.sensitivity;
    case "riskLevel": return activity.riskLevel;
    case "userEmail": return activity.userEmail;
    case "dataCategory": return activity.dataClassification.categories;
    default: return null;
  }
}

function matchCondition(fieldValue: PolicyFieldValue, condition: PolicyCondition): boolean {
  switch (condition.operator) {
    case "equals":
      return fieldValue === condition.value;
    case "not_equals":
      return fieldValue !== condition.value;
    case "contains":
      if (Array.isArray(fieldValue)) {
        return fieldValue.some((v) =>
          String(v).toLowerCase().includes(String(condition.value).toLowerCase())
        );
      }
      return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
    case "in":
      return (
        Array.isArray(condition.value) &&
        typeof fieldValue === "string" &&
        condition.value.includes(fieldValue)
      );
    case "gte":
      return typeof fieldValue === "number" && fieldValue >= (condition.value as number);
    case "lte":
      return typeof fieldValue === "number" && fieldValue <= (condition.value as number);
    default:
      return false;
  }
}

// ── Default Policies ──

export const DEFAULT_POLICIES: Omit<AgentPolicy, "id" | "orgId" | "createdAt" | "updatedAt">[] = [
  {
    name: "Block credential exfiltration",
    description: "Block any activity that sends credentials to an AI tool",
    enabled: true,
    priority: 1,
    conditions: [
      { field: "sensitivity", operator: "equals", value: "restricted" },
    ],
    action: "block",
  },
  {
    name: "Warn on PII exposure",
    description: "Warn when PII is sent to an AI tool",
    enabled: true,
    priority: 2,
    conditions: [
      { field: "dataCategory", operator: "contains", value: "SSN" },
    ],
    action: "warn",
  },
  {
    name: "Block critical risk activities",
    description: "Block any activity classified as critical risk",
    enabled: true,
    priority: 3,
    conditions: [
      { field: "riskLevel", operator: "equals", value: "critical" },
    ],
    action: "block",
  },
  {
    name: "Quarantine file uploads to unknown tools",
    description: "Quarantine file uploads to tools not on the approved list",
    enabled: true,
    priority: 4,
    conditions: [
      { field: "activityType", operator: "equals", value: "file_upload" },
    ],
    action: "quarantine",
  },
  {
    name: "Allow public data to approved tools",
    description: "Allow all traffic to approved tools with public data",
    enabled: true,
    priority: 10,
    conditions: [
      { field: "sensitivity", operator: "equals", value: "public" },
    ],
    action: "allow",
  },
  {
    name: "Bulk usage alert",
    description:
      "Warn when a user submits many prompts in a short window. Disabled by default — enable after tuning the threshold for your team.",
    enabled: false,
    priority: 11,
    conditions: [
      { field: "activityType", operator: "equals", value: "prompt_sent" },
    ],
    action: "warn",
  },
];

// ── Kill Switch ──

export interface KillSwitchResult {
  toolName: string;
  blocked: boolean;
  reason: string;
  timestamp: string;
}

export function shouldKillSwitch(
  activity: AgentActivity,
  policies: AgentPolicy[]
): KillSwitchResult {
  for (const match of evaluatePolicyMatches(activity, policies)) {
    if (match.policyAction === "block") {
      return {
        toolName: activity.toolName,
        blocked: true,
        reason: `Blocked by policy: "${match.policyName}"`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  return {
    toolName: activity.toolName,
    blocked: false,
    reason: "No blocking policy matched",
    timestamp: new Date().toISOString(),
  };
}

// ── Activity Summary ──

export interface ActivitySummary {
  totalActivities: number;
  blockedActivities: number;
  criticalRisk: number;
  highRisk: number;
  piiExposures: number;
  credentialExposures: number;
  topTools: { toolName: string; count: number; riskLevel: RiskLevel }[];
  topUsers: { email: string; count: number; riskLevel: RiskLevel }[];
}

export function summarizeActivities(activities: AgentActivity[]): ActivitySummary {
  const toolCounts: Record<string, { count: number; maxRisk: number }> = {};
  const userCounts: Record<string, { count: number; maxRisk: number }> = {};
  const riskScore: Record<RiskLevel, number> = {
    critical: 100, high: 75, medium: 50, low: 25, none: 0,
  };

  let blockedActivities = 0;
  let criticalRisk = 0;
  let highRisk = 0;
  let piiExposures = 0;
  let credentialExposures = 0;

  for (const a of activities) {
    if (a.blocked) blockedActivities++;
    if (a.riskLevel === "critical") criticalRisk++;
    if (a.riskLevel === "high") highRisk++;
    if (a.dataClassification.piiDetected) piiExposures++;
    if (a.dataClassification.credentialsDetected) credentialExposures++;

    if (!toolCounts[a.toolName]) toolCounts[a.toolName] = { count: 0, maxRisk: 0 };
    toolCounts[a.toolName].count++;
    toolCounts[a.toolName].maxRisk = Math.max(
      toolCounts[a.toolName].maxRisk,
      riskScore[a.riskLevel]
    );

    if (!userCounts[a.userEmail]) userCounts[a.userEmail] = { count: 0, maxRisk: 0 };
    userCounts[a.userEmail].count++;
    userCounts[a.userEmail].maxRisk = Math.max(
      userCounts[a.userEmail].maxRisk,
      riskScore[a.riskLevel]
    );
  }

  const riskLevelFromScore = (score: number): RiskLevel => {
    if (score >= 80) return "critical";
    if (score >= 60) return "high";
    if (score >= 35) return "medium";
    if (score >= 15) return "low";
    return "none";
  };

  return {
    totalActivities: activities.length,
    blockedActivities,
    criticalRisk,
    highRisk,
    piiExposures,
    credentialExposures,
    topTools: Object.entries(toolCounts)
      .sort((a, b) => b[1].maxRisk - a[1].maxRisk)
      .slice(0, 10)
      .map(([toolName, data]) => ({
        toolName,
        count: data.count,
        riskLevel: riskLevelFromScore(data.maxRisk),
      })),
    topUsers: Object.entries(userCounts)
      .sort((a, b) => b[1].maxRisk - a[1].maxRisk)
      .slice(0, 10)
      .map(([email, data]) => ({
        email,
        count: data.count,
        riskLevel: riskLevelFromScore(data.maxRisk),
      })),
  };
}
