export type AIGovernanceRiskTier = "critical" | "high" | "medium" | "low";

export type AISystemStatus = "active" | "archived";

export type AISystemApprovalStatus =
  | "discovered"
  | "under_review"
  | "approved"
  | "blocked"
  | "retired";

export type AISystemSource = "manual" | "discovered" | "import";

export type AIDataSensitivity =
  | "public"
  | "internal"
  | "confidential"
  | "restricted";

export type AITrainingDataUse = "unknown" | "none" | "opt_out" | "allowed";

export type AIRiskAssessmentStatus = "draft" | "completed";

export type AIGovernanceControlPriority = "required" | "recommended";

export type AISystemControlStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "waived";

export type AIEvidenceCategory =
  | "policy"
  | "vendor_review"
  | "security_review"
  | "privacy_review"
  | "approval"
  | "audit_log"
  | "training"
  | "other";

export type AIEvidenceStatus =
  | "draft"
  | "current"
  | "needs_review"
  | "expired";

export type GovernanceReportSnapshotType =
  | "ai_system_readiness"
  | "organization_governance";

export type GovernanceReportDeliveryStatus = "draft" | "final";

export type GovernanceReportReviewStatus =
  | "not_submitted"
  | "needs_review"
  | "approved"
  | "changes_requested";

export type GovernanceReportDeliveryLinkStatus = "active" | "revoked";

export type GovernanceReportSnapshotRemediationStatus =
  | "open"
  | "in_progress"
  | "resolved"
  | "waived";

export type AIFrameworkId =
  | "nist_ai_rmf"
  | "iso_42001"
  | "soc2_readiness"
  | "hipaa_aware"
  | "gdpr_aware"
  | "ccpa_cpra_aware"
  | "eu_ai_act_readiness"
  | "glba_ftc_safeguards"
  | "ferpa_aware"
  | "pci_dss_aware"
  | "iso_27001"
  | "nist_csf";

export type AIFrameworkType =
  | "ai_governance"
  | "security"
  | "privacy"
  | "regulated_data"
  | "audit_readiness";

export type AIFrameworkStatus = "active" | "preview";

export type AIFrameworkDisplayGroup =
  | "ai_governance"
  | "audit_security_readiness"
  | "regulated_data_privacy";

export type AIFrameworkProfile = {
  id: AIFrameworkId;
  label: string;
  shortLabel: string;
  type: AIFrameworkType;
  status: AIFrameworkStatus;
  displayGroup: AIFrameworkDisplayGroup;
  guardrail: string;
  categories: string[];
};

export type AIFrameworkMapping = {
  framework: AIFrameworkId;
  framework_label: string;
  code: string;
  title: string;
  category: string;
};

export type AIFrameworkCoverageItem = {
  framework: AIFrameworkId;
  framework_label: string;
  framework_short_label: string;
  framework_type: AIFrameworkType;
  framework_status: AIFrameworkStatus;
  display_group: AIFrameworkDisplayGroup;
  display_group_label: string;
  guardrail: string;
  code: string;
  title: string;
  category: string;
  totalControls: number;
  openControls: number;
  closedControls: number;
  readinessPercent: number;
};

export type AIFrameworkCoverageGroup = {
  id: AIFrameworkDisplayGroup;
  label: string;
  items: AIFrameworkCoverageItem[];
};

export type RecommendedControl = {
  key: string;
  title: string;
  category: string;
  reason: string;
  priority: AIGovernanceControlPriority;
  framework_mappings?: AIFrameworkMapping[];
};

export type AISystem = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  owner_name: string | null;
  owner_email: string | null;
  department: string | null;
  vendor_name: string | null;
  model_name: string | null;
  use_case: string;
  business_process: string | null;
  data_types: string[] | null;
  data_sensitivity: AIDataSensitivity;
  customer_facing: boolean;
  employee_facing: boolean;
  automated_decisions: boolean;
  human_review_required: boolean;
  training_data_use: AITrainingDataUse;
  status: AISystemStatus;
  approval_status: AISystemApprovalStatus;
  risk_tier: AIGovernanceRiskTier;
  next_review_date: string | null;
  source: AISystemSource;
  connected_app_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AIRiskAssessment = {
  id: string;
  org_id: string;
  ai_system_id: string;
  version: number;
  status: AIRiskAssessmentStatus;
  data_risk_score: number;
  security_risk_score: number;
  regulatory_risk_score: number;
  business_impact_score: number;
  overall_score: number;
  risk_tier: AIGovernanceRiskTier;
  summary: string | null;
  recommended_controls: RecommendedControl[];
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AISystemControl = {
  id: string;
  org_id: string;
  ai_system_id: string;
  control_key: string;
  title: string;
  category: string;
  priority: AIGovernanceControlPriority;
  reason: string | null;
  owner: string | null;
  status: AISystemControlStatus;
  due_date: string | null;
  notes: string | null;
  evidence_url: string | null;
  evidence_text: string | null;
  framework_mappings: AIFrameworkMapping[];
  source_assessment_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AISystemEvidence = {
  id: string;
  org_id: string;
  ai_system_id: string;
  control_id: string | null;
  title: string;
  category: AIEvidenceCategory;
  owner: string | null;
  status: AIEvidenceStatus;
  evidence_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type GovernanceReportSnapshot = {
  id: string;
  org_id: string;
  report_type: GovernanceReportSnapshotType;
  ai_system_id: string | null;
  title: string;
  summary_metrics: Record<string, unknown>;
  snapshot: unknown;
  generated_by: string | null;
  generated_by_email: string | null;
  client_name: string | null;
  prepared_by_note: string | null;
  executive_summary_note: string | null;
  delivery_status: GovernanceReportDeliveryStatus;
  finalized_at: string | null;
  finalized_by: string | null;
  duplicated_from_snapshot_id: string | null;
  review_status: GovernanceReportReviewStatus;
  reviewer_name: string | null;
  reviewer_email: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  pdf_generated_at: string | null;
  pdf_generated_by: string | null;
  pdf_filename: string | null;
  pdf_content_hash: string | null;
  pdf_size_bytes: number | null;
  created_at: string;
};

export type GovernanceReportDeliveryLink = {
  id: string;
  org_id: string;
  snapshot_id: string;
  url_token: string;
  public_url: string;
  status: GovernanceReportDeliveryLinkStatus;
  expires_at: string | null;
  created_by: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  last_opened_at: string | null;
  open_count: number;
  created_at: string;
  updated_at: string;
};

export type GovernanceReportSnapshotRemediation = {
  id: string;
  org_id: string;
  snapshot_id: string;
  title: string;
  owner: string | null;
  status: GovernanceReportSnapshotRemediationStatus;
  due_date: string | null;
  notes: string | null;
  created_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ControlReadinessSummary = {
  total: number;
  open: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  waived: number;
  closed: number;
  readinessPercent: number;
};
