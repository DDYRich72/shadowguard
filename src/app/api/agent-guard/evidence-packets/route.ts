import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { dbErrorResponse } from "@/lib/errors";
import { getMfaSnapshot, adminNeedsAal2, mfaRequiredError } from "@/lib/mfa";
import { clientIp, rateLimit, rateLimited } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import { parseBody, agentEvidencePacketCreateSchema } from "@/lib/api/schemas";
import { buildAgentGuardOperatorCommandCenter } from "@/lib/agent-guard/operator-command-center";
import {
  buildAgentGuardPilotReadinessReport,
  type AgentGuardPilotReadinessPolicy,
} from "@/lib/agent-guard/pilot-readiness-report";
import {
  buildAgentGuardProductionRolloutGuardrails,
  type AgentGuardProductionRolloutExportDestination,
} from "@/lib/agent-guard/production-rollout";
import {
  AGENT_GUARD_ROLLOUT_ACKNOWLEDGEMENT_COPY,
  isMissingRolloutAcknowledgementsTable,
  rolloutAcknowledgementRowToApi,
  type AgentGuardRolloutAcknowledgement,
  type AgentGuardRolloutAcknowledgementRow,
} from "@/lib/agent-guard/rollout-acknowledgements";
import {
  AGENT_GUARD_SOURCE_POLICY_COVERAGE_COPY,
  buildAgentGuardSourcePolicyCoverage,
  type AgentGuardSourceCoverageActivity,
  type AgentGuardSourceCoverageReview,
  type AgentGuardSourceCoverageSource,
} from "@/lib/agent-guard/source-policy-coverage";
import {
  AGENT_GUARD_EVIDENCE_PACKET_COPY,
  agentGuardEvidencePacketRowToApi,
  buildAgentGuardEvidencePacketDraft,
  isMissingAgentGuardEvidencePacketTable,
  type AgentGuardEvidencePacketRow,
} from "@/lib/agent-guard/evidence-packets";
import { agentExportDestinationHealth } from "@/lib/agent-guard/export-health";

type ActivityRow = {
  id: string;
  tool_name: string;
  user_email: string;
  activity_type: string;
  created_at: string;
  risk_level: string;
  blocked: boolean;
  blocked_by_policy_id: string | null;
  metadata: {
    agentGuardSource?: {
      id?: string;
      name?: string;
      environment?: string;
    };
  } | null;
};

type SourceRow = {
  id: string;
  name: string;
  environment: string;
  status: string;
  allowed_tool_names: string[] | null;
};

type PolicyRow = {
  id: string;
  name: string;
  enabled: boolean;
  action: string;
};

type PolicyReviewRow = {
  id: string;
  activity_id: string | null;
  policy_id: string | null;
  policy_name: string;
  policy_action: AgentGuardSourceCoverageReview["policyAction"];
  status: AgentGuardSourceCoverageReview["status"];
  risk_level: string;
  created_at: string;
};

type ExportDestinationRow = {
  id: string;
  name: string;
  status: string;
  automatic_delivery_enabled: boolean;
  dry_run_enabled: boolean;
  health_status?: string;
  health_label?: string;
  last_tested_at: string | null;
};

type ExportAttemptRow = {
  destination_id: string | null;
  status: "succeeded" | "failed" | "dry_run";
  delivery_mode: "manual_test" | "automatic" | "dry_run" | "manual_replay";
  http_status: number | null;
  created_at: string;
};

async function requireEvidencePacketAccess(options: {
  mutate: boolean;
  requireMfa: boolean;
}) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (!hasRole(ctx.role, ["admin", "manager"])) {
    return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  if (options.mutate && options.requireMfa) {
    const mfa = await getMfaSnapshot();
    if (adminNeedsAal2(ctx.role, mfa?.currentLevel ?? "aal1")) {
      return { response: NextResponse.json(mfaRequiredError, { status: 403 }) };
    }
  }
  return { ctx };
}

