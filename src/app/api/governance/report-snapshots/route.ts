import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  governanceReportSnapshotCreateSchema,
  parseBody,
} from "@/lib/api/schemas";
import { dbErrorResponse } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { adminNeedsAal2, getMfaSnapshot, mfaRequiredError } from "@/lib/mfa";
import { buildGovernanceReadinessReport } from "@/lib/ai-governance/report";
import { buildPortfolioGovernanceReport } from "@/lib/ai-governance/portfolio-report";
import { fetchLatestScanDeltaSection } from "@/lib/ai-governance/scan-delta.server";
import {
  defaultSnapshotTitle,
  summaryForPortfolioReport,
  summaryForReadinessReport,
} from "@/lib/ai-governance/snapshots";
import type {
  AIRiskAssessment,
  AISystem,
  AISystemControl,
  AISystemEvidence,
  GovernanceReportSnapshotType,
} from "@/lib/ai-governance/types";
import type { MCPTool } from "@/lib/mcp-governance/types";

function isMissingSnapshotTable(error: { code?: string | null; message?: string | null }) {
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "PGRST205" || message.includes("governance_report_snapshots");
}

function isMissingMcpTable(error: { code?: string | null; message?: string | null }) {
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "PGRST205" || message.includes("mcp_tools");
}

function migrationRequiredResponse() {
  return NextResponse.json(
    {
      error: "migration_required",
      message:
        "Required database schema is unavailable. Apply the bundled initial migration and retry.",
    },
    { status: 503 }
  );
}

async function requireMutation() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (!hasRole(ctx.role, ["admin", "manager"])) {
    return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  const mfa = await getMfaSnapshot();
  if (adminNeedsAal2(ctx.role, mfa?.currentLevel ?? "aal1")) {
    return { response: NextResponse.json(mfaRequiredError, { status: 403 }) };
  }
  return { ctx };
}

async function buildReadinessSnapshot(params: {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  orgId: string;
  aiSystemId: string;
  generatedAt: string;
}) {
  const { supabase, orgId, aiSystemId, generatedAt } = params;
  const { data: system, error: systemError } = await supabase
    .from("ai_systems")
    .select("*")
    .eq("id", aiSystemId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (systemError) return { error: systemError };
  if (!system) return { notFound: true };

  const { data: latestAssessment, error: assessmentError } = await supabase
    .from("ai_risk_assessments")
    .select("*")
    .eq("ai_system_id", aiSystemId)
    .eq("org_id", orgId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (assessmentError) return { error: assessmentError };

  const { data: controls, error: controlsError } = await supabase
    .from("ai_system_controls")
    .select("*")
    .eq("ai_system_id", aiSystemId)
    .eq("org_id", orgId)
    .order("status", { ascending: false })
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  if (controlsError) return { error: controlsError };

  const { data: evidence, error: evidenceError } = await supabase
    .from("ai_system_evidence")
    .select("*")
    .eq("ai_system_id", aiSystemId)
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });

  if (evidenceError) return { error: evidenceError };

  const report = buildGovernanceReadinessReport({
    system: system as AISystem,
    latestAssessment: (latestAssessment as AIRiskAssessment | null) ?? null,
    controls: (controls ?? []) as AISystemControl[],
    evidenceRecords: (evidence ?? []) as AISystemEvidence[],
    generatedAt,
  });

  return {
    report,
    titleSystemName: report.system.name,
    summaryMetrics: summaryForReadinessReport(report),
  };
}

