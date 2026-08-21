import { NextRequest, NextResponse } from "next/server";
import { getTokensFromCode } from "@/lib/google-workspace";
import { saveGoogleTokens, getSessionOrgId } from "@/lib/tokens";
import { verifyOAuthState } from "@/lib/oauth-state";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const state = request.nextUrl.searchParams.get("state");

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard?error=${encodeURIComponent(error)}`, request.url)
    );
  }
  if (!code) {
    return NextResponse.redirect(
      new URL("/dashboard?error=missing_code", request.url)
    );
  }
  if (!(await verifyOAuthState("google", state))) {
    return NextResponse.redirect(
      new URL("/dashboard?error=state_mismatch", request.url)
    );
  }

  const orgId = await getSessionOrgId();
  if (!orgId) {
    return NextResponse.redirect(
      new URL("/login?next=/dashboard/settings", request.url)
    );
  }

  try {
    const tokens = await getTokensFromCode(code);
    if (!tokens.access_token) {
      throw new Error("No access token received");
    }
    await saveGoogleTokens(orgId, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
    });
    return NextResponse.redirect(
      new URL("/dashboard?connected=google", request.url)
    );
  } catch (err) {
    console.error("Google token exchange failed:", err);
    return NextResponse.redirect(
      new URL("/dashboard?error=token_exchange_failed", request.url)
    );
  }
}
