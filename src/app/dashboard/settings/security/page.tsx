import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { getSessionContext } from "@/lib/authz";
import { getMfaSnapshot } from "@/lib/mfa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MfaEnrollment } from "@/components/dashboard/mfa-enrollment";
import { MfaBackupCodes } from "@/components/dashboard/mfa-backup-codes";

export default async function SecuritySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ enrollment?: string }>;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login?next=/dashboard/settings/security");

  const mfa = await getMfaSnapshot();
  const sp = await searchParams;
  const enrollmentRequired = sp.enrollment === "required";

  const adminNeedsMfa = ctx.role === "admin" && !mfa?.hasVerifiedFactor;
  const adminNeedsSessionVerification =
    ctx.role === "admin" && !!mfa?.hasVerifiedFactor && mfa.currentLevel !== "aal2";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-slate-700" />
        <div>
          <h2 className="text-xl font-bold text-slate-900">Security</h2>
          <p className="text-sm text-slate-500">
            Manage two-factor authentication and active sessions.
          </p>
        </div>
      </div>

      {(enrollmentRequired || adminNeedsMfa) && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-900">
              MFA enrollment required for admins
            </p>
            <p className="mt-1 text-sm text-amber-800">
              Your account has the admin role. Enroll a TOTP factor below to
              continue performing administrative actions. After enrollment, you
              will be challenged for a code on every sign-in.
            </p>
          </div>
        </div>
      )}

      {adminNeedsSessionVerification && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-900">
                MFA verification required for this session
              </p>
              <p className="mt-1 text-sm text-amber-800">
                Your factor is enrolled. Verify with your authenticator code to
                unlock admin actions in this browser session.
              </p>
            </div>
          </div>
          <Link
            href="/login/mfa?next=/dashboard/settings/security"
            className="inline-flex shrink-0 items-center rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
          >
            Verify now
          </Link>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Two-factor authentication (TOTP)
          </CardTitle>
          {mfa?.hasVerifiedFactor ? (
            <Badge className="bg-emerald-100 text-emerald-700">Enabled</Badge>
          ) : (
            <Badge variant="outline" className="border-amber-200 text-amber-700">
              Not enabled
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Add a one-time code from an authenticator app (1Password, Authy,
            Google Authenticator, etc.) as a second factor on sign-in.
          </p>
          <MfaEnrollment role={ctx.role} initialEnrolled={!!mfa?.hasVerifiedFactor} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Backup recovery codes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            One-time codes you can use if you lose your authenticator. Each
            code removes your current MFA factor and lets you re-enroll.
            Store them in a password manager or print them.
          </p>
          <MfaBackupCodes enrolled={!!mfa?.hasVerifiedFactor} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Account</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          <div className="flex items-center justify-between">
            <span>Signed in as</span>
            <span className="font-medium text-slate-900">{ctx.email}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span>Role</span>
            <span className="font-mono text-xs uppercase tracking-wider text-slate-700">
              {ctx.role}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span>Current AAL</span>
            <span className="font-mono text-xs uppercase tracking-wider text-slate-700">
              {mfa?.currentLevel ?? "aal1"}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="text-sm">
        <Link
          href="/dashboard/settings"
          className="text-slate-500 hover:text-slate-900"
        >
          ← Back to Settings
        </Link>
      </div>
    </div>
  );
}
