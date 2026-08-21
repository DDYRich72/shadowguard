-- ShadowGuard + AgentGuard initial database schema
-- Fresh-install schema for self-hosted ShadowGuard.
--
-- Canonical vocabulary:
--   agent_activities.activity_type uses engine values:
--     prompt_sent, response_received, file_upload, file_download,
--     api_call, data_export, agent_action, tool_invocation.
--   The UI maps these to product-facing labels.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Shared helpers ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION update_updated_at() FROM PUBLIC, anon, authenticated;


-- ── Organizations ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  google_connected BOOLEAN DEFAULT FALSE,
  google_access_token TEXT,
  google_refresh_token TEXT,
  google_token_expires_at TIMESTAMPTZ,

  microsoft_connected BOOLEAN DEFAULT FALSE,
  ms_access_token TEXT,
  ms_refresh_token TEXT,
  ms_token_expires_at TIMESTAMPTZ,

  encryption_key_version INTEGER DEFAULT 1,

  settings JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_domain ON organizations(domain);

DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── Users (mirrors auth.users; id MUST equal auth.users.id) ─────────
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('admin', 'manager', 'viewer')),
  auth_provider TEXT NOT NULL DEFAULT 'email'
    CHECK (auth_provider IN ('email', 'google', 'microsoft')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);


-- ── Connected apps (discovered third-party apps) ────────────────────
CREATE TABLE IF NOT EXISTS connected_apps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  app_name TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  app_category TEXT DEFAULT 'Unknown',
  is_ai_tool BOOLEAN DEFAULT FALSE,

  risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level TEXT DEFAULT 'low'
    CHECK (risk_level IN ('critical', 'high', 'medium', 'low')),

  permissions TEXT[] DEFAULT '{}',
  connected_users TEXT[] DEFAULT '{}',
  source_platforms TEXT[] DEFAULT '{}',
  oauth_revocation_targets JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(oauth_revocation_targets) = 'array'),
  oauth_revocation_last_result JSONB,

  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'blocked', 'approved', 'pending')),

  has_soc2 BOOLEAN DEFAULT FALSE,
  has_gdpr BOOLEAN DEFAULT FALSE,
  has_hipaa BOOLEAN DEFAULT FALSE,
  data_residency TEXT DEFAULT 'unknown',

  first_detected TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, canonical_name)
);

CREATE INDEX IF NOT EXISTS idx_connected_apps_org ON connected_apps(org_id);
CREATE INDEX IF NOT EXISTS idx_connected_apps_risk ON connected_apps(risk_level);
CREATE INDEX IF NOT EXISTS idx_connected_apps_status ON connected_apps(status);

DROP TRIGGER IF EXISTS update_connected_apps_updated_at ON connected_apps;
CREATE TRIGGER update_connected_apps_updated_at
  BEFORE UPDATE ON connected_apps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── Risk score breakdown (history) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS risk_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_id UUID NOT NULL REFERENCES connected_apps(id) ON DELETE CASCADE,
  overall INTEGER NOT NULL CHECK (overall >= 0 AND overall <= 100),
  data_access INTEGER NOT NULL CHECK (data_access >= 0 AND data_access <= 100),
  security_posture INTEGER NOT NULL CHECK (security_posture >= 0 AND security_posture <= 100),
  compliance_flags INTEGER NOT NULL CHECK (compliance_flags >= 0 AND compliance_flags <= 100),
  adoption_breadth INTEGER NOT NULL CHECK (adoption_breadth >= 0 AND adoption_breadth <= 100),
  factors TEXT[] DEFAULT '{}',
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_scores_app ON risk_scores(app_id);


-- ── Alerts ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL
    CHECK (type IN ('new_app', 'risk_threshold', 'bulk_adoption', 'policy_violation')),
  severity TEXT NOT NULL
    CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  app_name TEXT,
  user_email TEXT,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_org ON alerts(org_id);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(acknowledged);


-- ── Approved tools / Blocklist ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS approved_tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  app_name TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  notes TEXT,
  approved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, app_name)
);

CREATE TABLE IF NOT EXISTS blocklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  app_name TEXT NOT NULL,
  blocked_by TEXT NOT NULL,
  reason TEXT,
  blocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, app_name)
);


-- ── Scan history ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scan_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  total_apps INTEGER DEFAULT 0,
  ai_tools_found INTEGER DEFAULT 0,
  critical_count INTEGER DEFAULT 0,
  high_count INTEGER DEFAULT 0,
  medium_count INTEGER DEFAULT 0,
  low_count INTEGER DEFAULT 0,
  scan_duration_ms INTEGER,
  scanned_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_history_org ON scan_history(org_id);


-- ── Scan delta: per-scan app results ────────────────────────────────
-- Point-in-time record of every app seen by a scan, so consecutive
-- scans can be diffed (new tools, risk movement, scope expansion).
-- Declared after scan_history so the FKs resolve; the scan_id column
-- on risk_scores is added here for the same reason.
ALTER TABLE risk_scores
  ADD COLUMN IF NOT EXISTS scan_id UUID REFERENCES scan_history(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_risk_scores_scan ON risk_scores(scan_id);

CREATE TABLE IF NOT EXISTS scan_app_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scan_id UUID NOT NULL REFERENCES scan_history(id) ON DELETE CASCADE,
  app_id UUID REFERENCES connected_apps(id) ON DELETE SET NULL,

  canonical_name TEXT NOT NULL,
  app_name TEXT NOT NULL,
  is_ai_tool BOOLEAN DEFAULT FALSE,

  risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level TEXT DEFAULT 'low'
    CHECK (risk_level IN ('critical', 'high', 'medium', 'low')),

  scopes TEXT[] DEFAULT '{}',
  user_count INTEGER DEFAULT 0,
  source_platforms TEXT[] DEFAULT '{}',

  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_app_results_org_scan
  ON scan_app_results(org_id, scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_app_results_org_canonical
  ON scan_app_results(org_id, canonical_name);

ALTER TABLE scan_app_results ENABLE ROW LEVEL SECURITY;



-- ── Agent Guard: policies ───────────────────────────────────────────
-- Declared before agent_activities so the FK below resolves.
CREATE TABLE IF NOT EXISTS agent_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 5,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  action TEXT NOT NULL
    CHECK (action IN ('allow', 'warn', 'block', 'quarantine')),
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_policies_org ON agent_policies(org_id);

DROP TRIGGER IF EXISTS update_agent_policies_updated_at ON agent_policies;
CREATE TRIGGER update_agent_policies_updated_at
  BEFORE UPDATE ON agent_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── Agent Guard: activity log ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  tool_name TEXT NOT NULL,
  tool_id TEXT,
  user_id TEXT,
  user_email TEXT NOT NULL,

  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'prompt_sent', 'response_received',
    'file_upload', 'file_download',
    'api_call', 'data_export',
    'agent_action', 'tool_invocation'
  )),

  data_sensitivity TEXT NOT NULL DEFAULT 'public'
    CHECK (data_sensitivity IN ('public', 'internal', 'confidential', 'restricted')),
  data_categories TEXT[] DEFAULT '{}',
  pii_detected BOOLEAN DEFAULT FALSE,
  credentials_detected BOOLEAN DEFAULT FALSE,
  proprietary_detected BOOLEAN DEFAULT FALSE,

  risk_level TEXT NOT NULL DEFAULT 'none'
    CHECK (risk_level IN ('critical', 'high', 'medium', 'low', 'none')),
  risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),

  blocked BOOLEAN DEFAULT FALSE,
  block_reason TEXT,
  blocked_by_policy_id UUID REFERENCES agent_policies(id) ON DELETE SET NULL,

  metadata JSONB DEFAULT '{}'::jsonb,
  raw_payload JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_activities_org ON agent_activities(org_id);
