import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, ServerCog, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionContext } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";

function roleLabel(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function SettingsPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login?next=/dashboard/settings");

  const supabase = await createServerSupabase();
  const { data: organization } = await supabase
    .from("organizations")
    .select("name, domain, google_connected, microsoft_connected")
    .eq("id", ctx.orgId)
    .maybeSingle();

  const googleConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
  const microsoftConfigured = Boolean(
    process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Settings</h2>
        <p className="text-sm text-slate-500">
          Manage organization security and installer-configured integrations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Organization</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <SettingFact
            label="Organization"
            value={organization?.name ?? "Your organization"}
            detail={organization?.domain ?? "No domain on file"}
          />
          <div className="rounded-md border border-slate-200 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-normal text-slate-500">
              Your role
            </p>
            <Badge variant="outline" className="mt-2 bg-slate-50 text-slate-700">
              {roleLabel(ctx.role)}
            </Badge>
            <p className="mt-2 text-xs text-slate-500">
              Role and MFA control privileged actions.
            </p>
          </div>
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-normal text-emerald-700">
              Product access
            </p>
            <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-emerald-900">
              <CheckCircle2 className="h-4 w-4" />
              Complete feature set
            </div>
            <p className="mt-2 text-xs text-emerald-700">
              This open-source distribution has no product tiers or entitlements.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Security</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-600">
              Manage multi-factor authentication and account access.
            </p>
            <p className="mt-1 text-xs text-slate-400">MFA is required for administrators.</p>
          </div>
          <Button render={<Link href="/dashboard/settings/security" />} nativeButton={false} variant="outline">
            <ShieldCheck className="mr-2 h-4 w-4" />
            Manage <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <IntegrationCard
        title="Google Workspace"
        description="Discover AI-related OAuth grants and applications in a Google Workspace domain."
        connected={Boolean(organization?.google_connected)}
        configured={googleConfigured}
        connectHref="/api/auth/google"
      />

      <IntegrationCard
        title="Microsoft 365"
        description="Discover AI-related enterprise applications and delegated permissions in Microsoft 365."
        connected={Boolean(organization?.microsoft_connected)}
        configured={microsoftConfigured}
        connectHref="/api/auth/microsoft"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ServerCog className="h-4 w-4" />
            Self-hosted operation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">
            Your installation operator owns infrastructure, credentials, backups,
            updates, monitoring, and support. Optional integrations can remain
            unconfigured; manual inventory, assessments, controls, evidence,
            reports, AgentGuard, and MCP governance remain available.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingFact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-slate-200 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function IntegrationCard({
  title,
  description,
  connected,
  configured,
  connectHref,
}: {
  title: string;
  description: string;
  connected: boolean;
  configured: boolean;
  connectHref: string;
}) {
  const state = connected ? "Connected" : configured ? "Ready" : "Not configured";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-600">{description}</p>
          <p className="mt-1 text-xs text-slate-400">
            Configure credentials in the server environment; never expose client secrets.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={connected ? "border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-600"}
          >
            {state}
          </Badge>
          {configured && !connected && (
            <Button render={<Link href={connectHref} />} nativeButton={false}>Connect</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
