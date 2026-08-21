import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopBar } from "@/components/dashboard/top-bar";
import { MfaBanner } from "@/components/dashboard/mfa-banner";
import { getSessionContext } from "@/lib/authz";
import { getMfaSnapshot } from "@/lib/mfa";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Defense-in-depth: proxy.ts already redirects unauthenticated
  // traffic at the edge, but a misconfigured matcher or an edge-runtime
  // failure could bypass it. Check again in the layout so dashboard
  // pages never render for a logged-out user, even if nothing loads.
  const ctx = await getSessionContext();
  if (!ctx) {
    redirect("/login?next=/dashboard");
  }

  // Surface a non-blocking banner for admins without MFA. We don't
  // hard-redirect from this layout because the security/enrollment
  // page lives under it — login-time routing is the enforcement point.
  // The API gate (mfaRequiredError) blocks actual mutations.
  const mfa = await getMfaSnapshot();
  const showMfaBanner =
    ctx.role === "admin" && (!mfa?.hasVerifiedFactor || mfa.currentLevel !== "aal2");

  return (
    <div className="min-h-screen bg-background text-foreground print:bg-white">
      <Sidebar role={ctx.role} />
      <div className="pl-64 print:pl-0">
        {showMfaBanner && (
          <div className="print:hidden">
            <MfaBanner
              hasVerifiedFactor={!!mfa?.hasVerifiedFactor}
              currentLevel={mfa?.currentLevel ?? "aal1"}
            />
          </div>
        )}
        <TopBar title="Overview" subtitle="Shadow AI discovery, scoring, and governance" />
        <main className="p-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}