CREATE INDEX IF NOT EXISTS idx_agent_activities_risk ON agent_activities(risk_level);
CREATE INDEX IF NOT EXISTS idx_agent_activities_tool ON agent_activities(tool_name);
CREATE INDEX IF NOT EXISTS idx_agent_activities_created ON agent_activities(created_at);


-- ── Agent Guard: policy decision review queue ──────────────────────
CREATE TABLE IF NOT EXISTS agent_policy_decision_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES agent_activities(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES agent_policies(id) ON DELETE SET NULL,

  policy_name TEXT NOT NULL,
  policy_action TEXT NOT NULL CHECK (policy_action IN ('warn', 'quarantine')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),

  tool_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'prompt_sent', 'response_received',
    'file_upload', 'file_download',
    'api_call', 'data_export',
    'agent_action', 'tool_invocation'
  )),
  risk_level TEXT NOT NULL DEFAULT 'none'
    CHECK (risk_level IN ('critical', 'high', 'medium', 'low', 'none')),
  data_sensitivity TEXT NOT NULL DEFAULT 'public'
    CHECK (data_sensitivity IN ('public', 'internal', 'confidential', 'restricted')),
  data_categories TEXT[] DEFAULT '{}',

  assigned_to TEXT DEFAULT '',
  review_note TEXT DEFAULT '',
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_policy_reviews_org_status
  ON agent_policy_decision_reviews(org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_policy_reviews_activity
  ON agent_policy_decision_reviews(activity_id);
CREATE INDEX IF NOT EXISTS idx_agent_policy_reviews_policy
  ON agent_policy_decision_reviews(policy_id);

DROP TRIGGER IF EXISTS update_agent_policy_decision_reviews_updated_at
  ON agent_policy_decision_reviews;
CREATE TRIGGER update_agent_policy_decision_reviews_updated_at
  BEFORE UPDATE ON agent_policy_decision_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── Agent Guard: monitored tools ────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'blocked')),
  users_count INTEGER DEFAULT 0,
  total_requests_24h INTEGER DEFAULT 0,
  pii_exposures_24h INTEGER DEFAULT 0,
  data_flows JSONB DEFAULT '[]'::jsonb,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, tool_name)
);

CREATE INDEX IF NOT EXISTS idx_agent_tools_org ON agent_tools(org_id);

