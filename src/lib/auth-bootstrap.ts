import "server-only";

import { createAdminSupabase } from "./supabase/server";
import { logger } from "./logger";

/**
 * Isolated organization bootstrap for a verified user.
 *
 * Creates the public.organizations and public.users rows
 * for a Supabase auth user whose mailbox ownership has already been
 * proven (email confirmation click, or verified-email OAuth). Callers
 * MUST do that proof before invoking this — the helper trusts the
 * (userId, email) pair.
 *
 * Idempotent: a second call for the same userId no-ops and returns the
 * existing org/role.
 *
 * Every user receives a separate organization and becomes its admin.
 * Matching email domains never imply shared organization membership.
 *
 * Both error paths used to be silent in /auth/callback, which produced
 * a redirect loop where the dashboard layout couldn't find a users row
 * and bounced the freshly-confirmed user back to /login forever. This
 * helper surfaces the failure to the caller.
 */

export type BootstrapErrorCode =
  | "invalid_email"
  | "org_create_failed"
  | "user_create_failed";

export type BootstrapResult =
  | {
      ok: true;
      orgId: string;
      role: "admin" | "viewer";
      alreadyBootstrapped: boolean;
    }
  | { ok: false; error: BootstrapErrorCode; detail?: string };

export async function bootstrapUser(params: {
  userId: string;
  email: string;
  orgName?: string | null;
  authProvider: "email" | "google" | "microsoft";
}): Promise<BootstrapResult> {
  const { userId, email, orgName, authProvider } = params;
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return { ok: false, error: "invalid_email" };

  const admin = createAdminSupabase();

  // Idempotent early return: already bootstrapped.
  const { data: existingUser } = await admin
    .from("users")
    .select("id, org_id, role")
    .eq("id", userId)
    .maybeSingle();
  if (existingUser) {
    return {
      ok: true,
      orgId: existingUser.org_id as string,
      role: existingUser.role as "admin" | "viewer",
      alreadyBootstrapped: true,
    };
  }

  const cleanName = orgName?.trim();
  const { data: created, error: orgErr } = await admin
    .from("organizations")
    .insert({
      name: cleanName && cleanName.length > 0 ? cleanName : domain,
      domain,
      owner_user_id: userId,
    })
    .select("id")
    .single();
  if (orgErr || !created) {
    logger.error("bootstrap_org_create_failed", {
      domain,
      detail: orgErr?.message,
    });
    return {
      ok: false,
      error: "org_create_failed",
      detail: orgErr?.message,
    };
  }

  const orgId = created.id as string;
  const role = "admin" as const;

  const { error: userErr } = await admin.from("users").upsert(
    {
      id: userId,
      org_id: orgId,
      email,
      role,
      auth_provider: authProvider,
    },
    { onConflict: "id" }
  );

  if (userErr) {
    logger.error("bootstrap_user_create_failed", {
      userId,
      orgId,
      detail: userErr.message,
    });
    return { ok: false, error: "user_create_failed", detail: userErr.message };
  }

  return { ok: true, orgId, role, alreadyBootstrapped: false };
}
