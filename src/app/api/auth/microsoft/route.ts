import { NextResponse } from "next/server";
import { getMicrosoftConsentUrl } from "@/lib/microsoft-365";
import { mintOAuthState } from "@/lib/oauth-state";
import { serverErrorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const state = await mintOAuthState("microsoft");
    return NextResponse.redirect(getMicrosoftConsentUrl(state));
  } catch (error) {
    return serverErrorResponse(error);
  }
}
