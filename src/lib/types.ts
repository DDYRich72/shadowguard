// ── Organization ──
export interface Organization {
  id: string;
  name: string;
  domain: string;
  google_connected: boolean;
  microsoft_connected: boolean;
  created_at: string;
  updated_at: string;
}

// ── User ──
export interface User {
  id: string;
  org_id: string;
  email: string;
  name: string;
  role: "admin" | "manager" | "viewer";
  auth_provider: "google" | "microsoft";
  created_at: string;
}

// ── Connected App (discovered third-party app) ──
export interface ConnectedApp {
  id: string;
  org_id: string;
  app_name: string;
  app_category: string;
  is_ai_tool: boolean;
  risk_score: number;
  risk_level: "critical" | "high" | "medium" | "low";
  permissions: string[];
  connected_users: number;
  status: "active" | "blocked" | "approved" | "pending";
  first_detected: string;
  last_active: string;
}

// ── App Connection (per-user connection to an app) ──
export interface AppConnection {
  id: string;
  app_id: string;
  org_id: string;
  user_email: string;
  user_name: string;
  connected_at: string;
  last_active: string;
  permissions_granted: string[];
}

// ── Risk Score Breakdown ──
export interface RiskScore {
  id: string;
  app_id: string;
  overall: number;
  data_access: number;
  security_posture: number;
  compliance_flags: number;
  adoption_breadth: number;
  calculated_at: string;
}

// ── Alert ──
export interface Alert {
  id: string;
  org_id: string;
  type: "new_app" | "risk_threshold" | "bulk_adoption" | "policy_violation";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  message: string;
  app_name: string;
  user_email?: string;
  acknowledged: boolean;
  created_at: string;
}

// ── Approved Tool ──
export interface ApprovedTool {
  id: string;
  org_id: string;
  app_name: string;
  approved_by: string;
  approved_at: string;
  notes: string;
}

// ── Blocklist Entry ──
export interface BlocklistEntry {
  id: string;
  org_id: string;
  app_name: string;
  blocked_by: string;
  blocked_at: string;
  reason: string;
}

// ── AI Tool Database Entry ──
export interface AIToolEntry {
  name: string;
  aliases: string[];
  category: string;
  data_access_scope: "high" | "medium" | "low";
  has_soc2: boolean;
  has_gdpr: boolean;
  has_hipaa: boolean;
  data_residency: "us" | "eu" | "global" | "unknown";
  risk_base_score: number;
}

// ── Dashboard Stats ──
export interface DashboardStats {
  total_apps: number;
  ai_tools: number;
  critical_risk: number;
  high_risk: number;
  medium_risk: number;
  low_risk: number;
  approved: number;
  blocked: number;
  pending: number;
  unacknowledged_alerts: number;
}
