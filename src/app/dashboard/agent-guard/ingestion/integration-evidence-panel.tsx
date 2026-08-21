"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck, ExternalLink, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AGENT_GUARD_INTEGRATION_EVIDENCE_CHECKLIST,
  AGENT_GUARD_INTEGRATION_EVIDENCE_COPY,
  AGENT_GUARD_INTEGRATION_EVIDENCE_STATUSES,
  type AgentGuardIntegrationEvidence,
  type AgentGuardIntegrationEvidenceChecklistItem,
  type AgentGuardIntegrationEvidenceStatus,
} from "@/lib/agent-guard/integration-evidence";

type SourceOption = {
  id: string;
  name: string;
  environment: "production" | "staging" | "development" | "other";
  status: "active" | "revoked";
};

type IntegrationEvidencePanelProps = {
  sources: SourceOption[];
};

type FormState = {
  sourceId: string;
  title: string;
  implementationOwner: string;
  wrapperLocation: string;
  evidenceUrl: string;
  status: AgentGuardIntegrationEvidenceStatus;
  note: string;
};

const STATUS_CLASSES: Record<AgentGuardIntegrationEvidenceStatus, string> = {
  planned: "border-slate-200 bg-slate-100 text-slate-700",
  in_progress: "border-blue-200 bg-blue-50 text-blue-700",
  pilot_ready: "border-green-200 bg-green-50 text-green-700",
  needs_review: "border-amber-200 bg-amber-50 text-amber-800",
  retired: "border-slate-200 bg-slate-100 text-slate-500",
};

const DEFAULT_FORM: FormState = {
  sourceId: "",
  title: "AgentGuard source implementation evidence",
  implementationOwner: "",
  wrapperLocation: "",
  evidenceUrl: "",
  status: "in_progress",
  note: "",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

async function readJson(response: Response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? "Integration evidence could not load.");
  }
  return data;
}

