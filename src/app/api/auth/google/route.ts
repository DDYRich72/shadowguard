import { NextResponse } from "next/server";
import { getAdminConsentUrl } from "@/lib/google-workspace";
import { mintOAuthState } from "@/lib/oauth-state";
import { serverErrorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const state = await mintOAuthState("google");
    return NextResponse.redirect(getAdminConsentUrl(state));
  } catch (error) {
    return serverErrorResponse(error);
  }
}
