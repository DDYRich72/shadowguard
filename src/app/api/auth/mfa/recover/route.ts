import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { consumeBackupCode } from "@/lib/mfa-backup.server";
import { rateLimit, rateLimited, clientIp } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import { getSessionContext } from "@/lib/authz";
import { clip } from "@/lib/validate";

/**
 * MFA recovery via backup code.
 *
 * Flow:
 *   1. User has completed password sign-in (AAL1 session present).
 *   2. They submit one of their 10 backup codes.
 *   3. We hash + look up the code; if valid and unused, mark it used.
 *   4. Use the service-role admin API to delete every MFA factor on
 *      their account so the next signed-in page load is no longer
 *      gated by AAL2.
 *   5. Audit-log the recovery (admin role only — the audit table is
 *      org-scoped).
 *   6. Caller redirects user to /dashboard/settings/security?
 *      enrollment=required so they re-enroll a fresh authenticator
 *      on a known-good device.
 *
 * Why no password re-confirm here: the AAL1 session itself is proof
 * that they entered the password recently. If the session is missing
 * or expired, the request returns 401 and they go through normal
 * sign-in first.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Aggressive rate limit — a brute-force attempt against 49-bit
  // codes at 10/min would still take centuries, but this caps the
  // log noise and adds defence in depth.
  const rl = await rateLimit(`mfa-recover:${user.id}:${clientIp(request)}`, 10, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const body = await request.json().catch(() => ({}));
  const code = clip(body.code, 32);
  if (!code) {
    return NextResponse.json({ error: "missing_code" }, { status: 400 });
  }

  const ok = await consumeBackupCode(user.id, code);
  if (!ok) {
    // Don't distinguish "wrong code" from "already used" — both leak
    // information about the user's recovery state.
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  // Wipe MFA factors. listFactors via the admin API returns all
  // factors regardless of status; delete each one.
  const admin = createAdminSupabase();
  const { data: factorList } = await admin.auth.admin.mfa.listFactors({
    userId: user.id,
  });
  for (const f of factorList?.factors ?? []) {
    await admin.auth.admin.mfa.deleteFactor({
      userId: user.id,
      id: f.id,
    });
  }

  // Best-effort audit (only fires for users with org context, which
  // is everyone post-signup; recordAudit no-ops cleanly on failure).
  const ctx = await getSessionContext();
  if (ctx) {
    await recordAudit(ctx, {
      action: "mfa.recover",
      target_type: "user",
      target_id: user.id,
      summary: "Recovered MFA via backup code; all factors removed",
      ip: clientIp(request),
      user_agent: request.headers.get("user-agent"),
    });
  }

  return NextResponse.json({
    ok: true,
    nextStep: "/dashboard/settings/security?enrollment=required",
  });
}