export function IntegrationEvidencePanel({ sources }: IntegrationEvidencePanelProps) {
  const [evidence, setEvidence] = useState<AgentGuardIntegrationEvidence[]>([]);
  const [checklist, setChecklist] = useState<AgentGuardIntegrationEvidenceChecklistItem[]>(
    AGENT_GUARD_INTEGRATION_EVIDENCE_CHECKLIST
  );
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [migrationWarning, setMigrationWarning] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/agent-guard/integration-evidence?limit=50")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          if (data.error === "migration_required") {
            return {
              evidence: [],
              migrationWarning:
                data.message ?? AGENT_GUARD_INTEGRATION_EVIDENCE_COPY.migrationWarning,
            };
          }
          throw new Error(
            data.message ?? data.error ?? "Integration evidence could not load."
          );
        }
        return { evidence: data.evidence ?? [], migrationWarning: null };
      })
      .then((result) => {
        if (!active) return;
        setEvidence(result.evidence);
        setMigrationWarning(result.migrationWarning);
      })
      .catch((err) => {
        if (active) {
          setNotice(
            err instanceof Error
              ? err.message
              : "Integration evidence could not load."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleChecklist(id: AgentGuardIntegrationEvidenceChecklistItem["id"]) {
    setChecklist((current) =>
      current.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  }

  async function saveEvidence() {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/agent-guard/integration-evidence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceId: form.sourceId || null,
          title: form.title,
          implementationOwner: form.implementationOwner,
          wrapperLocation: form.wrapperLocation,
          evidenceUrl: form.evidenceUrl,
          status: form.status,
          checklistSnapshot: checklist,
          note: form.note,
        }),
      });
      const data = await readJson(response);
      setEvidence((current) => [data.evidence, ...current]);
      setForm(DEFAULT_FORM);
      setChecklist(AGENT_GUARD_INTEGRATION_EVIDENCE_CHECKLIST);
      setMigrationWarning(null);
      setNotice("Integration evidence saved.");
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Integration evidence could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateEvidenceStatus(
    item: AgentGuardIntegrationEvidence,
    status: AgentGuardIntegrationEvidenceStatus
  ) {
    setUpdatingId(item.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/agent-guard/integration-evidence/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await readJson(response);
      setEvidence((current) =>
        current.map((record) => (record.id === item.id ? data.evidence : record))
      );
      setNotice("Integration evidence status updated.");
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Integration evidence could not update."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <ClipboardCheck className="h-4 w-4 text-[color:var(--brand)]" />
          Integration Evidence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm leading-6 text-muted-foreground">
            {AGENT_GUARD_INTEGRATION_EVIDENCE_COPY.overview}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {AGENT_GUARD_INTEGRATION_EVIDENCE_COPY.boundary}
          </p>
          <p className="mt-2 text-xs leading-5 text-amber-700">
            {AGENT_GUARD_INTEGRATION_EVIDENCE_COPY.secretWarning}
          </p>
        </div>

        {migrationWarning ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
            {migrationWarning}
          </div>
        ) : null}

        {notice ? (
          <div className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">
            {notice}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                Evidence title
              </label>
              <input
                value={form.title}
                onChange={(event) => setField("title", event.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Source
                </label>
                <select
                  value={form.sourceId}
                  onChange={(event) => setField("sourceId", event.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">No source selected</option>
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name} ({source.environment})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setField(
                      "status",
                      event.target.value as AgentGuardIntegrationEvidenceStatus
                    )
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  {Object.entries(AGENT_GUARD_INTEGRATION_EVIDENCE_STATUSES).map(
                    ([value, status]) => (
                      <option key={value} value={value}>
                        {status.label}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                Owner or team
              </label>
              <input
                value={form.implementationOwner}
                onChange={(event) =>
                  setField("implementationOwner", event.target.value)
                }
                placeholder="Security engineering"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                Wrapper location
              </label>
              <input
                value={form.wrapperLocation}
                onChange={(event) => setField("wrapperLocation", event.target.value)}
                placeholder="Internal service, repo path, gateway, or runbook location"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                Evidence URL
              </label>
              <input
                value={form.evidenceUrl}
                onChange={(event) => setField("evidenceUrl", event.target.value)}
                placeholder="Ticket, PR, architecture note, or runbook URL"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                Note
              </label>
              <textarea
                value={form.note}
                onChange={(event) => setField("note", event.target.value)}
                rows={4}
                placeholder="Short metadata-only note. Do not paste source keys or raw activity content."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">
              Implementation checklist
            </p>
            <div className="space-y-2">
              {checklist.map((item) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer gap-3 rounded-lg border border-border bg-background p-3"
                >
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => toggleChecklist(item.id)}
                    className="mt-1 h-4 w-4 rounded border-border"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-foreground">
                      {item.label}
                    </span>
                    <span className="block text-xs leading-5 text-muted-foreground">
                      {item.detail}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <Button
              variant="brand"
              size="sm"
              disabled={saving || Boolean(migrationWarning)}
              onClick={saveEvidence}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {saving ? "Saving..." : "Save evidence"}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">
              Saved integration evidence
            </p>
            <Badge variant="outline">
              {loading ? "Loading" : `${evidence.length} record${evidence.length === 1 ? "" : "s"}`}
            </Badge>
          </div>

          {evidence.length === 0 ? (
            <div className="rounded-lg border border-border bg-background p-5 text-sm text-muted-foreground">
              No integration evidence records saved yet.
            </div>
          ) : (
            <div className="space-y-3">
              {evidence.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-border bg-background p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {item.title}
                        </p>
                        <Badge
                          variant="outline"
                          className={STATUS_CLASSES[item.status]}
                        >
                          {item.statusLabel}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {item.sourceName
                          ? `${item.sourceName} (${item.sourceEnvironment ?? "unknown"})`
                          : "No source selected"}{" "}
                        · {item.completedChecklistCount}/
                        {item.checklistSnapshot.length} checklist items · Updated{" "}
                        {formatDate(item.updatedAt)}
                      </p>
                    </div>
                    <select
                      value={item.status}
                      disabled={updatingId === item.id}
                      onChange={(event) =>
                        updateEvidenceStatus(
                          item,
                          event.target.value as AgentGuardIntegrationEvidenceStatus
                        )
                      }
                      className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
                    >
                      {Object.entries(AGENT_GUARD_INTEGRATION_EVIDENCE_STATUSES).map(
                        ([value, status]) => (
                          <option key={value} value={value}>
                            {status.label}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                        Owner
                      </p>
                      <p className="mt-1 text-sm text-foreground">
                        {item.implementationOwner || "Not recorded"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                        Wrapper
                      </p>
                      <p className="mt-1 break-words text-sm text-foreground">
                        {item.wrapperLocation || "Not recorded"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                        Evidence
                      </p>
                      {item.evidenceUrl ? (
                        <a
                          href={item.evidenceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 break-all text-sm font-medium text-[color:var(--brand)]"
                        >
                          Open link
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <p className="mt-1 text-sm text-foreground">Not recorded</p>
                      )}
                    </div>
                  </div>

                  {item.note ? (
                    <p className="mt-3 rounded-lg border border-border bg-card p-3 text-xs leading-5 text-muted-foreground">
                      {item.note}
                    </p>
                  ) : null}

                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {item.checklistSnapshot.map((checklistItem) => (
                      <div
                        key={checklistItem.id}
                        className="flex gap-2 rounded-lg border border-border bg-card p-3"
                      >
                        <CheckCircle2
                          className={`mt-0.5 h-3.5 w-3.5 ${
                            checklistItem.completed
                              ? "text-green-600"
                              : "text-muted-foreground"
                          }`}
                        />
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            {checklistItem.label}
                          </p>
                          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                            {checklistItem.detail}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
