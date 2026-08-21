"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Archive,
  ChevronLeft,
  CircleCheck,
  ClipboardCheck,
  ExternalLink,
  FileText,
  ListChecks,
  Pencil,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AISystemForm, type AISystemFormRecord } from "@/components/dashboard/ai-system-form";
import type {
  AIFrameworkMapping,
  AIGovernanceRiskTier,
  AIEvidenceCategory,
  AIEvidenceStatus,
  AISystemApprovalStatus,
  AISystemControl,
  AISystemControlStatus,
  AISystemEvidence,
  ControlReadinessSummary,
  RecommendedControl,
} from "@/lib/ai-governance/types";
import { calculateControlReadiness } from "@/lib/ai-governance/controls";
import { groupEvidenceByControl } from "@/lib/ai-governance/evidence";
import { frameworkMappingsForControl } from "@/lib/ai-governance/frameworks";

type Assessment = {
  id: string;
  version: number;
  overall_score: number;
  risk_tier: AIGovernanceRiskTier;
  summary: string | null;
  recommended_controls: RecommendedControl[] | null;
  created_at: string;
};

type DetailResponse = {
  system: AISystemFormRecord & {
    risk_tier: AIGovernanceRiskTier;
    source: string;
    status: "active" | "archived";
    created_at: string;
    updated_at: string;
  };
  latestAssessment: Assessment | null;
  controls: AISystemControl[];
  evidence: AISystemEvidence[];
  readiness: ControlReadinessSummary;
};

type ApiErrorBody = {
  error?: string;
  message?: string;
};

const riskClass: Record<AIGovernanceRiskTier, string> = {
  critical: "bg-red-50 text-red-700 border-red-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const approvalClass: Record<AISystemApprovalStatus, string> = {
  discovered: "bg-slate-50 text-slate-700 border-slate-200",
  under_review: "bg-blue-50 text-blue-700 border-blue-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  blocked: "bg-red-50 text-red-700 border-red-200",
  retired: "bg-slate-50 text-slate-500 border-slate-200",
};

const controlStatusClass: Record<AISystemControlStatus, string> = {
  not_started: "bg-slate-50 text-slate-600 border-slate-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  waived: "bg-violet-50 text-violet-700 border-violet-200",
};

const evidenceStatusClass: Record<AIEvidenceStatus, string> = {
  draft: "bg-slate-50 text-slate-600 border-slate-200",
  current: "bg-emerald-50 text-emerald-700 border-emerald-200",
  needs_review: "bg-amber-50 text-amber-700 border-amber-200",
  expired: "bg-red-50 text-red-700 border-red-200",
};

const evidenceCategories: AIEvidenceCategory[] = [
  "policy",
  "vendor_review",
  "security_review",
  "privacy_review",
  "approval",
  "audit_log",
  "training",
  "other",
];