async function buildPortfolioSnapshot(params: {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  orgId: string;
  generatedAt: string;
}) {
  const { supabase, orgId, generatedAt } = params;
  const { data: systems, error: systemsError } = await supabase
    .from("ai_systems")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "active")
    .order("updated_at", { ascending: false });

  if (systemsError) return { error: systemsError };

  const systemRows = (systems ?? []) as AISystem[];
  const systemIds = systemRows.map((system) => system.id);
  let assessmentRows: AIRiskAssessment[] = [];
  let controlRows: AISystemControl[] = [];
  let evidenceRows: AISystemEvidence[] = [];
  let mcpToolRows: MCPTool[] = [];

  if (systemIds.length > 0) {
    const { data: assessments, error: assessmentsError } = await supabase
      .from("ai_risk_assessments")
      .select("*")
      .eq("org_id", orgId)
      .in("ai_system_id", systemIds)
      .order("version", { ascending: false });

    if (assessmentsError) return { error: assessmentsError };
    assessmentRows = (assessments ?? []) as AIRiskAssessment[];

    const { data: controls, error: controlsError } = await supabase
      .from("ai_system_controls")
      .select("*")
      .eq("org_id", orgId)
      .in("ai_system_id", systemIds)
      .order("status", { ascending: false })
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true });

    if (controlsError) return { error: controlsError };
    controlRows = (controls ?? []) as AISystemControl[];

    const { data: evidence, error: evidenceError } = await supabase
      .from("ai_system_evidence")
      .select("*")
      .eq("org_id", orgId)
      .in("ai_system_id", systemIds)
      .order("updated_at", { ascending: false });

    if (evidenceError) return { error: evidenceError };
    evidenceRows = (evidence ?? []) as AISystemEvidence[];
  }

  const { data: mcpTools, error: mcpToolsError } = await supabase
    .from("mcp_tools")
    .select("*")
    .eq("org_id", orgId)
    .neq("status", "archived")
    .order("risk_score", { ascending: false });

  if (mcpToolsError) {
    if (!isMissingMcpTable(mcpToolsError)) return { error: mcpToolsError };
  } else {
    mcpToolRows = (mcpTools ?? []) as MCPTool[];
  }

  // Optional: period-over-period scan changes (null until two scans
  // carry per-app results - never blocks the snapshot).
  const scanDelta = await fetchLatestScanDeltaSection(supabase, orgId);

  const report = buildPortfolioGovernanceReport({
    systems: systemRows,
    assessments: assessmentRows,
    controls: controlRows,
    evidenceRecords: evidenceRows,
    mcpTools: mcpToolRows,
    scanDelta: scanDelta ?? undefined,
    generatedAt,
  });

  return {
    report,
    summaryMetrics: summaryForPortfolioReport(report),
  };
}

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = await createServerSupabase();
  const { data: snapshots, error } = await supabase
    .from("governance_report_snapshots")
    .select("id,report_type,ai_system_id,title,summary_metrics,generated_by,generated_by_email,created_at")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingSnapshotTable(error)) return migrationRequiredResponse();
    return dbErrorResponse(error);
  }

  return NextResponse.json({ snapshots: snapshots ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireMutation();
  if ("response" in auth) return auth.response;
  const ctx = auth.ctx;

  const body = await parseBody(request, governanceReportSnapshotCreateSchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createServerSupabase();
  const generatedAt = new Date().toISOString();
  const reportType = body.reportType as GovernanceReportSnapshotType;

  const built =
    reportType === "ai_system_readiness"
      ? await buildReadinessSnapshot({
          supabase,
          orgId: ctx.orgId,
          aiSystemId: body.aiSystemId as string,
          generatedAt,
        })
      : await buildPortfolioSnapshot({
          supabase,
          orgId: ctx.orgId,
          generatedAt,
        });

  if ("error" in built && built.error) return dbErrorResponse(built.error);
  if ("notFound" in built && built.notFound) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const title =
    body.title ||
    defaultSnapshotTitle({
      reportType,
      systemName: "titleSystemName" in built ? built.titleSystemName : null,
      generatedAt,
    });

  const { data: snapshot, error } = await supabase
    .from("governance_report_snapshots")
    .insert({
      org_id: ctx.orgId,
      report_type: reportType,
      ai_system_id: reportType === "ai_system_readiness" ? body.aiSystemId : null,
      title,
      summary_metrics: built.summaryMetrics,
      snapshot: built.report,
      generated_by: ctx.userId,
      generated_by_email: ctx.email ?? "",
    })
    .select("*")
    .single();

  if (error) {
    if (isMissingSnapshotTable(error)) return migrationRequiredResponse();
    return dbErrorResponse(error);
  }

  await recordAudit(ctx, {
    action: "governance_report_snapshot.create",
    target_type: "governance_report_snapshot",
    target_id: snapshot.id,
    summary: `Saved report snapshot ${snapshot.title}`,
    after: {
      report_type: snapshot.report_type,
      ai_system_id: snapshot.ai_system_id,
      title: snapshot.title,
      summary_metrics: snapshot.summary_metrics,
    },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, snapshot }, { status: 201 });
}
