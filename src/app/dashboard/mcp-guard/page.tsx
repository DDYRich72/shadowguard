"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, BookOpen, Network, ServerCog, ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MCPServerRow = {
  id: string;
  name: string;
  status: string;
  approval_status: string;
};

type MCPToolRow = {
  id: string;
  name: string;
  risk_tier: "critical" | "high" | "medium" | "low";
  risk_score: number;
  approval_status: string;
  status: string;
  ai_system_id: string | null;
  last_activity_at: string | null;
};

type MCPEventRow = {
  id: string;
  tool_name: string;
  server_name: string | null;
  user_email: string;
  risk_level: string;
  decision: string;
  created_at: string;
};

const riskClass = {
  critical: "bg-red-50 text-red-700 border-red-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(value: string | null): string {
  if (!value) return "No activity";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function MCPGuardOverviewPage() {
  const [servers, setServers] = useState<MCPServerRow[]>([]);
  const [tools, setTools] = useState<MCPToolRow[]>([]);
  const [events, setEvents] = useState<MCPEventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [serverRes, toolRes, eventRes] = await Promise.all([
          fetch("/api/mcp-guard/servers"),
          fetch("/api/mcp-guard/tools"),
          fetch("/api/mcp-guard/events?limit=8"),
        ]);
        const [serverData, toolData, eventData] = await Promise.all([
          serverRes.json(),
          toolRes.json(),
          eventRes.json(),
        ]);
        setServers(serverData.servers ?? []);
        setTools(toolData.tools ?? []);
        setEvents(eventData.events ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const stats = useMemo(() => {
    return {
      servers: servers.length,
      tools: tools.length,
      highRisk: tools.filter((tool) => tool.risk_tier === "critical" || tool.risk_tier === "high").length,
      pending: tools.filter((tool) => tool.approval_status === "pending_review").length,
      unlinked: tools.filter((tool) => !tool.ai_system_id).length,
    };
  }, [servers, tools]);

  const highRiskTools = tools
    .filter((tool) => tool.risk_tier === "critical" || tool.risk_tier === "high")
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">MCPGuard</h2>
          <p className="text-sm text-slate-500">
            Govern MCP servers, exposed tools, tool risk, and agent tool-call evidence.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/mcp-guard/guide" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
            <BookOpen className="h-4 w-4" />
            Guide
          </Link>
          <Link href="/dashboard/mcp-guard/servers" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
            <ServerCog className="h-4 w-4" />
            Servers
          </Link>
          <Link href="/dashboard/mcp-guard/tools" className={cn(buttonVariants({ variant: "default" }), "gap-2")}>
            <ShieldCheck className="h-4 w-4" />
            Tools
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <StatCard icon={Network} label="Servers" value={stats.servers} />
        <StatCard icon={ShieldCheck} label="Tools" value={stats.tools} />
        <StatCard icon={ShieldAlert} label="High risk" value={stats.highRisk} />
        <StatCard icon={Activity} label="Pending review" value={stats.pending} />
        <StatCard icon={ServerCog} label="Unlinked" value={stats.unlinked} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">High-Risk MCP Tools</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500">Loading MCP posture...</p>
            ) : highRiskTools.length === 0 ? (
              <p className="text-sm text-slate-500">No high or critical MCP tools recorded.</p>
            ) : (
              <div className="space-y-3">
                {highRiskTools.map((tool) => (
                  <div key={tool.id} className="rounded-md border border-slate-200 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{tool.name}</p>
                        <p className="mt-1 text-xs text-slate-500">Last activity: {timeAgo(tool.last_activity_at)}</p>
                      </div>
                      <Badge className={riskClass[tool.risk_tier]}>{humanize(tool.risk_tier)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Tool Events</CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-slate-500">No MCP tool events recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="rounded-md border border-slate-200 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{event.tool_name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {event.user_email} - {event.server_name || "Unknown server"} - {timeAgo(event.created_at)}
                        </p>
                      </div>
                      <Badge variant="outline">{humanize(event.decision)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {tools.length === 0 && !loading && (
        <Card>
          <CardContent className="py-10 text-center">
            <Network className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">No MCP inventory yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Start by registering the MCP servers and tools your agents can reach.
            </p>
            <Button
              render={<Link href="/dashboard/mcp-guard/servers" />}
              nativeButton={false}
              className="mt-4"
            >
              Add MCP Server
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Network;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
          <Icon className="h-4 w-4 text-slate-700" />
        </div>
        <div>
          <p className="text-xl font-semibold text-slate-900">{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