function packetMigrationRequiredResponse() {
  return NextResponse.json(
    {
      error: "migration_required",
      message: AGENT_GUARD_EVIDENCE_PACKET_COPY.migrationWarning,
      packets: [],
    },
    { status: 503 }
  );
}

function isMissingExportTable(error: { code?: string | null; message?: string | null }) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST205" ||
    error.code === "PGRST204" ||
    message.includes("agent_export_destinations") ||
    message.includes("agent_export_delivery_attempts")
  );
}

function activityRowToCoverage(row: ActivityRow): AgentGuardSourceCoverageActivity {
  return {
    id: row.id,
    toolName: row.tool_name,
    userEmail: row.user_email,
    activityType: row.activity_type,
    timestamp: row.created_at,
    riskLevel: row.risk_level,
    blocked: row.blocked,
    blockedByPolicyId: row.blocked_by_policy_id,
    source: row.metadata?.agentGuardSource
      ? {
          id: row.metadata.agentGuardSource.id ?? "",
          name: row.metadata.agentGuardSource.name ?? "Unknown source",
          environment: row.metadata.agentGuardSource.environment ?? "unknown",
        }
      : null,
  };
}

async function loadExportDestinations(input: {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  orgId: string;
}): Promise<{
  destinations: AgentGuardProductionRolloutExportDestination[];
  warning: string | null;
  error?: { code?: string | null; message?: string | null };
}> {
  const { data: destinationRows, error: destinationError } = await input.supabase
    .from("agent_export_destinations")
    .select(
      "id, name, status, automatic_delivery_enabled, dry_run_enabled, last_tested_at"
    )
    .eq("org_id", input.orgId)
    .order("created_at", { ascending: false });

  if (destinationError) {
    if (isMissingExportTable(destinationError)) {
      return {
        destinations: [],
        warning: "Export destination posture could not be loaded.",
      };
    }
    return { destinations: [], warning: null, error: destinationError };
  }

  const { data: attemptRows, error: attemptError } = await input.supabase
    .from("agent_export_delivery_attempts")
    .select("destination_id, status, delivery_mode, http_status, created_at")
    .eq("org_id", input.orgId)
    .order("created_at", { ascending: false })
    .limit(25);

  if (attemptError) {
    if (isMissingExportTable(attemptError)) {
      return {
        destinations: [],
        warning: "Export destination attempt history could not be loaded.",
      };
    }
    return { destinations: [], warning: null, error: attemptError };
  }

  const latestAttemptByDestination = new Map<string, ExportAttemptRow>();
  for (const attempt of (attemptRows ?? []) as ExportAttemptRow[]) {
    if (!attempt.destination_id) continue;
    if (!latestAttemptByDestination.has(attempt.destination_id)) {
      latestAttemptByDestination.set(attempt.destination_id, attempt);
    }
  }

  return {
    destinations: ((destinationRows ?? []) as ExportDestinationRow[]).map(
      (destination) => {
        const health = agentExportDestinationHealth(
          {
            automatic_delivery_enabled: destination.automatic_delivery_enabled,
            dry_run_enabled: destination.dry_run_enabled,
            status: destination.status as "enabled" | "disabled",
            last_tested_at: destination.last_tested_at,
          },
          latestAttemptByDestination.get(destination.id) ?? null
        );
        return {
          id: destination.id,
          name: destination.name,
          status: destination.status,
          automaticDeliveryEnabled: destination.automatic_delivery_enabled,
          dryRunEnabled: destination.dry_run_enabled,
          healthStatus: health.status,
          healthLabel: health.label,
        };
      }
    ),
    warning: null,
  };
}

