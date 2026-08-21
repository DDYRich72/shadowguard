import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import { clientIp, rateLimit, rateLimited } from "@/lib/rate-limit";
import { parseBody, bootstrapSchema } from "@/lib/api/schemas";
import { bootstrapUser } from "@/lib/auth-bootstrap";

/**
 * Creates the public.users and public.organizations rows
 * for a freshly-signed-up Supabase auth user.
 *
 * Every verified user gets an isolated organization and the admin role,
 * even when another organization uses the same email domain. Additional
 * membership is assigned only through the database-operator SQL procedure.
 *
 * Refuses to run until auth.users.email_confirmed_at is set, so an
 * an attacker cannot bootstrap an address without controlling its mailbox.
 *
 * Idempotent: safe to call multiple times (called from /signup after
 * confirmation AND from /auth/callback on OAuth first-sign-in, both via
 * the shared bootstrapUser helper).
 */
export async function POST(request: NextRequest) {
  // Signup flood protection. 5 bootstraps per IP per minute is plenty
  // for a real user retrying; anything more looks automated.
  const ip = clientIp(request);
  const limit = await rateLimit(`bootstrap:${ip}`, 5, 60_000);
  if (!limit.allowed) return rateLimited(limit);

  const body = await parseBody(request, bootstrapSchema);
  if (body instanceof NextResponse) return body;
  const userId = body.user_id;
  const email = body.email;
  const orgName = body.org_name;

  // Verify the CALLER is signed in AS this user_id (not just "knows the
  // UUID"). Closes the window where an attacker who somehow learns a
  // freshly-confirmed user's id can race them to bootstrap.
  const session = await createServerSupabase();
  const { data: { user: sessionUser } } = await session.auth.getUser();
  if (!sessionUser || sessionUser.id !== userId) {
    return NextResponse.json({ error: "session_mismatch" }, { status: 403 });
  }

  // Verify the caller actually owns this mailbox. email_confirmed_at is
  // null until Supabase receives the click on the confirmation link.
  const admin = createAdminSupabase();
  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId);
  if (authErr || !authUser?.user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }
  if (!authUser.user.email_confirmed_at) {
    return NextResponse.json(
      { error: "email_not_verified" },
      { status: 403 }
    );
  }
  // Belt and suspenders: make sure the email on the payload matches the
  // email on the auth record.
  if (authUser.user.email?.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: "email_mismatch" }, { status: 400 });
  }

  const result = await bootstrapUser({
    userId,
    email,
    orgName,
    authProvider: "email",
  });

  if (!result.ok) {
    const status = result.error === "invalid_email" ? 400 : 500;
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status }
    );
  }

  return NextResponse.json({
    ok: true,
    org_id: result.orgId,
    role: result.role,
    already_bootstrapped: result.alreadyBootstrapped,
  });
}
