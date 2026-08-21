"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type MCPServerRow = {
  id: string;
  name: string;
};

type MCPToolRow = {
  id: string;
  mcp_server_id: string;
  ai_system_id: string | null;
  name: string;
  capability_categories: string[];
  data_sensitivity: string;
  external_access: boolean;
  write_access: boolean;
  credential_access: boolean;
  approval_status: string;
  risk_tier: "critical" | "high" | "medium" | "low";
  risk_score: number;
  owner_name: string | null;
  status: string;
  last_activity_at: string | null;
};

type AISystemOption = {
  id: string;
  name: string;
};

const capabilities = [
  "read",
  "write",
  "execute",
  "data_export",
  "credential_access",
  "admin",
  "external_network",
  "file_access",
  "database_access",
  "custom",
];

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

const fieldClass = "space-y-1.5";
const fieldLabelClass = "text-xs font-medium text-muted-foreground";
const selectClass = "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm";

export default function MCPToolsPage() {
  const [servers, setServers] = useState<MCPServerRow[]>([]);
  const [tools, setTools] = useState<MCPToolRow[]>([]);
  const [systems, setSystems] = useState<AISystemOption[]>([]);
  const [selectedServerId, setSelectedServerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    capabilityCategories: ["read"],
    dataSensitivity: "internal",
    externalAccess: false,
    writeAccess: false,
    credentialAccess: false,
    approvalStatus: "pending_review",
    ownerName: "",
    ownerEmail: "",
    aiSystemId: "",
  });

  async function load() {
    setLoading(true);
    try {
      const [serverRes, toolRes, systemsRes] = await Promise.all([
        fetch("/api/mcp-guard/servers"),
        fetch("/api/mcp-guard/tools"),
        fetch("/api/ai-systems?status=active"),
      ]);
      const [serverData, toolData, systemsData] = await Promise.all([
        serverRes.json(),
        toolRes.json(),
        systemsRes.json(),
      ]);
      const nextServers = serverData.servers ?? [];
      setServers(nextServers);
      setTools(toolData.tools ?? []);
      setSystems(systemsData.systems ?? []);
      setSelectedServerId((current) => current || nextServers[0]?.id || "");
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
    return selectedServerId
      ? tools.filter((tool) => tool.mcp_server_id === selectedServerId)
      : tools;
  }, [selectedServerId, tools]);

  async function createTool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedServerId) {
      setError("Create an MCP server before adding tools.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/mcp-guard/servers/${selectedServerId}/tools`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          aiSystemId: form.aiSystemId || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? data.error ?? "Unable to create MCP tool.");
        return;
      }
      setForm({
        name: "",
        description: "",
        capabilityCategories: ["read"],
        dataSensitivity: "internal",
        externalAccess: false,
        writeAccess: false,
        credentialAccess: false,
        approvalStatus: "pending_review",
        ownerName: "",
        ownerEmail: "",
        aiSystemId: "",
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function updateTool(id: string, patch: Record<string, string | null>) {
    const response = await fetch(`/api/mcp-guard/tools/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (response.ok) await load();
  }

  function toggleCapability(value: string) {
    const current = new Set(form.capabilityCategories);
    if (current.has(value)) current.delete(value);
    else current.add(value);
    setForm({
      ...form,
      capabilityCategories: current.size ? Array.from(current) : ["read"],
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">MCP Tools</h2>
        <p className="text-sm text-slate-500">
          Track exposed MCP tools, access capabilities, AI System linkage, and risk tier.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" />
            Add MCP Tool
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createTool} className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-4">
              <div className={fieldClass}>
                <Label htmlFor="mcp-tool-server" className={fieldLabelClass}>MCP server</Label>
                <select
                  id="mcp-tool-server"
                  value={selectedServerId}
                  onChange={(event) => setSelectedServerId(event.target.value)}
                  className={selectClass}
                >
                  <option value="">Select MCP server</option>
                  {servers.map((server) => (
                    <option key={server.id} value={server.id}>{server.name}</option>
                  ))}
                </select>
              </div>
              <div className={fieldClass}>
                <Label htmlFor="mcp-tool-name" className={fieldLabelClass}>Tool name</Label>
                <Input
                  id="mcp-tool-name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="filesystem.read_file.smoke"
                  required
                />
              </div>
              <div className={fieldClass}>
                <Label htmlFor="mcp-tool-data-sensitivity" className={fieldLabelClass}>Data sensitivity</Label>
                <select
                  id="mcp-tool-data-sensitivity"
                  value={form.dataSensitivity}
                  onChange={(event) => setForm({ ...form, dataSensitivity: event.target.value })}
                  className={selectClass}
                >
                  {["public", "internal", "confidential", "restricted"].map((value) => (
                    <option key={value} value={value}>{humanize(value)}</option>
                  ))}
                </select>
              </div>
              <div className={fieldClass}>
                <Label htmlFor="mcp-tool-ai-system" className={fieldLabelClass}>Linked AI System</Label>
                <select
                  id="mcp-tool-ai-system"
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
              <div className={fieldClass}>
                <Label htmlFor="mcp-tool-owner" className={fieldLabelClass}>Owner</Label>
                <Input
                  id="mcp-tool-owner"
                  value={form.ownerName}
                  onChange={(event) => setForm({ ...form, ownerName: event.target.value })}
                  placeholder="Security owner"
                />
              </div>
              <div className={fieldClass}>
                <Label htmlFor="mcp-tool-owner-email" className={fieldLabelClass}>Owner email</Label>
                <Input
                  id="mcp-tool-owner-email"
                  value={form.ownerEmail}
                  onChange={(event) => setForm({ ...form, ownerEmail: event.target.value })}
                  placeholder="owner@example.com"
                />
              </div>
              <div className={fieldClass}>
                <Label htmlFor="mcp-tool-approval" className={fieldLabelClass}>Initial approval</Label>
                <select
                  id="mcp-tool-approval"
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
                <Label htmlFor="mcp-tool-description" className={fieldLabelClass}>Description</Label>
                <Input
                  id="mcp-tool-description"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="What this tool can do"
                />
              </div>
            </div>
            <fieldset className="space-y-2">
              <legend className={fieldLabelClass}>Capabilities</legend>
              <div className="flex flex-wrap gap-2">
                {capabilities.map((capability) => (
                  <button
                    type="button"
                    key={capability}
                    onClick={() => toggleCapability(capability)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      form.capabilityCategories.includes(capability)
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                    aria-pressed={form.capabilityCategories.includes(capability)}
                  >
                    {humanize(capability)}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <fieldset className="space-y-2">
                <legend className={fieldLabelClass}>Access flags</legend>
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.externalAccess}
                      onChange={(event) => setForm({ ...form, externalAccess: event.target.checked })}
                    />
                    External access
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.writeAccess}
                      onChange={(event) => setForm({ ...form, writeAccess: event.target.checked })}
                    />
                    Write access
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.credentialAccess}
                      onChange={(event) => setForm({ ...form, credentialAccess: event.target.checked })}
                    />
                    Credential access
                  </label>
                </div>
              </fieldset>
              <Button type="submit" disabled={saving} className="h-10">
                {saving ? "Saving..." : "Create Tool"}
              </Button>
            </div>
          </form>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tool Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading MCP tools...</p>
          ) : visibleTools.length === 0 ? (
            <div className="py-10 text-center">
              <ShieldCheck className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-700">No MCP tools recorded</p>
              <p className="mt-1 text-sm text-slate-500">Add a tool above after creating a server.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    <th className="pb-3 font-medium text-slate-500">Tool</th>
                    <th className="pb-3 font-medium text-slate-500">Risk</th>
                    <th className="pb-3 font-medium text-slate-500">Capabilities</th>
                    <th className="pb-3 font-medium text-slate-500">Approval</th>
                    <th className="pb-3 font-medium text-slate-500">AI System</th>
                    <th className="pb-3 font-medium text-slate-500">Last Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {visibleTools.map((tool) => (
                    <tr key={tool.id}>
                      <td className="py-3">
                        <p className="font-medium text-slate-900">{tool.name}</p>
                        <p className="text-xs text-slate-500">{tool.owner_name || "Unassigned"}</p>
                      </td>
                      <td className="py-3">
                        <Badge className={riskClass[tool.risk_tier]}>
                          {humanize(tool.risk_tier)} {tool.risk_score}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {tool.capability_categories.map((capability) => (
                            <Badge key={capability} variant="outline">{humanize(capability)}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-3">
                        <select
                          aria-label={`Approval status for ${tool.name}`}
                          value={tool.approval_status}
                          onChange={(event) => updateTool(tool.id, { approvalStatus: event.target.value })}
                          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs"
                        >
                          {["pending_review", "approved", "blocked", "deprecated"].map((value) => (
                            <option key={value} value={value}>{humanize(value)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3">
                        <select
                          aria-label={`Linked AI System for ${tool.name}`}
                          value={tool.ai_system_id ?? ""}
                          onChange={(event) => updateTool(tool.id, { aiSystemId: event.target.value || null })}
                          className="h-8 max-w-48 rounded-md border border-slate-200 bg-white px-2 text-xs"
                        >
                          <option value="">Unlinked</option>
                          {systems.map((system) => (
                            <option key={system.id} value={system.id}>{system.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 text-slate-500">{timeAgo(tool.last_activity_at)}</td>
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