const evidenceStatuses: AIEvidenceStatus[] = [
  "draft",
  "current",
  "needs_review",
  "expired",
];

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateOnly(value: string | null): string {
  if (!value) return "Not set";
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function mappingsForControl(control: AISystemControl): AIFrameworkMapping[] {
  return control.framework_mappings?.length
    ? control.framework_mappings
    : frameworkMappingsForControl({
        key: control.control_key,
        category: control.category,
      });
}

function loadErrorMessage(status: number, body: ApiErrorBody | null): string {
  if (body?.error === "migration_required") {
    return body.message ?? "Governance control storage is unavailable. Apply the current initial schema before loading this page.";
  }
  if (status === 404 || body?.error === "not_found") {
    return "AI system not found.";
  }
  if (status === 401) {
    return "Please sign in again to view this AI system.";
  }
  return body?.message ?? body?.error ?? "Unable to load AI system.";
}

export default function AISystemDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await fetch(`/api/ai-systems/${params.id}`);
        const body = await response.json().catch(() => null);
        if (cancelled) return;

        if (response.ok) {
          setData(body as DetailResponse);
        } else {
          setData(null);
          setLoadError(loadErrorMessage(response.status, body as ApiErrorBody | null));
        }
      } catch {
        if (!cancelled) {
          setData(null);
          setLoadError("Unable to load AI system.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  async function archiveSystem() {
    setArchiving(true);
    try {
      const response = await fetch(`/api/ai-systems/${params.id}`, {
        method: "DELETE",
      });
      if (response.ok) router.push("/dashboard/ai-systems");
    } finally {
      setArchiving(false);
    }
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-500">Loading AI system...</div>;
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/ai-systems" className="text-sm text-slate-500 hover:text-slate-900">
          Back to AI Systems
        </Link>
        <Card>
          <CardContent className="py-16 text-center text-sm text-slate-500">
            {loadError ?? "AI system not found."}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { system, latestAssessment } = data;
  const openControls = data.controls.filter((control) =>
    control.status === "not_started" || control.status === "in_progress"
  );
  const evidenceByControl = groupEvidenceByControl(data.evidence ?? []);

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/ai-systems"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
      >
        <ChevronLeft className="h-4 w-4" />
        AI Systems
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">{system.name}</h2>
            <Badge className={riskClass[system.risk_tier]}>{humanize(system.risk_tier)}</Badge>
            <Badge className={approvalClass[system.approval_status]}>
              {humanize(system.approval_status)}
            </Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">{system.use_case}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditing((prev) => !prev)}>
            <Pencil className="mr-1 h-4 w-4" />
            {editing ? "Close Edit" : "Edit"}
          </Button>
          <Button
            render={<Link href={`/dashboard/ai-systems/${system.id}/assessment`} />}
            nativeButton={false}
          >
            <ClipboardCheck className="mr-1 h-4 w-4" />
            Assess
          </Button>
          <Button
            render={<Link href={`/dashboard/ai-systems/${system.id}/report`} />}
            nativeButton={false}
            variant="outline"
          >
            <FileText className="mr-1 h-4 w-4" />
            Generate Readiness Report
          </Button>
          <Button variant="destructive" onClick={archiveSystem} disabled={archiving}>
            <Archive className="mr-1 h-4 w-4" />
            {archiving ? "Archiving..." : "Archive"}
          </Button>
        </div>
      </div>

      {editing ? (
        <AISystemForm
          mode="edit"
          system={system}
          onSaved={(updated) => {
            setData((prev) => prev ? { ...prev, system: { ...prev.system, ...updated } } : prev);
            setEditing(false);
          }}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-semibold">System Record</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Detail label="Owner" value={system.owner_name || "Unassigned"} />
              <Detail label="Owner Email" value={system.owner_email || "Not provided"} />
              <Detail label="Department" value={system.department || "Not provided"} />
              <Detail label="Vendor" value={system.vendor_name || "Not provided"} />
              <Detail label="Model / Product" value={system.model_name || "Not provided"} />
              <Detail label="Business Process" value={system.business_process || "Not provided"} />
              <Detail label="Data Sensitivity" value={humanize(system.data_sensitivity)} />
              <Detail label="Data Types" value={(system.data_types ?? []).join(", ") || "Not provided"} />
              <Detail label="Next Review" value={formatDateOnly(system.next_review_date)} />
              <Detail label="Source" value={humanize(system.source)} />
              <Detail label="Updated" value={formatDate(system.updated_at)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Operational Flags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Flag label="Customer-facing" active={system.customer_facing} />
              <Flag label="Employee-facing" active={system.employee_facing} />
              <Flag label="Automated decisions" active={system.automated_decisions} />
              <Flag label="Human review required" active={system.human_review_required} />
              <Detail label="Training data use" value={humanize(system.training_data_use)} />
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Latest Risk Assessment</CardTitle>
          <Button
            render={<Link href={`/dashboard/ai-systems/${system.id}/assessment`} />}
            nativeButton={false}
            variant="outline"
            size="sm"
          >
            <ClipboardCheck className="mr-1 h-4 w-4" />
            Run Assessment
          </Button>
        </CardHeader>
        <CardContent>
          {!latestAssessment ? (
            <div className="rounded-lg border border-slate-200 p-6 text-center">
              <ShieldAlert className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">No assessment has been completed yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className={riskClass[latestAssessment.risk_tier]}>
                  {humanize(latestAssessment.risk_tier)}
                </Badge>
                <span className="text-sm text-slate-600">
                  Score {latestAssessment.overall_score}/100 · Version {latestAssessment.version}
                </span>
                <span className="text-sm text-slate-400">
                  {formatDate(latestAssessment.created_at)}
                </span>
              </div>
              <p className="text-sm text-slate-700">{latestAssessment.summary}</p>
              <p className="text-sm text-slate-500">
                Recommended controls are tracked as governance tasks below.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ListChecks className="h-4 w-4 text-slate-600" />
            Governance Controls
          </CardTitle>
          <Badge className={data.readiness.open === 0 ? riskClass.low : approvalClass.under_review}>
            {data.readiness.readinessPercent}% Ready
          </Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          {data.controls.length === 0 ? (
            <div className="rounded-lg border border-slate-200 p-6 text-center">
              <CircleCheck className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">
                No controls have been generated yet. Run an assessment to create the checklist.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Metric label="Open" value={String(data.readiness.open)} />
                <Metric label="In progress" value={String(data.readiness.inProgress)} />
                <Metric label="Completed" value={String(data.readiness.completed)} />
                <Metric label="Waived" value={String(data.readiness.waived)} />
                <Metric label="Total" value={String(data.readiness.total)} />
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${data.readiness.readinessPercent}%` }}
                />
              </div>
              {openControls.length > 0 && (
                <p className="text-sm text-slate-600">
                  {openControls.length} control{openControls.length === 1 ? "" : "s"} still need work.
                </p>
              )}
              <div className="grid gap-4 xl:grid-cols-2">
                {data.controls.map((control) => (
                  <ControlTask
                    key={control.id}
                    control={control}
                    systemId={system.id}
                    linkedEvidence={evidenceByControl.get(control.id) ?? []}
                    onSaved={(updated) => {
                      setData((prev) => {
                        if (!prev) return prev;
                        const controls = prev.controls.map((item) =>
                          item.id === updated.id ? updated : item
                        );
                        return {
                          ...prev,
                          controls,
                          readiness: calculateControlReadiness(controls),
                        };
                      });
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <EvidenceBinder
        systemId={system.id}
        controls={data.controls}
        evidence={data.evidence ?? []}
        onCreated={(created) => {
          setData((prev) =>
            prev ? { ...prev, evidence: [created, ...(prev.evidence ?? [])] } : prev
          );
        }}
        onSaved={(updated) => {
          setData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              evidence: (prev.evidence ?? []).map((item) =>
                item.id === updated.id ? updated : item
              ),
            };
          });
        }}
      />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-normal text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-slate-800">{value}</p>
    </div>
  );
}

function Flag({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
      <span className="text-slate-700">{label}</span>
      <Badge className={active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200"}>
        {active ? "Yes" : "No"}
      </Badge>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-normal text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ControlTask({
  control,
  systemId,
  linkedEvidence,
  onSaved,
}: {
  control: AISystemControl;
  systemId: string;
  linkedEvidence: AISystemEvidence[];
  onSaved: (control: AISystemControl) => void;
}) {
  const [draft, setDraft] = useState({
    owner: control.owner ?? "",
    status: control.status,
    dueDate: control.due_date ?? "",
    notes: control.notes ?? "",
    evidenceUrl: control.evidence_url ?? "",
    evidenceText: control.evidence_text ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresMfa, setRequiresMfa] = useState(false);

  async function saveControl() {
    setSaving(true);
    setError(null);
    setRequiresMfa(false);
    try {
      const response = await fetch(
        `/api/ai-systems/${systemId}/controls/${control.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        if (data.error === "mfa_required") {
          setRequiresMfa(true);
        }
        setError(data.message ?? data.error ?? "Unable to update control.");
        return;
      }
      onSaved(data.control);
    } catch {
      setError("Unable to update control.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">{control.title}</p>
            <Badge className={controlStatusClass[draft.status]}>
              {humanize(draft.status)}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {control.category} · {humanize(control.priority)}
          </p>
        </div>
      </div>
      <p className="text-sm text-slate-600">{control.reason}</p>
      <FrameworkMappingBadges mappings={mappingsForControl(control)} />

      {linkedEvidence.length > 0 && (
        <div className="rounded-md bg-slate-50 px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-normal text-slate-400">
            Linked Evidence
          </p>
          <ul className="mt-2 space-y-1">
            {linkedEvidence.map((evidence) => (
              <li key={evidence.id} className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                <span>{evidence.title}</span>
                <Badge className={evidenceStatusClass[evidence.status]}>
                  {humanize(evidence.status)}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <label className="block text-xs font-medium text-slate-500">
          Status
          <select
            value={draft.status}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                status: e.target.value as AISystemControlStatus,
              }))
            }
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
          >
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="waived">Waived</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Owner
          <input
            value={draft.owner}
            onChange={(e) => setDraft((prev) => ({ ...prev, owner: e.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
            placeholder="Owner"
          />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Due date
          <input
            type="date"
            value={draft.dueDate}
            onChange={(e) => setDraft((prev) => ({ ...prev, dueDate: e.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
          />
        </label>
      </div>

      <label className="block text-xs font-medium text-slate-500">
        Evidence URL
        <input
          value={draft.evidenceUrl}
          onChange={(e) => setDraft((prev) => ({ ...prev, evidenceUrl: e.target.value }))}
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
          placeholder="https://..."
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-xs font-medium text-slate-500">
          Notes
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
            className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
          />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Evidence text
          <textarea
            value={draft.evidenceText}
            onChange={(e) => setDraft((prev) => ({ ...prev, evidenceText: e.target.value }))}
            className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
          />
        </label>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{error}</span>
          {requiresMfa && (
            <Link
              href={`/login/mfa?next=${encodeURIComponent(`/dashboard/ai-systems/${systemId}`)}`}
              className="shrink-0 font-medium underline"
            >
              Verify MFA
            </Link>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={saveControl} disabled={saving} size="sm">
          {saving ? "Saving..." : "Save control"}
        </Button>
      </div>
    </div>
  );
}

function FrameworkMappingBadges({ mappings }: { mappings: AIFrameworkMapping[] }) {
  if (mappings.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {mappings.map((mapping) => (
        <Badge
          key={`${mapping.framework}-${mapping.code}-${mapping.category}`}
          className="border-slate-200 bg-slate-50 text-slate-700"
        >
          {mapping.framework_label} {mapping.code}
        </Badge>
      ))}
    </div>
  );
}

function EvidenceBinder({
  systemId,
  controls,
  evidence,
  onCreated,
  onSaved,
}: {
  systemId: string;
  controls: AISystemControl[];
  evidence: AISystemEvidence[];
  onCreated: (evidence: AISystemEvidence) => void;
  onSaved: (evidence: AISystemEvidence) => void;
}) {
  const [draft, setDraft] = useState({
    title: "",
    category: "policy" as AIEvidenceCategory,
    owner: "",
    status: "current" as AIEvidenceStatus,
    evidenceUrl: "",
    notes: "",
    controlId: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresMfa, setRequiresMfa] = useState(false);

  async function createEvidence() {
    setSaving(true);
    setError(null);
    setRequiresMfa(false);
    try {
      const response = await fetch(`/api/ai-systems/${systemId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          controlId: draft.controlId || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.error === "mfa_required") setRequiresMfa(true);
        setError(data.message ?? data.error ?? "Unable to create evidence.");
        return;
      }
      onCreated(data.evidence);
      setDraft({
        title: "",
        category: "policy",
        owner: "",
        status: "current",
        evidenceUrl: "",
        notes: "",
        controlId: "",
      });
    } catch {
      setError("Unable to create evidence.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <FileText className="h-4 w-4 text-slate-600" />
          Evidence Binder
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <EvidenceInput
              label="Title"
              value={draft.title}
              onChange={(value) => setDraft((prev) => ({ ...prev, title: value }))}
              placeholder="Vendor SOC 2 review"
            />
            <label className="block text-xs font-medium text-slate-500">
              Related control
              <select
                value={draft.controlId}
                onChange={(e) => setDraft((prev) => ({ ...prev, controlId: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
              >
                <option value="">System-level evidence</option>
                {controls.map((control) => (
                  <option key={control.id} value={control.id}>{control.title}</option>
                ))}
              </select>
            </label>
            <EvidenceSelect
              label="Category"
              value={draft.category}
              values={evidenceCategories}
              onChange={(value) =>
                setDraft((prev) => ({ ...prev, category: value as AIEvidenceCategory }))
              }
            />
            <EvidenceSelect
              label="Status"
              value={draft.status}
              values={evidenceStatuses}
              onChange={(value) =>
                setDraft((prev) => ({ ...prev, status: value as AIEvidenceStatus }))
              }
            />
            <EvidenceInput
              label="Owner"
              value={draft.owner}
              onChange={(value) => setDraft((prev) => ({ ...prev, owner: value }))}
              placeholder="Security Lead"
            />
            <EvidenceInput
              label="Evidence URL"
              value={draft.evidenceUrl}
              onChange={(value) => setDraft((prev) => ({ ...prev, evidenceUrl: value }))}
              placeholder="https://..."
            />
          </div>
          <label className="mt-3 block text-xs font-medium text-slate-500">
            Notes
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
              className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
            />
          </label>
          {error && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              <span>{error}</span>
              {requiresMfa && <MfaLink systemId={systemId} />}
            </div>
          )}
          <div className="mt-3 flex justify-end">
            <Button onClick={createEvidence} disabled={saving || !draft.title.trim()} size="sm">
              {saving ? "Adding..." : "Add evidence"}
            </Button>
          </div>
        </div>

        {evidence.length === 0 ? (
          <div className="rounded-lg border border-slate-200 p-6 text-center text-sm text-slate-500">
            No evidence records have been added yet.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {evidence.map((item) => (
              <EvidenceRecordEditor
                key={item.id}
                systemId={systemId}
                evidence={item}
                controls={controls}
                onSaved={onSaved}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EvidenceRecordEditor({
  systemId,
  evidence,
  controls,
  onSaved,
}: {
  systemId: string;
  evidence: AISystemEvidence;
  controls: AISystemControl[];
  onSaved: (evidence: AISystemEvidence) => void;
}) {
  const [draft, setDraft] = useState({
    title: evidence.title,
    category: evidence.category,
    owner: evidence.owner ?? "",
    status: evidence.status,
    evidenceUrl: evidence.evidence_url ?? "",
    notes: evidence.notes ?? "",
    controlId: evidence.control_id ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresMfa, setRequiresMfa] = useState(false);
  const linkedControl = controls.find((control) => control.id === draft.controlId);

  async function saveEvidence() {
    setSaving(true);
    setError(null);
    setRequiresMfa(false);
    try {
      const response = await fetch(`/api/ai-systems/${systemId}/evidence/${evidence.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          controlId: draft.controlId || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.error === "mfa_required") setRequiresMfa(true);
        setError(data.message ?? data.error ?? "Unable to update evidence.");
        return;
      }
      onSaved(data.evidence);
    } catch {
      setError("Unable to update evidence.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{evidence.title}</p>
          <p className="mt-1 text-xs text-slate-500">
            {linkedControl ? linkedControl.title : "System-level evidence"}
          </p>
        </div>
        <Badge className={evidenceStatusClass[draft.status]}>{humanize(draft.status)}</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <EvidenceInput
          label="Title"
          value={draft.title}
          onChange={(value) => setDraft((prev) => ({ ...prev, title: value }))}
        />
        <label className="block text-xs font-medium text-slate-500">
          Related control
          <select
            value={draft.controlId}
            onChange={(e) => setDraft((prev) => ({ ...prev, controlId: e.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
          >
            <option value="">System-level evidence</option>
            {controls.map((control) => (
              <option key={control.id} value={control.id}>{control.title}</option>
            ))}
          </select>
        </label>
        <EvidenceSelect
          label="Category"
          value={draft.category}
          values={evidenceCategories}
          onChange={(value) =>
            setDraft((prev) => ({ ...prev, category: value as AIEvidenceCategory }))
          }
        />
        <EvidenceSelect
          label="Status"
          value={draft.status}
          values={evidenceStatuses}
          onChange={(value) =>
            setDraft((prev) => ({ ...prev, status: value as AIEvidenceStatus }))
          }
        />
        <EvidenceInput
          label="Owner"
          value={draft.owner}
          onChange={(value) => setDraft((prev) => ({ ...prev, owner: value }))}
        />
        <EvidenceInput
          label="Evidence URL"
          value={draft.evidenceUrl}
          onChange={(value) => setDraft((prev) => ({ ...prev, evidenceUrl: value }))}
        />
      </div>

      {draft.evidenceUrl && (
        <a
          href={draft.evidenceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex max-w-full items-center gap-1 break-all text-sm text-slate-900 underline"
        >
          Open evidence
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        </a>
      )}

      <label className="block text-xs font-medium text-slate-500">
        Notes
        <textarea
          value={draft.notes}
          onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
          className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
        />
      </label>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{error}</span>
          {requiresMfa && <MfaLink systemId={systemId} />}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={saveEvidence} disabled={saving || !draft.title.trim()} size="sm">
          {saving ? "Saving..." : "Save evidence"}
        </Button>
      </div>
    </div>
  );
}

function EvidenceInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
        placeholder={placeholder}
      />
    </label>
  );
}

function EvidenceSelect({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
      >
        {values.map((item) => (
          <option key={item} value={item}>{humanize(item)}</option>
        ))}
      </select>
    </label>
  );
}

function MfaLink({ systemId }: { systemId: string }) {
  return (
    <Link
      href={`/login/mfa?next=${encodeURIComponent(`/dashboard/ai-systems/${systemId}`)}`}
      className="shrink-0 font-medium underline"
    >
      Verify MFA
    </Link>
  );
}