async function buildCurrentEvidencePacket(input: {
  orgId: string;
  generatedByEmail: string | null;
  title?: string | null;
}) {
  const supabase = await createServerSupabase();
  const generatedAt = new Date().toISOString();

  const [
    sourcesResult,
    activitiesResult,
    policiesResult,
    reviewsResult,
    exportResult,
    acknowledgementsResult,
  ] = await Promise.all([
    supabase
      .from("agent_ingest_sources")
      .select("id, name, environment, status, allowed_tool_names")
      .eq("org_id", input.orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("agent_activities")
      .select(
        "id, tool_name, user_email, activity_type, created_at, risk_level, blocked, blocked_by_policy_id, metadata"
      )
      .eq("org_id", input.orgId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("agent_policies")
      .select("id, name, enabled, action")
      .eq("org_id", input.orgId)
      .order("priority", { ascending: true }),
    supabase
      .from("agent_policy_decision_reviews")
      .select("id, activity_id, policy_id, policy_name, policy_action, status, risk_level, created_at")
      .eq("org_id", input.orgId)
      .order("created_at", { ascending: false })
      .limit(500),
    loadExportDestinations({ supabase, orgId: input.orgId }),
    supabase
      .from("agent_rollout_acknowledgements")
      .select("*")
      .eq("org_id", input.orgId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (sourcesResult.error) return { error: sourcesResult.error };
  if (activitiesResult.error) return { error: activitiesResult.error };
  if (policiesResult.error) return { error: policiesResult.error };
  if ("error" in exportResult && exportResult.error) {
    return { error: exportResult.error };
  }

  let reviewWarning: string | null = null;
  let reviewRows: PolicyReviewRow[] = [];
  if (reviewsResult.error) {
    const message = reviewsResult.error.message?.toLowerCase() ?? "";
    if (
      reviewsResult.error.code === "PGRST205" ||
      reviewsResult.error.code === "PGRST204" ||
      message.includes("agent_policy_decision_reviews")
    ) {
      reviewWarning = AGENT_GUARD_SOURCE_POLICY_COVERAGE_COPY.reviewMigrationWarning;
    } else {
      return { error: reviewsResult.error };
    }
  } else {
    reviewRows = (reviewsResult.data ?? []) as PolicyReviewRow[];
  }

  let acknowledgementWarning: string | null = null;
  let acknowledgements: AgentGuardRolloutAcknowledgement[] = [];
  if (acknowledgementsResult.error) {
    if (isMissingRolloutAcknowledgementsTable(acknowledgementsResult.error)) {
      acknowledgementWarning =
        AGENT_GUARD_ROLLOUT_ACKNOWLEDGEMENT_COPY.migrationWarning;
    } else {
      return { error: acknowledgementsResult.error };
    }
  } else {
    acknowledgements = (
      (acknowledgementsResult.data ?? []) as AgentGuardRolloutAcknowledgementRow[]
    ).map(rolloutAcknowledgementRowToApi);
  }

  const sources: AgentGuardSourceCoverageSource[] = (
    (sourcesResult.data ?? []) as SourceRow[]
  ).map((source) => ({
    id: source.id,
    name: source.name,
    environment: source.environment,
    status: source.status,
    allowedToolNames: source.allowed_tool_names ?? [],
  }));
  const activities = ((activitiesResult.data ?? []) as ActivityRow[]).map(
    activityRowToCoverage
  );
  const policies: AgentGuardPilotReadinessPolicy[] = (
    (policiesResult.data ?? []) as PolicyRow[]
  ).map((policy) => ({
    id: policy.id,
    name: policy.name,
    enabled: policy.enabled,
    action: policy.action,
  }));
  const reviews: AgentGuardSourceCoverageReview[] = reviewRows.map((review) => ({
    id: review.id,
    activityId: review.activity_id,
    policyId: review.policy_id,
    policyName: review.policy_name,
    policyAction: review.policy_action,
    status: review.status,
    riskLevel: review.risk_level,
    createdAt: review.created_at,
  }));
  const coverage = buildAgentGuardSourcePolicyCoverage({
    sources,
    activities,
    reviews,
  });
  const rollout = buildAgentGuardProductionRolloutGuardrails({
    sources,
    coverageRows: coverage.rows,
    exportDestinations: exportResult.destinations,
  });
  const loadWarnings = [
    reviewWarning,
    exportResult.warning,
    acknowledgementWarning,
  ].filter((warning): warning is string => Boolean(warning));
  const report = buildAgentGuardPilotReadinessReport({
    coverage,
    rollout,
    policies,
    exportDestinations: exportResult.destinations,
    acknowledgements,
    generatedAt,
    loadWarnings,
  });
  const commandCenter = buildAgentGuardOperatorCommandCenter(report);

  return {
    draft: buildAgentGuardEvidencePacketDraft({
      report,
      commandCenter,
      generatedByEmail: input.generatedByEmail,
      title: input.title,
    }),
  };
}

export async function GET(request: NextRequest) {
  const gate = await requireEvidencePacketAccess({
    mutate: false,
    requireMfa: false,
  });
  if ("response" in gate) return gate.response;
  const { ctx } = gate;

  const rl = await rateLimit(`get:agent-evidence-packets:${ctx.orgId}`, 60, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const limit = Math.min(
    Math.max(parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10), 1),
    100
  );

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("agent_evidence_packets")
    .select("*")
    .eq("org_id", ctx.orgId)
    .eq("packet_type", "pilot_readiness")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingAgentGuardEvidencePacketTable(error)) {
      return packetMigrationRequiredResponse();
    }
    return dbErrorResponse(error);
  }

  return NextResponse.json({
    packets: ((data ?? []) as AgentGuardEvidencePacketRow[]).map(
      agentGuardEvidencePacketRowToApi
    ),
    total: data?.length ?? 0,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireEvidencePacketAccess({
    mutate: true,
    requireMfa: true,
  });
  if ("response" in gate) return gate.response;
  const { ctx } = gate;

  const rl = await rateLimit(`create:agent-evidence-packet:${ctx.orgId}`, 10, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const body = await parseBody(request, agentEvidencePacketCreateSchema);
  if (body instanceof NextResponse) return body;

  const built = await buildCurrentEvidencePacket({
    orgId: ctx.orgId,
    generatedByEmail: ctx.email,
    title: body.title,
  });
  if ("error" in built && built.error) return dbErrorResponse(built.error);

  const draft = built.draft;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("agent_evidence_packets")
    .insert({
      org_id: ctx.orgId,
      packet_type: draft.packetType,
      title: draft.title,
      status: draft.status,
      status_label: draft.statusLabel,
      summary: draft.summary,
      readiness_report: draft.readinessReport,
      command_center: draft.commandCenter,
      summary_metrics: draft.summaryMetrics,
      evidence_counts: draft.evidenceCounts,
      load_warnings: draft.loadWarnings,
      packet_text: draft.packetText,
      generated_by_user_id: ctx.userId,
      generated_by_email: ctx.email,
      generated_at: draft.generatedAt,
    })
    .select("*")
    .single();

  if (error) {
    if (isMissingAgentGuardEvidencePacketTable(error)) {
      return packetMigrationRequiredResponse();
    }
    return dbErrorResponse(error);
  }

  await recordAudit(ctx, {
    action: "agent_evidence_packet.create",
    target_type: "agent_evidence_packet",
    target_id: data?.id,
    summary: `Saved AgentGuard evidence packet "${draft.title}"`,
    after: {
      id: data?.id,
      title: draft.title,
      status: draft.status,
      status_label: draft.statusLabel,
      primary_action: draft.summaryMetrics.primaryActionLabel,
      concern_count: draft.summaryMetrics.concernCount,
      load_warning_count: draft.summaryMetrics.loadWarningCount,
    },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json(
    {
      packet: agentGuardEvidencePacketRowToApi(
        data as AgentGuardEvidencePacketRow
      ),
    },
    { status: 201 }
  );
}
