import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { safeNext } from "@/lib/authz";
import { clientIp, rateLimit, rateLimited } from "@/lib/rate-limit";
import { bootstrapUser } from "@/lib/auth-bootstrap";

function callbackErrorCode(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("pkce") || normalized.includes("code verifier")) {
    return "pkce_missing";
  }
  return message;
}

/**
 * Supabase OAuth / magic-link / email-confirmation callback.
 *
 * After the provider redirects back with ?code=..., exchange it for a
 * session. For first-time sign-ins that arrive verified (Google SSO, or
 * email-confirmation click-through), create the user's isolated organization
 * through the same bootstrap that
 * /api/auth/bootstrap does for direct email signup. Admin role is only
 * granted to a verified user (Supabase guarantees email_confirmed_at is
 * set here — the code redemption proves mailbox ownership for email,
 * and the identity provider's verified email for OAuth).
 */
export async function GET(request: NextRequest) {
  // 20/min per IP is generous for real users, stops auth-callback loops.
  const ip = clientIp(request);
  const limit = await rateLimit(`callback:${ip}`, 20, 60_000);
  if (!limit.allowed) return rateLimited(limit);

  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url));
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(callbackErrorCode(error.message))}`, url)
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id && user.email && user.email_confirmed_at) {
    const orgName =
      typeof user.user_metadata?.org_name === "string"
        ? user.user_metadata.org_name
        : null;
    const result = await bootstrapUser({
      userId: user.id,
      email: user.email,
      orgName,
      authProvider:
        user.app_metadata?.provider === "google" ? "google" : "email",
    });
    if (!result.ok) {
      // Without a public.users row the dashboard layout will redirect
      // straight back to /login — surface the real cause instead of
      // looping silently.
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(result.error)}`, url)
      );
    }
  }

  return NextResponse.redirect(new URL(next, url));
}
