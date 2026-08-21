"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Activity, Send, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type MCPServerRow = {
  id: string;
  name: string;
};

type MCPToolRow = {
  id: string;
  mcp_server_id: string;
  name: string;
  approval_status: string;
  risk_tier: "critical" | "high" | "medium" | "low";
};

type MCPEventRow = {
  id: string;
  mcp_server_id: string | null;
  mcp_tool_id: string | null;
  tool_name: string;
  server_name: string | null;
  client_name: string | null;
  user_email: string;
  activity_type: string;
  data_sensitivity: string;
  risk_level: "critical" | "high" | "medium" | "low";
  decision: "allow" | "warn" | "block" | "quarantine";
  decision_reason: string | null;
  raw_payload: Record<string, number | undefined> | null;
  created_at: string;
};

type IntakeResult = {
  decision: string;
  blocked: boolean;
  reason: string;
  riskLevel: string;
  matchedToolId: string | null;
};

const decisionClass: Record<string, string> = {
  allow: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warn: "bg-amber-50 text-amber-700 border-amber-200",
  block: "bg-red-50 text-red-700 border-red-200",
  quarantine: "bg-violet-50 text-violet-700 border-violet-200",
};

const riskClass: Record<string, string> = {
  critical: "bg-red-50 text-red-700 border-red-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function MCPEventsPage() {
  const [servers, setServers] = useState<MCPServerRow[]>([]);
  const [tools, setTools] = useState<MCPToolRow[]>([]);
  const [events, setEvents] = useState<MCPEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<IntakeResult | null>(null);
  const [form, setForm] = useState({
    serverId: "",
    toolId: "",
    serverName: "",
    toolName: "",
    clientName: "Manual QA",
    userEmail: "",
    activityType: "tool_invocation",
    inputContent: "",
    outputContent: "",
    metadataResource: "",
  });

  async function load() {
    setLoading(true);
    try {
      const [serverRes, toolRes, eventRes] = await Promise.all([
        fetch("/api/mcp-guard/servers"),
        fetch("/api/mcp-guard/tools"),
        fetch("/api/mcp-guard/events?limit=100"),
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

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, []);

  const visibleTools = useMemo(() => {
    if (!form.serverId) return tools;
    return tools.filter((tool) => tool.mcp_server_id === form.serverId);
  }, [form.serverId, tools]);

  function chooseServer(serverId: string) {
    const server = servers.find((item) => item.id === serverId);
    setForm({
      ...form,
      serverId,
      serverName: server?.name ?? "",
      toolId: "",
      toolName: "",
    });
  }

  function chooseTool(toolId: string) {
    const tool = tools.find((item) => item.id === toolId);
    const server = servers.find((item) => item.id === tool?.mcp_server_id);
    setForm({
      ...form,
      toolId,
      toolName: tool?.name ?? "",
      serverId: tool?.mcp_server_id ?? form.serverId,
      serverName: server?.name ?? form.serverName,
    });
  }

  async function ingestEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/mcp-guard/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serverId: form.serverId || null,
          toolId: form.toolId || null,
          serverName: form.serverName,
          toolName: form.toolName,
          clientName: form.clientName,
          userEmail: form.userEmail,
          activityType: form.activityType,
          inputContent: form.inputContent,
          outputContent: form.outputContent,
          metadata: {
            source: "manual_mcp_guard_event",
            resourceName: form.metadataResource,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? data.error ?? "Unable to ingest MCP event.");
        return;
      }
      setResult(data);
      setForm({
        ...form,
        inputContent: "",
        outputContent: "",
        metadataResource: "",
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">MCP Tool Events</h2>
        <p className="text-sm text-slate-500">
          Intake MCP tool activity and return the AgentGuard policy decision.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4" />
            Ingest Event
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={ingestEvent} className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-4">
              <select
                value={form.serverId}
                onChange={(event) => chooseServer(event.target.value)}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">Unknown or unregistered server</option>
                {servers.map((server) => (
                  <option key={server.id} value={server.id}>{server.name}</option>
                ))}
              </select>
              <select
                value={form.toolId}
                onChange={(event) => chooseTool(event.target.value)}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">Unknown or unregistered tool</option>
                {visibleTools.map((tool) => (
                  <option key={tool.id} value={tool.id}>
                    {tool.name} - {humanize(tool.risk_tier)}
                  </option>
                ))}
              </select>
              <Input
                value={form.toolName}
                onChange={(event) => setForm({ ...form, toolName: event.target.value })}
                placeholder="Tool name"
                required
              />
              <Input
                value={form.userEmail}
                onChange={(event) => setForm({ ...form, userEmail: event.target.value })}
                placeholder="user@company.com"
                type="email"
                required
              />
              <Input
                value={form.serverName}
                onChange={(event) => setForm({ ...form, serverName: event.target.value })}
                placeholder="Server name"
              />
              <Input
                value={form.clientName}
                onChange={(event) => setForm({ ...form, clientName: event.target.value })}
                placeholder="Client"
              />
              <select
                value={form.activityType}
                onChange={(event) => setForm({ ...form, activityType: event.target.value })}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                {["tool_invocation", "prompt_sent", "file_upload", "api_call", "agent_action", "data_export"].map((value) => (
                  <option key={value} value={value}>{humanize(value)}</option>
                ))}
              </select>
              <Input
                value={form.metadataResource}
                onChange={(event) => setForm({ ...form, metadataResource: event.target.value })}
                placeholder="Resource label"
              />
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <textarea
                value={form.inputContent}
                onChange={(event) => setForm({ ...form, inputContent: event.target.value })}
                placeholder="Input content sample for classification"
                className="min-h-28 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus-visible:border-slate-400"
              />
              <textarea
                value={form.outputContent}
                onChange={(event) => setForm({ ...form, outputContent: event.target.value })}
                placeholder="Output content sample for classification"
                className="min-h-28 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus-visible:border-slate-400"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Evaluating..." : "Ingest Event"}
              </Button>
              {result && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <Badge className={decisionClass[result.decision] ?? decisionClass.allow}>
                    {humanize(result.decision)}
                  </Badge>
                  <Badge className={riskClass[result.riskLevel] ?? riskClass.low}>
                    {humanize(result.riskLevel)}
                  </Badge>
                  <span>{result.reason}</span>
                </div>
              )}
            </div>
          </form>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Event Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading MCP events...</p>
          ) : events.length === 0 ? (
            <div className="py-10 text-center">
              <ShieldAlert className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-700">No MCP events recorded</p>
              <p className="mt-1 text-sm text-slate-500">Submit an event above to validate intake.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    <th className="pb-3 font-medium text-slate-500">Tool</th>
                    <th className="pb-3 font-medium text-slate-500">User</th>
                    <th className="pb-3 font-medium text-slate-500">Decision</th>
                    <th className="pb-3 font-medium text-slate-500">Risk</th>
                    <th className="pb-3 font-medium text-slate-500">Stored Payload</th>
                    <th className="pb-3 font-medium text-slate-500">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td className="py-3">
                        <p className="font-medium text-slate-900">{event.tool_name}</p>
                        <p className="text-xs text-slate-500">
                          {event.server_name || "Unknown server"} - {event.mcp_tool_id ? "Known" : "Unknown"}
                        </p>
                      </td>
                      <td className="py-3 text-slate-600">
                        <p>{event.user_email}</p>
                        <p className="text-xs text-slate-400">{event.client_name || "No client"}</p>
                      </td>
                      <td className="py-3">
                        <Badge className={decisionClass[event.decision] ?? decisionClass.allow}>
                          {humanize(event.decision)}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <Badge className={riskClass[event.risk_level] ?? riskClass.low}>
                          {humanize(event.risk_level)}
                        </Badge>
                      </td>
                      <td className="py-3 text-slate-500">
                        {event.raw_payload?.input_length ?? event.raw_payload?.content_length ?? 0} in /{" "}
                        {event.raw_payload?.output_length ?? 0} out
                      </td>
                      <td className="py-3 text-slate-500">{timeAgo(event.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
