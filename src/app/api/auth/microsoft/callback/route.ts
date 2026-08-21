import { NextRequest, NextResponse } from "next/server";
import { getMicrosoftTokens } from "@/lib/microsoft-365";
import { saveMicrosoftTokens, getSessionOrgId } from "@/lib/tokens";
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
  if (!(await verifyOAuthState("microsoft", state))) {
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
    const tokens = await getMicrosoftTokens(code);
    if (!tokens.access_token) {
      throw new Error("No access token received");
    }
    await saveMicrosoftTokens(orgId, tokens);
    return NextResponse.redirect(
      new URL("/dashboard?connected=microsoft", request.url)
    );
  } catch (err) {
    console.error("Microsoft token exchange failed:", err);
    return NextResponse.redirect(
      new URL("/dashboard?error=ms_token_exchange_failed", request.url)
    );
  }
}
