import "server-only";

import { createAdminSupabase } from "./supabase/server";
import type { SessionContext } from "./authz";

type AuditEventOptions = {
  action: string;
  target_type: string;
  target_id?: string | null;
  summary?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string | null;
  user_agent?: string | null;
};

async function insertAuditEvent(params: {
  orgId: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  opts: AuditEventOptions;
}): Promise<void> {
  const admin = createAdminSupabase();
  await admin.from("audit_events").insert({
    org_id: params.orgId,
    actor_user_id: params.actorUserId ?? null,
    actor_email: params.actorEmail ?? null,
    action: params.opts.action,
    target_type: params.opts.target_type,
    target_id: params.opts.target_id ?? null,
    summary: params.opts.summary ?? null,
    before_state: params.opts.before ?? null,
    after_state: params.opts.after ?? null,
    ip: params.opts.ip ?? null,
    user_agent: params.opts.user_agent ?? null,
  });
}

/**
 * Record an admin-level mutation into the audit log. Fire-and-forget;
 * never blocks the caller on error (but logs the failure). Uses the
 * service role because audit rows must be written even when RLS would
 * otherwise forbid (org members can read their own audit trail but
 * cannot insert into it directly).
 *
 * Conventions:
 *   action       — "noun.verb" in past context, e.g. "policy.update"
 *   target_type  — table-ish singular, e.g. "agent_policy"
 *   target_id    — uuid or name of the target row
 *   before/after — for updates, the subset of fields that changed
 */
export async function recordAudit(
  ctx: SessionContext,
  opts: AuditEventOptions
): Promise<void> {
  try {
    await insertAuditEvent({
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      actorEmail: ctx.email,
      opts,
    });
  } catch (err) {
    // Audit is best-effort: don't break the caller's response on an
    // audit failure, but make sure we see it in logs.
    console.error("audit: failed to record event", {
      action: opts.action,
      target_type: opts.target_type,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function recordSystemAudit(
  orgId: string,
  opts: AuditEventOptions & {
    actor_user_id?: string | null;
    actor_email?: string | null;
  }
): Promise<void> {
  try {
    await insertAuditEvent({
      orgId,
      actorUserId: opts.actor_user_id ?? null,
      actorEmail: opts.actor_email ?? null,
      opts,
    });
  } catch (err) {
    console.error("audit: failed to record system event", {
      action: opts.action,
      target_type: opts.target_type,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
