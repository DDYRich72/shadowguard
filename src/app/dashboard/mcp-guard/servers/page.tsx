"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, ServerCog } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type MCPServerRow = {
  id: string;
  name: string;
  description: string | null;
  server_url: string | null;
  transport: string;
  owner_name: string | null;
  owner_email: string | null;
  department: string | null;
  environment: string;
  status: string;
  approval_status: string;
  ai_system_id: string | null;
  updated_at: string;
};

type AISystemOption = {
  id: string;
  name: string;
};

const statusClass: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  paused: "bg-amber-50 text-amber-700 border-amber-200",
  blocked: "bg-red-50 text-red-700 border-red-200",
  archived: "bg-slate-50 text-slate-500 border-slate-200",
};

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const fieldClass = "space-y-1.5";
const fieldLabelClass = "text-xs font-medium text-muted-foreground";
const selectClass = "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm";

export default function MCPServersPage() {
  const [servers, setServers] = useState<MCPServerRow[]>([]);
  const [systems, setSystems] = useState<AISystemOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    serverUrl: "",
    transport: "unknown",
    ownerName: "",
    ownerEmail: "",
    department: "",
    environment: "unknown",
    approvalStatus: "pending_review",
    aiSystemId: "",
  });

  async function load() {
    setLoading(true);
    try {
      const [serverRes, systemsRes] = await Promise.all([
        fetch("/api/mcp-guard/servers"),
        fetch("/api/ai-systems?status=active"),
      ]);
      const [serverData, systemsData] = await Promise.all([
        serverRes.json(),
        systemsRes.json(),
      ]);
      setServers(serverData.servers ?? []);
      setSystems(systemsData.systems ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, []);

  async function createServer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/mcp-guard/servers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          aiSystemId: form.aiSystemId || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? data.error ?? "Unable to create MCP server.");
        return;
      }
      setForm({
        name: "",
        description: "",
        serverUrl: "",
        transport: "unknown",
        ownerName: "",
        ownerEmail: "",
        department: "",
        environment: "unknown",
        approvalStatus: "pending_review",
        aiSystemId: "",
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function updateServer(id: string, patch: Record<string, string | null>) {
    const response = await fetch(`/api/mcp-guard/servers/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (response.ok) await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">MCP Servers</h2>
        <p className="text-sm text-slate-500">
          Register MCP servers that expose tools to AI agents and assistants.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" />
            Add MCP Server
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createServer} className="grid gap-3 lg:grid-cols-4">
            <div className={fieldClass}>
              <Label htmlFor="mcp-server-name" className={fieldLabelClass}>Server name</Label>
              <Input
                id="mcp-server-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Smoke MCP Server 2026-05-24"
                required
              />
            </div>
            <div className={fieldClass}>
              <Label htmlFor="mcp-server-url" className={fieldLabelClass}>URL, command, or host</Label>
              <Input
                id="mcp-server-url"
                value={form.serverUrl}
                onChange={(event) => setForm({ ...form, serverUrl: event.target.value })}
                placeholder="npx @modelcontextprotocol/server-filesystem"
              />
            </div>
            <div className={fieldClass}>
              <Label htmlFor="mcp-server-transport" className={fieldLabelClass}>Transport</Label>
              <select
                id="mcp-server-transport"
                value={form.transport}
                onChange={(event) => setForm({ ...form, transport: event.target.value })}
                className={selectClass}
              >
                {["unknown", "stdio", "http", "sse", "websocket", "other"].map((value) => (
                  <option key={value} value={value}>{humanize(value)}</option>
                ))}
              </select>
            </div>
            <div className={fieldClass}>
              <Label htmlFor="mcp-server-environment" className={fieldLabelClass}>Environment</Label>
              <select
                id="mcp-server-environment"
                value={form.environment}
                onChange={(event) => setForm({ ...form, environment: event.target.value })}
                className={selectClass}
              >
                {["unknown", "production", "staging", "development", "local"].map((value) => (
                  <option key={value} value={value}>{humanize(value)}</option>
                ))}
              </select>
            </div>
            <div className={fieldClass}>
              <Label htmlFor="mcp-server-owner" className={fieldLabelClass}>Owner</Label>
              <Input
                id="mcp-server-owner"
                value={form.ownerName}
                onChange={(event) => setForm({ ...form, ownerName: event.target.value })}
                placeholder="Security owner"
              />
            </div>
            <div className={fieldClass}>
              <Label htmlFor="mcp-server-owner-email" className={fieldLabelClass}>Owner email</Label>
              <Input
                id="mcp-server-owner-email"
                value={form.ownerEmail}
                onChange={(event) => setForm({ ...form, ownerEmail: event.target.value })}
                placeholder="owner@example.com"
              />
            </div>
            <div className={fieldClass}>
              <Label htmlFor="mcp-server-department" className={fieldLabelClass}>Department</Label>
              <Input
                id="mcp-server-department"
                value={form.department}
                onChange={(event) => setForm({ ...form, department: event.target.value })}
                placeholder="Security"
              />
            </div>
            <div className={fieldClass}>
              <Label htmlFor="mcp-server-approval" className={fieldLabelClass}>Initial approval</Label>
              <select
                id="mcp-server-approval"
                value={form.approvalStatus}
                onChange={(event) => setForm({ ...form, approvalStatus: event.target.value })}
                className={selectClass}
              >
                {["pending_review", "approved", "blocked", "deprecated"].map((value) => (
                  <option key={value} value={value}>{humanize(value)}</option>
                ))}
              </select>
            </div>
            <div className={fieldClass}>
              <Label htmlFor="mcp-server-ai-system" className={fieldLabelClass}>Linked AI System</Label>
              <select
                id="mcp-server-ai-system"
                value={form.aiSystemId}
                onChange={(event) => setForm({ ...form, aiSystemId: event.target.value })}
                className={selectClass}
              >
                <option value="">No linked AI System</option>
                {systems.map((system) => (
                  <option key={system.id} value={system.id}>{system.name}</option>
                ))}
              </select>
            </div>
            <div className={`${fieldClass} lg:col-span-2`}>
              <Label htmlFor="mcp-server-description" className={fieldLabelClass}>Description</Label>
              <Input
                id="mcp-server-description"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="What this MCP server exposes"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={saving} className="h-10 w-full">
                {saving ? "Saving..." : "Create Server"}
              </Button>
            </div>
          </form>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Server Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading MCP servers...</p>
          ) : servers.length === 0 ? (
            <div className="py-10 text-center">
              <ServerCog className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-700">No MCP servers registered</p>
              <p className="mt-1 text-sm text-slate-500">Add the first server above to start governing exposed tools.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    <th className="pb-3 font-medium text-slate-500">Server</th>
                    <th className="pb-3 font-medium text-slate-500">Owner</th>
                    <th className="pb-3 font-medium text-slate-500">Transport</th>
                    <th className="pb-3 font-medium text-slate-500">Approval</th>
                    <th className="pb-3 font-medium text-slate-500">Status</th>
                    <th className="pb-3 font-medium text-slate-500">AI System</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {servers.map((server) => (
                    <tr key={server.id}>
                      <td className="py-3">
                        <p className="font-medium text-slate-900">{server.name}</p>
                        <p className="max-w-xs truncate text-xs text-slate-500">{server.server_url || "No endpoint recorded"}</p>
                      </td>
                      <td className="py-3 text-slate-600">
                        <p>{server.owner_name || "Unassigned"}</p>
                        <p className="text-xs text-slate-400">{server.department || "No department"}</p>
                      </td>
                      <td className="py-3 text-slate-600">{humanize(server.transport)}</td>
                      <td className="py-3">
                        <select
                          aria-label={`Approval status for ${server.name}`}
                          value={server.approval_status}
                          onChange={(event) => updateServer(server.id, { approvalStatus: event.target.value })}
                          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs"
                        >
                          {["pending_review", "approved", "blocked", "deprecated"].map((value) => (
                            <option key={value} value={value}>{humanize(value)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3">
                        <Badge className={statusClass[server.status] ?? statusClass.active}>
                          {humanize(server.status)}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <select
                          aria-label={`Linked AI System for ${server.name}`}
                          value={server.ai_system_id ?? ""}
                          onChange={(event) => updateServer(server.id, { aiSystemId: event.target.value || null })}
                          className="h-8 max-w-48 rounded-md border border-slate-200 bg-white px-2 text-xs"
                        >
                          <option value="">Unlinked</option>
                          {systems.map((system) => (
                            <option key={system.id} value={system.id}>{system.name}</option>
                          ))}
                        </select>
                      </td>
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
