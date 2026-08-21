"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ClipboardList, Loader2, Plus, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type {
  GovernanceReportSnapshotRemediation,
  GovernanceReportSnapshotRemediationStatus,
} from "@/lib/ai-governance/types";

type SnapshotRemediationPanelProps = {
  snapshotId: string;
  remediations: GovernanceReportSnapshotRemediation[];
  remediationsError?: string;
  isFinal: boolean;
  canMutate: boolean;
};

type RemediationResponse = {
  error?: string;
  message?: string;
  remediation?: GovernanceReportSnapshotRemediation;
};

const statusLabel: Record<GovernanceReportSnapshotRemediationStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  waived: "Waived",
};

const statusClass: Record<GovernanceReportSnapshotRemediationStatus, string> = {
  open: "border-red-200 bg-red-50 text-red-700",
  in_progress: "border-blue-200 bg-blue-50 text-blue-700",
  resolved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  waived: "border-slate-200 bg-slate-100 text-slate-700",
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "None";
  return new Date(value).toLocaleString();
}

function isBlocking(status: GovernanceReportSnapshotRemediationStatus) {
  return status === "open" || status === "in_progress";
}

function emptyCreateForm() {
  return {
    title: "",
    owner: "",
    dueDate: "",
    notes: "",
  };
}