DROP TRIGGER IF EXISTS update_agent_tools_updated_at ON agent_tools;
CREATE TRIGGER update_agent_tools_updated_at
  BEFORE UPDATE ON agent_tools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── Agent Guard: ingest sources ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_ingest_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production'
    CHECK (environment IN ('production', 'staging', 'development', 'other')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked')),
  token_hash TEXT NOT NULL UNIQUE,
  token_hint TEXT NOT NULL,
  allowed_tool_names TEXT[] NOT NULL DEFAULT '{}',
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_email TEXT,
  revoked_at TIMESTAMPTZ,
  revoked_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_used_at TIMESTAMPTZ,
  last_used_ip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_ingest_sources_org
  ON agent_ingest_sources(org_id);
CREATE INDEX IF NOT EXISTS idx_agent_ingest_sources_status
  ON agent_ingest_sources(org_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_ingest_sources_hash
  ON agent_ingest_sources(token_hash);

DROP TRIGGER IF EXISTS update_agent_ingest_sources_updated_at ON agent_ingest_sources;
CREATE TRIGGER update_agent_ingest_sources_updated_at
  BEFORE UPDATE ON agent_ingest_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── Agent Guard: export destinations ───────────────────────────────
CREATE TABLE IF NOT EXISTS agent_export_destinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  destination_type TEXT NOT NULL DEFAULT 'webhook'
    CHECK (destination_type IN ('webhook', 'siem')),
  status TEXT NOT NULL DEFAULT 'disabled'
    CHECK (status IN ('enabled', 'disabled')),
  endpoint_url TEXT NOT NULL,
  signing_secret_encrypted TEXT NOT NULL,
  signing_secret_hash TEXT NOT NULL,
  signing_secret_hint TEXT NOT NULL,
  automatic_delivery_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  dry_run_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  event_types TEXT[] NOT NULL DEFAULT ARRAY[
    'agentguard.activity.evaluated',
    'agentguard.policy.blocked',
    'agentguard.review.required'
  ],
  owner_name TEXT NOT NULL DEFAULT '',
  owner_email TEXT NOT NULL DEFAULT '',
  escalation_path TEXT NOT NULL DEFAULT '',
  receiver_acknowledgement_status TEXT NOT NULL DEFAULT 'not_requested'
    CHECK (
      receiver_acknowledgement_status IN (
        'not_requested',
        'requested',
        'confirmed',
        'not_applicable'
      )
    ),
  receiver_acknowledgement_note TEXT NOT NULL DEFAULT '',
  receiver_acknowledged_at TIMESTAMPTZ,
  receiver_acknowledged_by_email TEXT,
  last_automatic_attempt_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_email TEXT,
  last_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_export_destinations
  DROP CONSTRAINT IF EXISTS agent_export_destinations_event_types_check;
ALTER TABLE agent_export_destinations
  ADD CONSTRAINT agent_export_destinations_event_types_check
  CHECK (
    cardinality(event_types) > 0
    AND event_types <@ ARRAY[
      'agentguard.activity.evaluated',
      'agentguard.policy.blocked',
      'agentguard.review.required'
    ]::TEXT[]
  );

CREATE INDEX IF NOT EXISTS idx_agent_export_destinations_org
  ON agent_export_destinations(org_id);
CREATE INDEX IF NOT EXISTS idx_agent_export_destinations_status
  ON agent_export_destinations(org_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_export_destinations_type
  ON agent_export_destinations(org_id, destination_type);
CREATE INDEX IF NOT EXISTS idx_agent_export_destinations_auto
  ON agent_export_destinations(org_id, status, automatic_delivery_enabled);

DROP TRIGGER IF EXISTS update_agent_export_destinations_updated_at
  ON agent_export_destinations;
CREATE TRIGGER update_agent_export_destinations_updated_at
  BEFORE UPDATE ON agent_export_destinations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── Agent Guard: export delivery attempts ──────────────────────────
CREATE TABLE IF NOT EXISTS agent_export_delivery_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  destination_id UUID REFERENCES agent_export_destinations(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('succeeded', 'failed', 'dry_run')),
  delivery_mode TEXT NOT NULL DEFAULT 'manual_test'
    CHECK (delivery_mode IN ('manual_test', 'automatic', 'dry_run', 'manual_replay')),
  replayed_attempt_id UUID REFERENCES agent_export_delivery_attempts(id) ON DELETE SET NULL,
  http_status INTEGER
    CHECK (http_status IS NULL OR (http_status >= 100 AND http_status <= 599)),
  duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  error_message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_export_delivery_attempts_org
  ON agent_export_delivery_attempts(org_id);
CREATE INDEX IF NOT EXISTS idx_agent_export_delivery_attempts_destination
  ON agent_export_delivery_attempts(destination_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_export_delivery_attempts_created
  ON agent_export_delivery_attempts(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_export_delivery_attempts_mode
  ON agent_export_delivery_attempts(org_id, delivery_mode, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_export_delivery_attempts_replayed
  ON agent_export_delivery_attempts(replayed_attempt_id);


-- ── Agent Guard: Slack workflow preview targets ────────────────────
CREATE TABLE IF NOT EXISTS agent_slack_workflow_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'workflow_webhook'
    CHECK (target_type IN ('workflow_webhook', 'incoming_webhook')),
  status TEXT NOT NULL DEFAULT 'disabled'
    CHECK (status IN ('enabled', 'disabled')),
  webhook_url_encrypted TEXT NOT NULL,
  webhook_url_hash TEXT NOT NULL,
  webhook_url_hint TEXT NOT NULL,
  event_types TEXT[] NOT NULL DEFAULT ARRAY[
    'agentguard.policy.blocked',
    'agentguard.review.required'
  ],
  dry_run_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  live_send_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  owner_name TEXT NOT NULL DEFAULT '',
  owner_email TEXT NOT NULL DEFAULT '',
  customer_approval_status TEXT NOT NULL DEFAULT 'not_requested'
    CHECK (
      customer_approval_status IN (
        'not_requested',
        'requested',
        'approved',
        'not_applicable'
      )
    ),
  customer_approval_note TEXT NOT NULL DEFAULT '',
  customer_approved_at TIMESTAMPTZ,
  customer_approved_by_email TEXT,
  user_identifier_mode TEXT NOT NULL DEFAULT 'redacted'
    CHECK (user_identifier_mode IN ('redacted', 'full_email', 'customer_identifier')),
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_email TEXT,
  updated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_email TEXT,
  last_tested_at TIMESTAMPTZ,
  last_successful_test_at TIMESTAMPTZ,
  last_live_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, webhook_url_hash)
);

ALTER TABLE agent_slack_workflow_targets
  DROP CONSTRAINT IF EXISTS agent_slack_workflow_targets_event_types_check;
ALTER TABLE agent_slack_workflow_targets
  ADD CONSTRAINT agent_slack_workflow_targets_event_types_check
  CHECK (
    cardinality(event_types) > 0
    AND event_types <@ ARRAY[
      'agentguard.policy.blocked',
      'agentguard.review.required'
    ]::TEXT[]
  );

CREATE INDEX IF NOT EXISTS idx_agent_slack_workflow_targets_org
  ON agent_slack_workflow_targets(org_id);
CREATE INDEX IF NOT EXISTS idx_agent_slack_workflow_targets_status
  ON agent_slack_workflow_targets(org_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_slack_workflow_targets_live
  ON agent_slack_workflow_targets(org_id, status, live_send_enabled);

DROP TRIGGER IF EXISTS update_agent_slack_workflow_targets_updated_at
  ON agent_slack_workflow_targets;
CREATE TRIGGER update_agent_slack_workflow_targets_updated_at
  BEFORE UPDATE ON agent_slack_workflow_targets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── Agent Guard: Slack workflow preview delivery attempts ──────────
CREATE TABLE IF NOT EXISTS agent_slack_workflow_delivery_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  target_id UUID REFERENCES agent_slack_workflow_targets(id) ON DELETE SET NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL
    CHECK (
      event_type IN (
        'manual_test',
        'agentguard.policy.blocked',
        'agentguard.review.required'
      )
    ),
  status TEXT NOT NULL
    CHECK (status IN ('succeeded', 'failed', 'dry_run')),
  delivery_mode TEXT NOT NULL DEFAULT 'manual_test'
    CHECK (delivery_mode IN ('manual_test', 'automatic', 'dry_run')),
  http_status INTEGER
    CHECK (http_status IS NULL OR (http_status >= 100 AND http_status <= 599)),
  duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  error_message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_slack_workflow_attempts_org
  ON agent_slack_workflow_delivery_attempts(org_id);
CREATE INDEX IF NOT EXISTS idx_agent_slack_workflow_attempts_target
  ON agent_slack_workflow_delivery_attempts(target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_slack_workflow_attempts_created
  ON agent_slack_workflow_delivery_attempts(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_slack_workflow_attempts_mode
  ON agent_slack_workflow_delivery_attempts(org_id, delivery_mode, created_at DESC);


-- ── Agent Guard: production rollout acknowledgements ───────────────
CREATE TABLE IF NOT EXISTS agent_rollout_acknowledgements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id UUID REFERENCES agent_ingest_sources(id) ON DELETE SET NULL,

  source_name TEXT NOT NULL,
  source_environment TEXT NOT NULL
    CHECK (source_environment IN ('production', 'staging', 'development', 'other')),
  source_status TEXT NOT NULL
    CHECK (source_status IN ('active', 'revoked')),

  source_rollout_status TEXT NOT NULL
    CHECK (source_rollout_status IN ('testing', 'ready_for_pilot', 'needs_review', 'live_caution')),
  source_rollout_label TEXT NOT NULL,
  source_next_step TEXT NOT NULL,

  overall_rollout_status TEXT NOT NULL
    CHECK (overall_rollout_status IN ('testing', 'ready_for_pilot', 'needs_review', 'live_caution')),
  overall_rollout_label TEXT NOT NULL,

  export_posture_label TEXT NOT NULL,
  export_warning TEXT,

  checklist_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  metrics_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 1500),

  acknowledged_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_by_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_rollout_acknowledgements_org_created
  ON agent_rollout_acknowledgements(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_rollout_acknowledgements_source_created
  ON agent_rollout_acknowledgements(source_id, created_at DESC);


-- ── Agent Guard: evidence packet history ───────────────────────────
CREATE TABLE IF NOT EXISTS agent_evidence_packets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  packet_type TEXT NOT NULL DEFAULT 'pilot_readiness'
    CHECK (packet_type IN ('pilot_readiness', 'slack_preview')),
  title TEXT NOT NULL CHECK (char_length(title) <= 180),

  status TEXT NOT NULL
    CHECK (status IN ('setup_required', 'ready_for_pilot', 'needs_review', 'live_caution')),
  status_label TEXT NOT NULL,
  summary TEXT NOT NULL,

  readiness_report JSONB NOT NULL DEFAULT '{}'::jsonb,
  command_center JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  load_warnings TEXT[] NOT NULL DEFAULT '{}',
  packet_text TEXT NOT NULL,

  generated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_by_email TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_evidence_packets_org_created
  ON agent_evidence_packets(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_evidence_packets_org_status
  ON agent_evidence_packets(org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_evidence_packets_org_type_created
  ON agent_evidence_packets(org_id, packet_type, created_at DESC);


-- ── Agent Guard: integration evidence ──────────────────────────────
CREATE TABLE IF NOT EXISTS agent_integration_evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id UUID REFERENCES agent_ingest_sources(id) ON DELETE SET NULL,

  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('planned', 'in_progress', 'pilot_ready', 'needs_review', 'retired')),
  title TEXT NOT NULL CHECK (char_length(title) <= 180),
  implementation_owner TEXT NOT NULL DEFAULT '' CHECK (char_length(implementation_owner) <= 160),
  wrapper_location TEXT NOT NULL DEFAULT '' CHECK (char_length(wrapper_location) <= 500),
  evidence_url TEXT NOT NULL DEFAULT '' CHECK (char_length(evidence_url) <= 1000),
  checklist_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 1500),

  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_email TEXT,
  updated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_integration_evidence_org_created
  ON agent_integration_evidence(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_integration_evidence_source_created
  ON agent_integration_evidence(source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_integration_evidence_org_status
  ON agent_integration_evidence(org_id, status, created_at DESC);

DROP TRIGGER IF EXISTS update_agent_integration_evidence_updated_at
  ON agent_integration_evidence;
CREATE TRIGGER update_agent_integration_evidence_updated_at
  BEFORE UPDATE ON agent_integration_evidence
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── Policy documents (generated org AI policies) ────────────────────
CREATE TABLE IF NOT EXISTS policy_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  markdown TEXT NOT NULL,
  industry TEXT,
  risk_tolerance TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, version)
);

CREATE INDEX IF NOT EXISTS idx_policy_documents_org ON policy_documents(org_id);


-- ── AI Governance: system registry ─────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_systems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  owner_name TEXT DEFAULT '',
  owner_email TEXT,
  department TEXT DEFAULT '',
  vendor_name TEXT DEFAULT '',
  model_name TEXT DEFAULT '',
  use_case TEXT NOT NULL,
  business_process TEXT DEFAULT '',
  data_types TEXT[] DEFAULT '{}',
  data_sensitivity TEXT NOT NULL DEFAULT 'internal'
    CHECK (data_sensitivity IN ('public', 'internal', 'confidential', 'restricted')),

  customer_facing BOOLEAN DEFAULT FALSE,
  employee_facing BOOLEAN DEFAULT FALSE,
  automated_decisions BOOLEAN DEFAULT FALSE,
  human_review_required BOOLEAN DEFAULT TRUE,
  training_data_use TEXT NOT NULL DEFAULT 'unknown'
    CHECK (training_data_use IN ('unknown', 'none', 'opt_out', 'allowed')),

  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  approval_status TEXT NOT NULL DEFAULT 'under_review'
    CHECK (approval_status IN ('discovered', 'under_review', 'approved', 'blocked', 'retired')),
  risk_tier TEXT NOT NULL DEFAULT 'low'
    CHECK (risk_tier IN ('critical', 'high', 'medium', 'low')),

  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'discovered', 'import')),
  connected_app_id UUID REFERENCES connected_apps(id) ON DELETE SET NULL,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_systems_org ON ai_systems(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_systems_status ON ai_systems(status);
CREATE INDEX IF NOT EXISTS idx_ai_systems_approval ON ai_systems(approval_status);
CREATE INDEX IF NOT EXISTS idx_ai_systems_risk ON ai_systems(risk_tier);
CREATE INDEX IF NOT EXISTS idx_ai_systems_connected_app ON ai_systems(connected_app_id);

-- Registry review cadence (free registry starter).
ALTER TABLE ai_systems
  ADD COLUMN IF NOT EXISTS next_review_date DATE;

CREATE INDEX IF NOT EXISTS idx_ai_systems_next_review_date
  ON ai_systems(next_review_date)
  WHERE next_review_date IS NOT NULL;

DROP TRIGGER IF EXISTS update_ai_systems_updated_at ON ai_systems;
CREATE TRIGGER update_ai_systems_updated_at
  BEFORE UPDATE ON ai_systems
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── MCP Guard: server/tool inventory and events ───────────────────
CREATE TABLE IF NOT EXISTS mcp_servers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ai_system_id UUID REFERENCES ai_systems(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  server_url TEXT DEFAULT '',
  transport TEXT NOT NULL DEFAULT 'unknown'
    CHECK (transport IN ('stdio', 'http', 'sse', 'websocket', 'unknown', 'other')),
  owner_name TEXT DEFAULT '',
  owner_email TEXT DEFAULT '',
  department TEXT DEFAULT '',
  environment TEXT NOT NULL DEFAULT 'unknown'
    CHECK (environment IN ('production', 'staging', 'development', 'local', 'unknown')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'blocked', 'archived')),
  approval_status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (approval_status IN ('pending_review', 'approved', 'blocked', 'deprecated')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  UNIQUE(org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_mcp_servers_org ON mcp_servers(org_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_status ON mcp_servers(status);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_approval ON mcp_servers(approval_status);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_ai_system ON mcp_servers(ai_system_id);

DROP TRIGGER IF EXISTS update_mcp_servers_updated_at ON mcp_servers;
CREATE TRIGGER update_mcp_servers_updated_at
  BEFORE UPDATE ON mcp_servers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS mcp_tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mcp_server_id UUID NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  ai_system_id UUID REFERENCES ai_systems(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  capability_categories TEXT[] NOT NULL DEFAULT ARRAY['read']
    CHECK (
      capability_categories <@ ARRAY[
        'read',
        'write',
        'execute',
        'data_export',
        'credential_access',
        'admin',
        'external_network',
        'file_access',
        'database_access',
        'custom'
      ]::TEXT[]
    ),
  data_sensitivity TEXT NOT NULL DEFAULT 'internal'
    CHECK (data_sensitivity IN ('public', 'internal', 'confidential', 'restricted')),
  external_access BOOLEAN NOT NULL DEFAULT FALSE,
  write_access BOOLEAN NOT NULL DEFAULT FALSE,
  credential_access BOOLEAN NOT NULL DEFAULT FALSE,
  approval_status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (approval_status IN ('pending_review', 'approved', 'blocked', 'deprecated')),
  risk_tier TEXT NOT NULL DEFAULT 'medium'
    CHECK (risk_tier IN ('critical', 'high', 'medium', 'low')),
  risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  owner_name TEXT DEFAULT '',
  owner_email TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'blocked', 'archived')),
  last_activity_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  UNIQUE(org_id, mcp_server_id, name)
);

CREATE INDEX IF NOT EXISTS idx_mcp_tools_org ON mcp_tools(org_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tools_server ON mcp_tools(mcp_server_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tools_status ON mcp_tools(status);
CREATE INDEX IF NOT EXISTS idx_mcp_tools_approval ON mcp_tools(approval_status);
CREATE INDEX IF NOT EXISTS idx_mcp_tools_risk ON mcp_tools(risk_tier);
CREATE INDEX IF NOT EXISTS idx_mcp_tools_ai_system ON mcp_tools(ai_system_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tools_last_activity ON mcp_tools(last_activity_at DESC)
  WHERE last_activity_at IS NOT NULL;

DROP TRIGGER IF EXISTS update_mcp_tools_updated_at ON mcp_tools;
CREATE TRIGGER update_mcp_tools_updated_at
  BEFORE UPDATE ON mcp_tools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS mcp_tool_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mcp_server_id UUID REFERENCES mcp_servers(id) ON DELETE SET NULL,
  mcp_tool_id UUID REFERENCES mcp_tools(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  server_name TEXT DEFAULT '',
  client_name TEXT DEFAULT '',
  user_email TEXT NOT NULL,
  activity_type TEXT NOT NULL DEFAULT 'tool_invocation',
  data_sensitivity TEXT NOT NULL DEFAULT 'internal'
    CHECK (data_sensitivity IN ('public', 'internal', 'confidential', 'restricted')),
  data_categories TEXT[] NOT NULL DEFAULT '{}',
  pii_detected BOOLEAN NOT NULL DEFAULT FALSE,
  credentials_detected BOOLEAN NOT NULL DEFAULT FALSE,
  proprietary_detected BOOLEAN NOT NULL DEFAULT FALSE,
  risk_level TEXT NOT NULL DEFAULT 'low'
    CHECK (risk_level IN ('critical', 'high', 'medium', 'low')),
  decision TEXT NOT NULL DEFAULT 'allow'
    CHECK (decision IN ('allow', 'warn', 'block', 'quarantine')),
  decision_reason TEXT DEFAULT '',
  blocked_by_policy_id UUID REFERENCES agent_policies(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_tool_events_org ON mcp_tool_events(org_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tool_events_server ON mcp_tool_events(mcp_server_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tool_events_tool ON mcp_tool_events(mcp_tool_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tool_events_risk ON mcp_tool_events(risk_level);
CREATE INDEX IF NOT EXISTS idx_mcp_tool_events_decision ON mcp_tool_events(decision);
CREATE INDEX IF NOT EXISTS idx_mcp_tool_events_created ON mcp_tool_events(created_at DESC);


-- ── AI Governance: risk assessments ────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_risk_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ai_system_id UUID NOT NULL REFERENCES ai_systems(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,

  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('draft', 'completed')),
  data_risk_score INTEGER NOT NULL DEFAULT 0 CHECK (data_risk_score >= 0 AND data_risk_score <= 100),
  security_risk_score INTEGER NOT NULL DEFAULT 0 CHECK (security_risk_score >= 0 AND security_risk_score <= 100),
  regulatory_risk_score INTEGER NOT NULL DEFAULT 0 CHECK (regulatory_risk_score >= 0 AND regulatory_risk_score <= 100),
  business_impact_score INTEGER NOT NULL DEFAULT 0 CHECK (business_impact_score >= 0 AND business_impact_score <= 100),
  overall_score INTEGER NOT NULL DEFAULT 0 CHECK (overall_score >= 0 AND overall_score <= 100),
  risk_tier TEXT NOT NULL DEFAULT 'low'
    CHECK (risk_tier IN ('critical', 'high', 'medium', 'low')),

  summary TEXT DEFAULT '',
  recommended_controls JSONB NOT NULL DEFAULT '[]'::jsonb,

  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(ai_system_id, version)
);

CREATE INDEX IF NOT EXISTS idx_ai_risk_assessments_org ON ai_risk_assessments(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_risk_assessments_system ON ai_risk_assessments(ai_system_id);
CREATE INDEX IF NOT EXISTS idx_ai_risk_assessments_risk ON ai_risk_assessments(risk_tier);

DROP TRIGGER IF EXISTS update_ai_risk_assessments_updated_at ON ai_risk_assessments;
CREATE TRIGGER update_ai_risk_assessments_updated_at
  BEFORE UPDATE ON ai_risk_assessments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


CREATE TABLE IF NOT EXISTS ai_risk_assessment_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES ai_risk_assessments(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  question_text TEXT NOT NULL,
  answer_value JSONB NOT NULL DEFAULT 'null'::jsonb,
  risk_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assessment_id, question_key)
);

CREATE INDEX IF NOT EXISTS idx_ai_risk_assessment_answers_org ON ai_risk_assessment_answers(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_risk_assessment_answers_assessment ON ai_risk_assessment_answers(assessment_id);


-- ── AI Governance: control tasks ──────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_system_controls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ai_system_id UUID NOT NULL REFERENCES ai_systems(id) ON DELETE CASCADE,

  control_key TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  priority TEXT NOT NULL DEFAULT 'required'
    CHECK (priority IN ('required', 'recommended')),
  reason TEXT DEFAULT '',

  owner TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed', 'waived')),
  due_date DATE,
  notes TEXT DEFAULT '',
  evidence_url TEXT DEFAULT '',
  evidence_text TEXT DEFAULT '',
  framework_mappings JSONB NOT NULL DEFAULT '[]'::jsonb,

  source_assessment_id UUID REFERENCES ai_risk_assessments(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, ai_system_id, control_key)
);

CREATE INDEX IF NOT EXISTS idx_ai_system_controls_org ON ai_system_controls(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_system_controls_system ON ai_system_controls(ai_system_id);
CREATE INDEX IF NOT EXISTS idx_ai_system_controls_status ON ai_system_controls(status);
CREATE INDEX IF NOT EXISTS idx_ai_system_controls_due_date ON ai_system_controls(due_date);
CREATE INDEX IF NOT EXISTS idx_ai_system_controls_framework_mappings
  ON ai_system_controls USING GIN (framework_mappings);

DROP TRIGGER IF EXISTS update_ai_system_controls_updated_at ON ai_system_controls;
CREATE TRIGGER update_ai_system_controls_updated_at
  BEFORE UPDATE ON ai_system_controls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── AI Governance: evidence binder ────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_system_evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ai_system_id UUID NOT NULL REFERENCES ai_systems(id) ON DELETE CASCADE,
  control_id UUID REFERENCES ai_system_controls(id) ON DELETE SET NULL,

  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN (
      'policy',
      'vendor_review',
      'security_review',
      'privacy_review',
      'approval',
      'audit_log',
      'training',
      'other'
    )),
  owner TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'current'
    CHECK (status IN ('draft', 'current', 'needs_review', 'expired')),
  evidence_url TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_system_evidence_org ON ai_system_evidence(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_system_evidence_system ON ai_system_evidence(ai_system_id);
CREATE INDEX IF NOT EXISTS idx_ai_system_evidence_control ON ai_system_evidence(control_id);
CREATE INDEX IF NOT EXISTS idx_ai_system_evidence_status ON ai_system_evidence(status);

DROP TRIGGER IF EXISTS update_ai_system_evidence_updated_at ON ai_system_evidence;
CREATE TRIGGER update_ai_system_evidence_updated_at
  BEFORE UPDATE ON ai_system_evidence
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── AI Governance: saved report snapshots ─────────────────────────
CREATE TABLE IF NOT EXISTS governance_report_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL
    CHECK (report_type IN ('ai_system_readiness', 'organization_governance')),
  ai_system_id UUID REFERENCES ai_systems(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot JSONB NOT NULL,
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_by_email TEXT DEFAULT '',
  client_name TEXT DEFAULT '',
  prepared_by_note TEXT DEFAULT '',
  executive_summary_note TEXT DEFAULT '',
  delivery_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (delivery_status IN ('draft', 'final')),
  finalized_at TIMESTAMPTZ,
  finalized_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  duplicated_from_snapshot_id UUID REFERENCES governance_report_snapshots(id) ON DELETE SET NULL,
  review_status TEXT NOT NULL DEFAULT 'not_submitted'
    CHECK (review_status IN ('not_submitted', 'needs_review', 'approved', 'changes_requested')),
  reviewer_name TEXT DEFAULT '',
  reviewer_email TEXT DEFAULT '',
  review_note TEXT DEFAULT '',
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pdf_generated_at TIMESTAMPTZ,
  pdf_generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pdf_filename TEXT DEFAULT '',
  pdf_content_hash TEXT DEFAULT '',
  pdf_size_bytes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_report_snapshots_org ON governance_report_snapshots(org_id);
CREATE INDEX IF NOT EXISTS idx_governance_report_snapshots_type ON governance_report_snapshots(report_type);
CREATE INDEX IF NOT EXISTS idx_governance_report_snapshots_system ON governance_report_snapshots(ai_system_id);
CREATE INDEX IF NOT EXISTS idx_governance_report_snapshots_created ON governance_report_snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_governance_report_snapshots_delivery_status ON governance_report_snapshots(delivery_status);
CREATE INDEX IF NOT EXISTS idx_governance_report_snapshots_duplicate_source ON governance_report_snapshots(duplicated_from_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_governance_report_snapshots_review_status ON governance_report_snapshots(review_status);
CREATE INDEX IF NOT EXISTS idx_governance_report_snapshots_pdf_generated
  ON governance_report_snapshots(pdf_generated_at DESC)
  WHERE pdf_generated_at IS NOT NULL;


-- ── AI Governance: secure client delivery links ───────────────────
CREATE TABLE IF NOT EXISTS governance_report_delivery_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  snapshot_id UUID NOT NULL REFERENCES governance_report_snapshots(id) ON DELETE CASCADE,
  url_token TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked')),
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_opened_at TIMESTAMPTZ,
  open_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_report_delivery_links_org
  ON governance_report_delivery_links(org_id);
CREATE INDEX IF NOT EXISTS idx_governance_report_delivery_links_snapshot
  ON governance_report_delivery_links(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_governance_report_delivery_links_status
  ON governance_report_delivery_links(status);
CREATE INDEX IF NOT EXISTS idx_governance_report_delivery_links_expires
  ON governance_report_delivery_links(expires_at)
  WHERE expires_at IS NOT NULL;

DROP TRIGGER IF EXISTS update_governance_report_delivery_links_updated_at
  ON governance_report_delivery_links;
CREATE TRIGGER update_governance_report_delivery_links_updated_at
  BEFORE UPDATE ON governance_report_delivery_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── AI Governance: report remediation ownership ───────────────────
CREATE TABLE IF NOT EXISTS governance_report_snapshot_remediations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  snapshot_id UUID NOT NULL REFERENCES governance_report_snapshots(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  owner TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'waived')),
  due_date DATE,
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_report_snapshot_remediations_org
  ON governance_report_snapshot_remediations(org_id);
CREATE INDEX IF NOT EXISTS idx_governance_report_snapshot_remediations_snapshot
  ON governance_report_snapshot_remediations(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_governance_report_snapshot_remediations_status
  ON governance_report_snapshot_remediations(status);
CREATE INDEX IF NOT EXISTS idx_governance_report_snapshot_remediations_due
  ON governance_report_snapshot_remediations(due_date)
  WHERE due_date IS NOT NULL;

DROP TRIGGER IF EXISTS update_governance_report_snapshot_remediations_updated_at
  ON governance_report_snapshot_remediations;
CREATE TRIGGER update_governance_report_snapshot_remediations_updated_at
  BEFORE UPDATE ON governance_report_snapshot_remediations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── Audit log ───────────────────────────────────────────────────────
-- One row per admin action: role changes, policy edits, app approve/
-- block/revoke, kill-switch toggles, workspace connect/disconnect.
-- Writes go through createAdminSupabase (service role) so RLS can stay
-- strict — only SELECT is permitted by org members.
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,          -- e.g. "policy.update", "app.block"
  target_type TEXT NOT NULL,     -- e.g. "agent_policy", "connected_app"
  target_id TEXT,                -- UUID or name, stringified
  summary TEXT,                  -- human-readable one-liner
  before_state JSONB,
  after_state JSONB,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_org ON audit_events(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON audit_events(action);


-- ── MFA backup recovery codes ───────────────────────────────────────
-- Supabase Auth ships TOTP factors but no native recovery codes. If a
-- user loses their authenticator, the only workaround would be a
-- service-role intervention — unworkable for self-serve MFA.
--
-- We generate 10 single-use codes at enrollment, store SHA-256 hashes
-- (not the codes themselves), and let the user trade one in to remove
-- their factors and re-enroll. The recovery flow requires an active
-- AAL1 session (i.e. they still know their password) — codes alone
-- cannot bypass auth, only MFA.
CREATE TABLE IF NOT EXISTS mfa_backup_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_backup_codes_user ON mfa_backup_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_backup_codes_unused
  ON mfa_backup_codes(user_id) WHERE used_at IS NULL;


-- ── Row Level Security ──────────────────────────────────────────────
ALTER TABLE organizations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_apps   ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_scores      ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE approved_tools   ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocklist        ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_policies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_policy_decision_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tools      ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_tool_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_ingest_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_export_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_export_delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_slack_workflow_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_slack_workflow_delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_rollout_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_evidence_packets ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_integration_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_systems       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_risk_assessment_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_system_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_system_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_report_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_report_delivery_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_report_snapshot_remediations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_backup_codes ENABLE ROW LEVEL SECURITY;

-- Helper: the signed-in user's org_id.
-- users.id = auth.users.id (enforced on signup).
--
-- MUST be SECURITY DEFINER. Every RLS policy on every table calls this
-- function, including the policy on `users` itself. If the function ran
-- as the caller, the inner `SELECT FROM users` would re-trigger the
-- `users` RLS policy, which calls this function again, which queries
-- users again, which triggers the policy... -> infinite recursion and
-- Postgres `stack depth limit exceeded` on every query.
--
-- SECURITY DEFINER runs the inner SELECT as the function owner
-- (postgres superuser), bypassing RLS on the one internal read. The
-- function is the single trusted chokepoint that every policy
-- references.
--
-- SET search_path is a standard SECURITY DEFINER safety net: stops a
-- schema-shadowing attack where someone creates their own public.users
-- table to hijack the function's meaning.
CREATE OR REPLACE FUNCTION current_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT org_id FROM users WHERE id = auth.uid()
$$;

REVOKE ALL ON FUNCTION current_org_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION current_org_id() TO authenticated;

-- org-scoped: a user can see/manage rows belonging to their own org.
--
-- Each policy is preceded by DROP IF EXISTS so re-running this file
-- against an already-provisioned project replaces the policy in place
-- rather than erroring on the duplicate. (Postgres < 17 has no
-- CREATE POLICY IF NOT EXISTS, and Supabase tracks the PG major
-- behind the latest stable release.)
DROP POLICY IF EXISTS "org members read org" ON organizations;
CREATE POLICY "org members read org"
  ON organizations FOR SELECT USING (id = current_org_id());

DROP POLICY IF EXISTS "org members manage users" ON users;
CREATE POLICY "org members manage users"
  ON users FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: connected_apps" ON connected_apps;
CREATE POLICY "org scoped: connected_apps"
  ON connected_apps FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: risk_scores" ON risk_scores;
CREATE POLICY "org scoped: risk_scores"
  ON risk_scores FOR ALL USING (
    app_id IN (SELECT id FROM connected_apps WHERE org_id = current_org_id())
  );

DROP POLICY IF EXISTS "org scoped: alerts" ON alerts;
CREATE POLICY "org scoped: alerts"
  ON alerts FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: approved_tools" ON approved_tools;
CREATE POLICY "org scoped: approved_tools"
  ON approved_tools FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: blocklist" ON blocklist;
CREATE POLICY "org scoped: blocklist"
  ON blocklist FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: scan_history" ON scan_history;
CREATE POLICY "org scoped: scan_history"
  ON scan_history FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: agent_activities" ON agent_activities;
CREATE POLICY "org scoped: agent_activities"
  ON agent_activities FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: agent_policies" ON agent_policies;
CREATE POLICY "org scoped: agent_policies"
  ON agent_policies FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: agent_policy_decision_reviews" ON agent_policy_decision_reviews;
CREATE POLICY "org scoped: agent_policy_decision_reviews"
  ON agent_policy_decision_reviews FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: agent_tools" ON agent_tools;
CREATE POLICY "org scoped: agent_tools"
  ON agent_tools FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: mcp_servers" ON mcp_servers;
CREATE POLICY "org scoped: mcp_servers"
  ON mcp_servers FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: mcp_tools" ON mcp_tools;
CREATE POLICY "org scoped: mcp_tools"
  ON mcp_tools FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: mcp_tool_events" ON mcp_tool_events;
CREATE POLICY "org scoped: mcp_tool_events"
  ON mcp_tool_events FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: agent_ingest_sources" ON agent_ingest_sources;
CREATE POLICY "org scoped: agent_ingest_sources"
  ON agent_ingest_sources FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: agent_export_destinations" ON agent_export_destinations;
CREATE POLICY "org scoped: agent_export_destinations"
  ON agent_export_destinations FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: agent_export_delivery_attempts" ON agent_export_delivery_attempts;
CREATE POLICY "org scoped: agent_export_delivery_attempts"
  ON agent_export_delivery_attempts FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: agent_slack_workflow_targets" ON agent_slack_workflow_targets;
CREATE POLICY "org scoped: agent_slack_workflow_targets"
  ON agent_slack_workflow_targets FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: agent_slack_workflow_delivery_attempts" ON agent_slack_workflow_delivery_attempts;
CREATE POLICY "org scoped: agent_slack_workflow_delivery_attempts"
  ON agent_slack_workflow_delivery_attempts FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: agent_rollout_acknowledgements" ON agent_rollout_acknowledgements;
CREATE POLICY "org scoped: agent_rollout_acknowledgements"
  ON agent_rollout_acknowledgements FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: agent_evidence_packets" ON agent_evidence_packets;
CREATE POLICY "org scoped: agent_evidence_packets"
  ON agent_evidence_packets FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: agent_integration_evidence" ON agent_integration_evidence;
CREATE POLICY "org scoped: agent_integration_evidence"
  ON agent_integration_evidence FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: policy_documents" ON policy_documents;
CREATE POLICY "org scoped: policy_documents"
  ON policy_documents FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: ai_systems" ON ai_systems;
CREATE POLICY "org scoped: ai_systems"
  ON ai_systems FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: ai_risk_assessments" ON ai_risk_assessments;
CREATE POLICY "org scoped: ai_risk_assessments"
  ON ai_risk_assessments FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: ai_risk_assessment_answers" ON ai_risk_assessment_answers;
CREATE POLICY "org scoped: ai_risk_assessment_answers"
  ON ai_risk_assessment_answers FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: ai_system_controls" ON ai_system_controls;
CREATE POLICY "org scoped: ai_system_controls"
  ON ai_system_controls FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: ai_system_evidence" ON ai_system_evidence;
CREATE POLICY "org scoped: ai_system_evidence"
  ON ai_system_evidence FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: governance_report_snapshots" ON governance_report_snapshots;
CREATE POLICY "org scoped: governance_report_snapshots"
  ON governance_report_snapshots FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: governance_report_delivery_links" ON governance_report_delivery_links;
CREATE POLICY "org scoped: governance_report_delivery_links"
  ON governance_report_delivery_links FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: governance_report_snapshot_remediations" ON governance_report_snapshot_remediations;
CREATE POLICY "org scoped: governance_report_snapshot_remediations"
  ON governance_report_snapshot_remediations FOR ALL USING (org_id = current_org_id());

DROP POLICY IF EXISTS "org scoped: audit_events" ON audit_events;
CREATE POLICY "org scoped: audit_events"
  ON audit_events FOR SELECT USING (org_id = current_org_id());
-- audit_events writes are performed by the service role only.

-- MFA backup codes are per-user, not per-org. The user can read their
-- own row count (so the UI can show "3 of 10 codes remaining") but
-- never the hashes themselves — those are write-only via service role.
DROP POLICY IF EXISTS "users read own backup code metadata" ON mfa_backup_codes;
CREATE POLICY "users read own backup code metadata"
  ON mfa_backup_codes FOR SELECT USING (user_id = auth.uid());
-- backup-code writes (generate, mark used) are service-role only.


-- ── Role and MFA-aware RLS helpers ──────────────────────────────────
-- Org members can read org-scoped rows. Direct Supabase mutations require
-- an admin/manager role with AAL2 unless a trusted service-role path owns
-- the write.
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role FROM users WHERE id = auth.uid()
$$;

REVOKE ALL ON FUNCTION current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION current_user_role() TO authenticated;

CREATE OR REPLACE FUNCTION current_user_can_mutate_org()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(current_user_role() IN ('admin', 'manager'), FALSE)
    AND COALESCE((auth.jwt() ->> 'aal') = 'aal2', FALSE)
$$;

REVOKE ALL ON FUNCTION current_user_can_mutate_org() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION current_user_can_mutate_org() TO authenticated;

CREATE OR REPLACE FUNCTION current_user_has_aal2()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((auth.jwt() ->> 'aal') = 'aal2', FALSE)
$$;

REVOKE ALL ON FUNCTION current_user_has_aal2() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION current_user_has_aal2() TO authenticated;

CREATE OR REPLACE FUNCTION current_user_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(current_user_role() = 'admin', FALSE)
$$;

REVOKE ALL ON FUNCTION current_user_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION current_user_is_admin() TO authenticated;

-- Deliberate team membership assignment is a database-operator action, not an
-- application RPC. Keeping the procedure outside the exposed public schema and
-- revoking every API role prevents cross-organization administration through a
-- user session or leaked service-role credential.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.assign_organization_member(
  target_user_id UUID,
  target_org_id UUID,
  target_role TEXT,
  expected_current_org_id UUID
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  target_email TEXT;
  target_provider TEXT;
  current_member_org_id UUID;
  current_member_role TEXT;
  assigned_member public.users;
BEGIN
  IF target_role NOT IN ('viewer', 'manager', 'admin') THEN
    RAISE EXCEPTION 'invalid organization role' USING ERRCODE = '22023';
  END IF;

  IF expected_current_org_id IS NULL THEN
    RAISE EXCEPTION 'expected current organization is required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = target_org_id) THEN
    RAISE EXCEPTION 'target organization not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT
    auth_user.email,
    CASE
      WHEN auth_user.raw_app_meta_data ->> 'provider' IN ('google', 'microsoft')
        THEN auth_user.raw_app_meta_data ->> 'provider'
      ELSE 'email'
    END,
    member.org_id,
    member.role
  INTO target_email, target_provider, current_member_org_id, current_member_role
  FROM public.users AS member
  JOIN auth.users AS auth_user ON auth_user.id = member.id
  WHERE member.id = target_user_id
    AND auth_user.email_confirmed_at IS NOT NULL
  FOR UPDATE OF member;

  IF target_email IS NULL THEN
    RAISE EXCEPTION 'verified bootstrapped user not found' USING ERRCODE = 'P0002';
  END IF;

  IF current_member_org_id IS DISTINCT FROM expected_current_org_id THEN
    RAISE EXCEPTION 'current organization does not match operator expectation'
      USING ERRCODE = '40001';
  END IF;

  UPDATE public.users
  SET org_id = target_org_id,
      email = target_email,
      role = target_role,
      auth_provider = target_provider
  WHERE id = target_user_id
  RETURNING * INTO assigned_member;

  INSERT INTO public.audit_events (
    org_id,
    action,
    target_type,
    target_id,
    summary,
    before_state,
    after_state
  ) VALUES (
    target_org_id,
    'organization.member.assign',
    'user',
    target_user_id::TEXT,
    'Database operator assigned a verified user to an organization.',
    jsonb_build_object('org_id', current_member_org_id, 'role', current_member_role),
    jsonb_build_object('org_id', target_org_id, 'role', target_role)
  );

  RETURN assigned_member;
END;
$$;

REVOKE ALL ON FUNCTION private.assign_organization_member(UUID, UUID, TEXT, UUID)
  FROM PUBLIC, anon, authenticated, service_role;

DROP POLICY IF EXISTS "org members manage users" ON users;
DROP POLICY IF EXISTS "org members read users" ON users;
DROP POLICY IF EXISTS "org admins mutate users" ON users;
CREATE POLICY "org members read users"
  ON users FOR SELECT USING (org_id = current_org_id());
CREATE POLICY "org admins mutate users"
  ON users FOR ALL
  USING (org_id = current_org_id() AND current_user_is_admin() AND current_user_has_aal2())
  WITH CHECK (org_id = current_org_id() AND current_user_is_admin() AND current_user_has_aal2());

DROP POLICY IF EXISTS "org scoped: risk_scores" ON risk_scores;
DROP POLICY IF EXISTS "org members read risk_scores" ON risk_scores;
DROP POLICY IF EXISTS "org managers mutate risk_scores" ON risk_scores;
CREATE POLICY "org members read risk_scores"
  ON risk_scores FOR SELECT USING (
    app_id IN (SELECT id FROM connected_apps WHERE org_id = current_org_id())
  );
CREATE POLICY "org managers mutate risk_scores"
  ON risk_scores FOR ALL
  USING (
    app_id IN (SELECT id FROM connected_apps WHERE org_id = current_org_id())
    AND current_user_can_mutate_org()
  )
  WITH CHECK (
    app_id IN (SELECT id FROM connected_apps WHERE org_id = current_org_id())
    AND current_user_can_mutate_org()
  );

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'connected_apps',
    'alerts',
    'approved_tools',
    'blocklist',
    'scan_history',
    'agent_activities',
    'agent_policies',
    'agent_policy_decision_reviews',
    'agent_tools',
    'mcp_servers',
    'mcp_tools',
    'mcp_tool_events',
    'agent_ingest_sources',
    'agent_export_destinations',
    'agent_export_delivery_attempts',
    'agent_slack_workflow_targets',
    'agent_slack_workflow_delivery_attempts',
    'agent_rollout_acknowledgements',
    'agent_evidence_packets',
    'agent_integration_evidence',
    'policy_documents',
    'ai_systems',
    'ai_risk_assessments',
    'ai_risk_assessment_answers',
    'ai_system_controls',
    'ai_system_evidence',
    'governance_report_snapshots',
    'governance_report_delivery_links',
    'governance_report_snapshot_remediations',
    'scan_app_results'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'org scoped: ' || table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'org members read ' || table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'org managers mutate ' || table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING (org_id = current_org_id())',
      'org members read ' || table_name,
      table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (org_id = current_org_id() AND current_user_can_mutate_org()) WITH CHECK (org_id = current_org_id() AND current_user_can_mutate_org())',
      'org managers mutate ' || table_name,
      table_name
    );
  END LOOP;
END $$;

-- Data API exposure is explicit. Anonymous callers receive no public
-- table access; authenticated access remains constrained by RLS.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
