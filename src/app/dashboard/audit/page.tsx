import { redirect } from "next/navigation";
import Link from "next/link";
import { ScrollText, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { getSessionContext, hasRole } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AuditRowDetails } from "@/components/dashboard/audit-row-details";

const PAGE_SIZE = 25;

type AuditRow = {
  id: string;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  summary: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

function actionTone(action: string): { label: string; tone: string } {
  if (action.endsWith(".delete") || action === "killswitch.engage")
    return { label: action, tone: "bg-red-50 text-red-700 border-red-200" };
  if (action.endsWith(".create"))
    return { label: action, tone: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (action.endsWith(".update"))
    return { label: action, tone: "bg-blue-50 text-blue-700 border-blue-200" };
  if (action === "killswitch.release")
    return { label: action, tone: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: action, tone: "bg-slate-50 text-slate-700 border-slate-200" };
}

function fmtTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string; actor?: string }>;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login?next=/dashboard/audit");
  if (!hasRole(ctx.role, ["admin"])) {
    redirect("/dashboard?error=admin_only");
  }

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const actionFilter = sp.action?.trim() || null;
  const actorFilter = sp.actor?.trim() || null;

  const supabase = await createServerSupabase();
  let query = supabase
    .from("audit_events")
    .select(
      "id, actor_email, action, target_type, target_id, summary, before_state, after_state, ip, user_agent, created_at",
      { count: "exact" }
    )
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (actionFilter) query = query.eq("action", actionFilter);
  if (actorFilter) {
    // Escape LIKE wildcards and backslash so "%" or "_" in the filter
    // match literally (same treatment as the apps search).
    const safeActor = actorFilter.replace(/[\\%_]/g, "\\$&");
    query = query.ilike("actor_email", `%${safeActor}%`);
  }

  const { data, count } = await query;
  const rows = (data ?? []) as AuditRow[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Distinct actions for the filter dropdown.
  const { data: actionRows } = await supabase
    .from("audit_events")
    .select("action")
    .eq("org_id", ctx.orgId)
    .limit(500);
  const distinctActions = Array.from(
    new Set((actionRows ?? []).map((r) => r.action))
  ).sort();

  function pageHref(p: number): string {
    const params = new URLSearchParams();
    if (actionFilter) params.set("action", actionFilter);
    if (actorFilter) params.set("actor", actorFilter);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/dashboard/audit?${qs}` : "/dashboard/audit";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ScrollText className="h-6 w-6 text-slate-700" />
        <div>
          <h2 className="text-xl font-bold text-slate-900">Audit Log</h2>
          <p className="text-sm text-slate-500">
            Every administrative mutation is recorded here. Org-scoped, admin-only.
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form
            method="GET"
            className="flex flex-wrap items-end gap-4"
            action="/dashboard/audit"
          >
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-slate-600">
                Action
              </label>
              <select
                name="action"
                defaultValue={actionFilter ?? ""}
                suppressHydrationWarning
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">All actions</option>
                {distinctActions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-slate-600">
                Actor email contains
              </label>
              <input
                type="text"
                name="actor"
                defaultValue={actorFilter ?? ""}
                placeholder="alice@example.com"
                suppressHydrationWarning
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              suppressHydrationWarning
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Filter className="h-3.5 w-3.5" />
              Apply
            </button>
            {(actionFilter || actorFilter) && (
              <Link
                href="/dashboard/audit"
                className="text-sm text-slate-500 hover:text-slate-900"
              >
                Clear
              </Link>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-slate-500">
              No audit events match these filters.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.map((row) => {
                const tone = actionTone(row.action);
                return (
                  <div key={row.id} className="px-6 py-4">
                    <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`font-mono text-[11px] ${tone.tone}`}
                          >
                            {tone.label}
                          </Badge>
                          <span className="text-sm text-slate-700">
                            {row.summary ?? `${row.action} on ${row.target_type}`}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span>{row.actor_email ?? "system"}</span>
                          <span>·</span>
                          <span title={new Date(row.created_at).toISOString()}>
                            {fmtTime(row.created_at)}
                          </span>
                          {row.target_id && (
                            <>
                              <span>·</span>
                              <span className="font-mono">
                                {row.target_type}:{row.target_id.slice(0, 8)}
                              </span>
                            </>
                          )}
                          {row.ip && (
                            <>
                              <span>·</span>
                              <span className="font-mono">{row.ip}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {(row.before_state || row.after_state) && (
                        <AuditRowDetails
                          before={row.before_state}
                          after={row.after_state}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <div>
            Page {page} of {totalPages} · {total} events
          </div>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={pageHref(page - 1)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={pageHref(page + 1)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
