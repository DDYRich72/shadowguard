"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AgentGuardNav } from "../agent-guard-nav";

interface AgentTool {
  name: string;
  users: number;
  status: "active" | "paused" | "blocked";
  lastActivity: string;
  dataFlows: { inbound: string; outbound: string; riskLevel: string }[];
  totalRequests24h: number;
  piiExposed: number;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700 border-green-200",
  paused: "bg-yellow-100 text-yellow-700 border-yellow-200",
  blocked: "bg-red-100 text-red-700 border-red-200",
};

const RISK_COLORS: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
  none: "bg-slate-300",
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr${h === 1 ? "" : "s"} ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function MonitoringPage() {
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agent-guard/tools")
      .then((r) => r.json())
      .then((data) => {
        setTools(data.tools ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const activeCount = tools.filter((t) => t.status === "active").length;
  const uniqueUsers = tools.reduce((sum, t) => sum + t.users, 0);
  const totalPii = tools.reduce((sum, t) => sum + t.piiExposed, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Agent Monitoring</h2>
        <p className="text-sm text-slate-500">
          Review tools, data-flow labels, and users from activity submitted to AgentGuard.
        </p>
      </div>

      <AgentGuardNav />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-slate-900">{tools.length}</p>
            <p className="text-xs text-slate-500">Tools With Activity</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-green-600">{activeCount}</p>
            <p className="text-xs text-slate-500">Active Tool Rows</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-slate-900">{uniqueUsers}</p>
            <p className="text-xs text-slate-500">Unique Users (24h)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-amber-600">{totalPii}</p>
            <p className="text-xs text-slate-500">PII Signals (24h)</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Tools From Submitted Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            </div>
          ) : tools.length === 0 ? (
            <p className="text-center py-8 text-sm text-slate-500">
              No AI tool activity recorded in the last 24 hours.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    <th className="pb-3 font-medium text-slate-500">Tool</th>
                    <th className="pb-3 font-medium text-slate-500">Status</th>
                    <th className="pb-3 font-medium text-slate-500">Users</th>
                    <th className="pb-3 font-medium text-slate-500">Requests (24h)</th>
                    <th className="pb-3 font-medium text-slate-500">PII Signals</th>
                    <th className="pb-3 font-medium text-slate-500">Last Activity</th>
                    <th className="pb-3 font-medium text-slate-500">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {tools.map((tool) => {
                    const order = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };
                    const highestRisk = tool.dataFlows.reduce((r, f) => {
                      return (order[f.riskLevel as keyof typeof order] ?? 0) >
                        (order[r as keyof typeof order] ?? 0)
                        ? f.riskLevel
                        : r;
                    }, "low");
                    return (
                      <tr key={tool.name} className="hover:bg-slate-50">
                        <td className="py-3 font-medium text-slate-900">{tool.name}</td>
                        <td className="py-3">
                          <Badge variant="outline" className={`text-xs ${STATUS_COLORS[tool.status]}`}>
                            {tool.status}
                          </Badge>
                        </td>
                        <td className="py-3 text-slate-600">{tool.users}</td>
                        <td className="py-3 text-slate-600">{tool.totalRequests24h.toLocaleString()}</td>
                        <td className="py-3">
                          {tool.piiExposed > 0 ? (
                            <span className="text-amber-600 font-medium">{tool.piiExposed}</span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="py-3 text-slate-500">{timeAgo(tool.lastActivity)}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <div className={`h-2 w-2 rounded-full ${RISK_COLORS[highestRisk] ?? RISK_COLORS.low}`} />
                            <span className="text-xs text-slate-600 capitalize">{highestRisk}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Data Flow Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {tools.length === 0 ? (
            <p className="text-sm text-slate-500">No flows to display.</p>
          ) : (
            <div className="space-y-4">
              {tools.map((tool) => (
                <div key={tool.name} className="rounded-lg border border-slate-100 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm text-slate-900">{tool.name}</span>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${RISK_COLORS[tool.dataFlows[0]?.riskLevel ?? "low"]}`} />
                      <span className="text-xs text-slate-500">
                        {tool.dataFlows[0]?.riskLevel ?? "low"} risk
                      </span>
                    </div>
                  </div>
                  {tool.dataFlows.map((flow, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                      <span className="text-slate-400">In:</span>
                      <span>{flow.inbound}</span>
                      <span className="text-slate-300">→</span>
                      <span className="text-slate-400">Out:</span>
                      <span>{flow.outbound}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
