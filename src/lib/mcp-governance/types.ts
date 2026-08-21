import type { AIDataSensitivity, AIGovernanceRiskTier } from "@/lib/ai-governance/types";
import type { PolicyAction, RiskLevel } from "@/lib/agent-guard/engine";

export type MCPTransport =
  | "stdio"
  | "http"
  | "sse"
  | "websocket"
  | "unknown"
  | "other";

export type MCPEnvironment =
  | "production"
  | "staging"
  | "development"
  | "local"
  | "unknown";

export type MCPRecordStatus = "active" | "paused" | "blocked" | "archived";

export type MCPApprovalStatus =
  | "pending_review"
  | "approved"
  | "blocked"
  | "deprecated";

export type MCPCapabilityCategory =
  | "read"
  | "write"
  | "execute"
  | "data_export"
  | "credential_access"
  | "admin"
  | "external_network"
  | "file_access"
  | "database_access"
  | "custom";

export type MCPServer = {
  id: string;
  org_id: string;
  ai_system_id: string | null;
  name: string;
  description: string | null;
  server_url: string | null;
  transport: MCPTransport;
  owner_name: string | null;
  owner_email: string | null;
  department: string | null;
  environment: MCPEnvironment;
  status: MCPRecordStatus;
  approval_status: MCPApprovalStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type MCPTool = {
  id: string;
  org_id: string;
  mcp_server_id: string;
  ai_system_id: string | null;
  name: string;
  description: string | null;
  capability_categories: MCPCapabilityCategory[];
  data_sensitivity: AIDataSensitivity;
  external_access: boolean;
  write_access: boolean;
  credential_access: boolean;
  approval_status: MCPApprovalStatus;
  risk_tier: AIGovernanceRiskTier;
  risk_score: number;
  owner_name: string | null;
  owner_email: string | null;
  status: MCPRecordStatus;
  last_activity_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type MCPToolEventDecision = PolicyAction;

export type MCPToolEvent = {
  id: string;
  org_id: string;
  mcp_server_id: string | null;
  mcp_tool_id: string | null;
  tool_name: string;
  server_name: string | null;
  client_name: string | null;
  user_email: string;
  activity_type: string;
  data_sensitivity: AIDataSensitivity;
  data_categories: string[];
  pii_detected: boolean;
  credentials_detected: boolean;
  proprietary_detected: boolean;
  risk_level: RiskLevel;
  decision: MCPToolEventDecision;
  decision_reason: string | null;
  blocked_by_policy_id: string | null;
  metadata: Record<string, unknown>;
  raw_payload: Record<string, unknown>;
  created_at: string;
};

export type MCPToolRiskInput = {
  capabilityCategories: MCPCapabilityCategory[];
  dataSensitivity: AIDataSensitivity;
  externalAccess: boolean;
  writeAccess: boolean;
  credentialAccess: boolean;
  approvalStatus: MCPApprovalStatus;
};

export type MCPToolRiskResult = {
  score: number;
  tier: AIGovernanceRiskTier;
  factors: string[];
};

export type MCPPostureSummary = {
  totalTools: number;
  highRiskTools: MCPTool[];
  pendingReviewTools: MCPTool[];
  blockedTools: MCPTool[];
  unlinkedTools: MCPTool[];
};
