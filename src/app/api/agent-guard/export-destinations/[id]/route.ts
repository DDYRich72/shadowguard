import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { dbErrorResponse } from "@/lib/errors";
import { getMfaSnapshot, adminNeedsAal2, mfaRequiredError } from "@/lib/mfa";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import { parseBody, agentExportDestinationPatchSchema } from "@/lib/api/schemas";
import { isUuid } from "@/lib/validate";
import {
  normalizeAgentExportEventTypes,
  validateAgentExportDestinationUrl,
  type AgentExportDestinationStatus,
  type AgentExportDestinationType,
} from "@/lib/agent-guard/export-destinations";
import { agentExportDestinationHealth } from "@/lib/agent-guard/export-health";
import type { AgentExportReceiverAcknowledgementStatus } from "@/lib/agent-guard/export-hardening";

const DESTINATION_SELECT =
  "id, name, destination_type, status, endpoint_url, signing_secret_hint, automatic_delivery_enabled, dry_run_enabled, event_types, owner_name, owner_email, escalation_path, receiver_acknowledgement_status, receiver_acknowledgement_note, receiver_acknowledged_at, receiver_acknowledged_by_email, created_by_email, last_tested_at, last_automatic_attempt_at, created_at, updated_at";

type Ctx = { params: Promise<{ id: string }> };

type AgentExportDestinationRow = {
  id: string;
  name: string;
  destination_type: AgentExportDestinationType;
  status: AgentExportDestinationStatus;
  endpoint_url: string;
  signing_secret_hint: string;
  automatic_delivery_enabled: boolean;
  dry_run_enabled: boolean;
  event_types: string[] | null;
  owner_name: string | null;
  owner_email: string | null;
  escalation_path: string | null;
  receiver_acknowledgement_status: AgentExportReceiverAcknowledgementStatus | null;
  receiver_acknowledgement_note: string | null;
  receiver_acknowledged_at: string | null;
  receiver_acknowledged_by_email: string | null;
  created_by_email: string | null;
  last_tested_at: string | null;
  last_automatic_attempt_at: string | null;
  created_at: string;
  updated_at: string;
};

function destinationToApi(row: AgentExportDestinationRow) {
  const health = agentExportDestinationHealth(row);
  return {
    id: row.id,
    name: row.name,
    destinationType: row.destination_type,
    status: row.status,
    endpointUrl: row.endpoint_url,
    signingSecretHint: row.signing_secret_hint,
    automaticDeliveryEnabled: row.automatic_delivery_enabled,
    dryRunEnabled: row.dry_run_enabled,
    eventTypes: normalizeAgentExportEventTypes(row.event_types),
    ownerName: row.owner_name ?? "",
    ownerEmail: row.owner_email ?? "",
    escalationPath: row.escalation_path ?? "",
    receiverAcknowledgementStatus:
      row.receiver_acknowledgement_status ?? "not_requested",
    receiverAcknowledgementNote: row.receiver_acknowledgement_note ?? "",
    receiverAcknowledgedAt: row.receiver_acknowledged_at,
    receiverAcknowledgedByEmail: row.receiver_acknowledged_by_email,
    createdByEmail: row.created_by_email,
    lastTestedAt: row.last_tested_at,
    lastAutomaticAttemptAt: row.last_automatic_attempt_at,
    healthStatus: health.status,
    healthLabel: health.label,
    healthSummary: health.summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function requireExportManager() {
  const ctx = await getSessionContext();
  if (!ctx) return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (!hasRole(ctx.role, ["admin", "manager"])) {
    return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  const mfa = await getMfaSnapshot();
  if (adminNeedsAal2(ctx.role, mfa?.currentLevel ?? "aal1")) {
    return { response: NextResponse.json(mfaRequiredError, { status: 403 }) };
  }
  return { ctx };
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const gate = await requireExportManager();
  if ("response" in gate) return gate.response;
  const { ctx: session } = gate;

  const rl = await rateLimit(`patch:agent-export-destination:${session.orgId}`, 30, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const body = await parseBody(request, agentExportDestinationPatchSchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createServerSupabase();
  const { data: before, error: beforeError } = await supabase
    .from("agent_export_destinations")
    .select(DESTINATION_SELECT)
    .eq("id", id)
    .eq("org_id", session.orgId)
    .maybeSingle();

  if (beforeError) return dbErrorResponse(beforeError);
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.destinationType !== undefined) patch.destination_type = body.destinationType;
  if (body.status !== undefined) patch.status = body.status;
  if (body.automaticDeliveryEnabled !== undefined) {
    patch.automatic_delivery_enabled = body.automaticDeliveryEnabled;
  }
  if (body.dryRunEnabled !== undefined) patch.dry_run_enabled = body.dryRunEnabled;
  if (body.eventTypes !== undefined) patch.event_types = body.eventTypes;
  if (body.ownerName !== undefined) patch.owner_name = body.ownerName;
  if (body.ownerEmail !== undefined) patch.owner_email = body.ownerEmail;
  if (body.escalationPath !== undefined) patch.escalation_path = body.escalationPath;
  if (body.receiverAcknowledgementStatus !== undefined) {
    patch.receiver_acknowledgement_status = body.receiverAcknowledgementStatus;
    if (
      body.receiverAcknowledgementStatus === "confirmed" &&
      before.receiver_acknowledgement_status !== "confirmed"
    ) {
      patch.receiver_acknowledged_at = new Date().toISOString();
      patch.receiver_acknowledged_by_email = session.email;
    }
    if (
      body.receiverAcknowledgementStatus !== "confirmed" &&
      before.receiver_acknowledgement_status === "confirmed"
    ) {
      patch.receiver_acknowledged_at = null;
      patch.receiver_acknowledged_by_email = null;
    }
  }
  if (body.receiverAcknowledgementNote !== undefined) {
    patch.receiver_acknowledgement_note = body.receiverAcknowledgementNote;
  }
  if (body.endpointUrl !== undefined) {
    const destinationUrl = validateAgentExportDestinationUrl(body.endpointUrl);
    if (!destinationUrl.ok) {
      return NextResponse.json(
        { error: "invalid_destination_url", message: destinationUrl.reason },
        { status: 400 }
      );
    }
    patch.endpoint_url = destinationUrl.url;
  }

  const { data, error } = await supabase
    .from("agent_export_destinations")
    .update(patch)
    .eq("id", id)
    .eq("org_id", session.orgId)
    .select(DESTINATION_SELECT)
    .single();

  if (error) return dbErrorResponse(error);

  await recordAudit(session, {
    action: "agent_export_destination.update",
    target_type: "agent_export_destination",
    target_id: id,
    summary: `Updated AgentGuard export destination "${data?.name}"`,
    before: before as Record<string, unknown>,
    after: patch,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({
    destination: destinationToApi(data as AgentExportDestinationRow),
  });
}