export function SnapshotRemediationPanel({
  snapshotId,
  remediations,
  remediationsError = "",
  isFinal,
  canMutate,
}: SnapshotRemediationPanelProps) {
  const router = useRouter();
  const [createForm, setCreateForm] = useState(emptyCreateForm());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [requiresMfa, setRequiresMfa] = useState(false);
  const locked = !canMutate || isFinal;
  const openCount = remediations.filter((item) => isBlocking(item.status)).length;
  const closedCount = remediations.length - openCount;

  function updateCreateField(field: keyof typeof createForm, value: string) {
    setCreateForm((current) => ({ ...current, [field]: value }));
  }

  function handleFailure(data: RemediationResponse, fallback: string) {
    setRequiresMfa(data.error === "mfa_required");
    setError(data.message ?? data.error ?? fallback);
  }

  async function createRemediation() {
    setCreating(true);
    setError("");
    setMessage("");
    setRequiresMfa(false);

    try {
      const response = await fetch(
        `/api/governance/report-snapshots/${snapshotId}/remediations`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(createForm),
        }
      );
      const data = (await response.json()) as RemediationResponse;
      if (!response.ok) {
        handleFailure(data, "Unable to create remediation item.");
        return;
      }
      setCreateForm(emptyCreateForm());
      setMessage("Remediation item created.");
      router.refresh();
    } catch {
      setError("Unable to create remediation item.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <ClipboardList className="h-5 w-5 text-slate-700" />
            <h3 className="text-base font-semibold text-slate-950">Review Remediation</h3>
            <Badge className={openCount > 0 ? statusClass.open : statusClass.resolved}>
              {openCount} Open
            </Badge>
            <Badge className="border-slate-200 bg-slate-100 text-slate-700">
              {closedCount} Closed
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Track requested report changes. Open or in-progress items block approval.
          </p>
        </div>
        {isFinal && (
          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
            Locked after Final
          </Badge>
        )}
      </div>

      {remediationsError && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {remediationsError}
        </div>
      )}

      {!remediationsError && !locked && (
        <div className="mt-5 rounded-lg border border-slate-200 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="remediation-title">Remediation title</Label>
              <Input
                id="remediation-title"
                value={createForm.title}
                onChange={(event) => updateCreateField("title", event.target.value)}
                placeholder="Example: Add reviewer note about vendor evidence"
                suppressHydrationWarning
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="remediation-owner">Owner</Label>
              <Input
                id="remediation-owner"
                value={createForm.owner}
                onChange={(event) => updateCreateField("owner", event.target.value)}
                placeholder="Governance lead"
                suppressHydrationWarning
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="remediation-due">Due date</Label>
              <Input
                id="remediation-due"
                type="date"
                value={createForm.dueDate}
                onChange={(event) => updateCreateField("dueDate", event.target.value)}
                suppressHydrationWarning
              />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="remediation-notes">Notes</Label>
              <textarea
                id="remediation-notes"
                value={createForm.notes}
                onChange={(event) => updateCreateField("notes", event.target.value)}
                placeholder="What needs to change before approval?"
                className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              onClick={createRemediation}
              disabled={creating || !createForm.title.trim()}
              className="gap-2"
              suppressHydrationWarning
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add Item
            </Button>
          </div>
        </div>
      )}

      {!remediationsError && remediations.length === 0 && (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          No remediation items have been created for this snapshot.
        </div>
      )}

      {!remediationsError && remediations.length > 0 && (
        <div className="mt-5 space-y-3">
          {remediations.map((item) => (
            <RemediationRow
              key={item.id}
              snapshotId={snapshotId}
              item={item}
              locked={locked}
              onFailure={handleFailure}
              onSuccess={(text) => setMessage(text)}
            />
          ))}
        </div>
      )}

      {!canMutate && (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Viewers can read remediation items but cannot edit them.
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        {message && <span className="text-emerald-700">{message}</span>}
        {error && <span className="text-red-700">{error}</span>}
        {requiresMfa && (
          <Link
            href={`/login/mfa?next=${encodeURIComponent(`/dashboard/report-snapshots/${snapshotId}`)}`}
            className="font-medium text-slate-900 underline"
          >
            Verify MFA
          </Link>
        )}
      </div>
    </section>
  );
}

function RemediationRow({
  snapshotId,
  item,
  locked,
  onFailure,
  onSuccess,
}: {
  snapshotId: string;
  item: GovernanceReportSnapshotRemediation;
  locked: boolean;
  onFailure: (data: RemediationResponse, fallback: string) => void;
  onSuccess: (message: string) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: item.title,
    owner: item.owner ?? "",
    status: item.status,
    dueDate: item.due_date ?? "",
    notes: item.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  function updateField<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveRemediation() {
    setSaving(true);
    try {
      const response = await fetch(
        `/api/governance/report-snapshots/${snapshotId}/remediations/${item.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = (await response.json()) as RemediationResponse;
      if (!response.ok) {
        onFailure(data, "Unable to update remediation item.");
        return;
      }
      onSuccess("Remediation item updated.");
      router.refresh();
    } catch {
      onFailure({ error: "network_error" }, "Unable to update remediation item.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md border border-slate-200 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge className={cn(statusClass[form.status])}>{statusLabel[form.status]}</Badge>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>Created {formatDateTime(item.created_at)}</span>
          <span>Resolved {formatDateTime(item.resolved_at)}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="grid gap-2 md:col-span-2">
          <Label htmlFor={`remediation-${item.id}-title`}>Title</Label>
          <Input
            id={`remediation-${item.id}-title`}
            value={form.title}
            onChange={(event) => updateField("title", event.target.value)}
            disabled={locked || saving}
            suppressHydrationWarning
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`remediation-${item.id}-owner`}>Owner</Label>
          <Input
            id={`remediation-${item.id}-owner`}
            value={form.owner}
            onChange={(event) => updateField("owner", event.target.value)}
            disabled={locked || saving}
            suppressHydrationWarning
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`remediation-${item.id}-due`}>Due date</Label>
          <Input
            id={`remediation-${item.id}-due`}
            type="date"
            value={form.dueDate}
            onChange={(event) => updateField("dueDate", event.target.value)}
            disabled={locked || saving}
            suppressHydrationWarning
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`remediation-${item.id}-status`}>Status</Label>
          <select
            id={`remediation-${item.id}-status`}
            value={form.status}
            onChange={(event) =>
              updateField(
                "status",
                event.target.value as GovernanceReportSnapshotRemediationStatus
              )
            }
            disabled={locked || saving}
            className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
            suppressHydrationWarning
          >
            {Object.entries(statusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label htmlFor={`remediation-${item.id}-notes`}>Notes</Label>
          <textarea
            id={`remediation-${item.id}-notes`}
            value={form.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            disabled={locked || saving}
            className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {isBlocking(form.status) ? (
          <p className="text-sm text-amber-700">This item blocks approval.</p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            This item no longer blocks approval.
          </p>
        )}
        {!locked && (
          <Button
            type="button"
            onClick={saveRemediation}
            disabled={saving || !form.title.trim()}
            variant="outline"
            className="gap-2"
            suppressHydrationWarning
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Item
          </Button>
        )}
      </div>
    </div>
  );
}
