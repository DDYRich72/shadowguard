import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/authz";

/**
 * Lightweight session probe. Returns role + plan for the signed-in
 * user, used by the login flow to decide whether to route the user
 * through MFA enrollment / challenge before landing in the dashboard.
 *
 * Returns 401 if there is no session.
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    userId: ctx.userId,
    email: ctx.email,
    role: ctx.role,
  });
}
