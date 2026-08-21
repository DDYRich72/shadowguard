"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { GovernanceReportSnapshotType } from "@/lib/ai-governance/types";
import { cn } from "@/lib/utils";

type SaveResponse = {
  error?: string;
  message?: string;
  snapshot?: {
    id: string;
    title: string;
  };
};

export function SaveReportSnapshotButton({
  reportType,
  aiSystemId,
  title,
}: {
  reportType: GovernanceReportSnapshotType;
  aiSystemId?: string;
  title?: string;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [snapshotId, setSnapshotId] = useState("");

  async function saveSnapshot() {
    setSaving(true);
    setError("");
    setRequiresMfa(false);
    setSnapshotId("");

    try {
      const response = await fetch("/api/governance/report-snapshots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reportType,
          aiSystemId: aiSystemId ?? null,
          title: title ?? "",
        }),
      });
      const data = (await response.json()) as SaveResponse;
      if (!response.ok) {
        if (data.error === "mfa_required") setRequiresMfa(true);
        setError(data.message ?? data.error ?? "Unable to save snapshot.");
        return;
      }
      setSnapshotId(data.snapshot?.id ?? "");
    } catch {
      setError("Unable to save snapshot.");
    } finally {
      setSaving(false);
    }
  }

  if (snapshotId) {
    return (
      <Link
        href={`/dashboard/report-snapshots/${snapshotId}`}
        className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
      >
        <Archive className="h-4 w-4" />
        Open Saved Snapshot
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" onClick={saveSnapshot} disabled={saving} className="gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
        Save Snapshot
      </Button>
      {requiresMfa && (
        <Link
          href={`/login/mfa?next=${encodeURIComponent(
            aiSystemId
              ? `/dashboard/ai-systems/${aiSystemId}/report`
              : "/dashboard/governance-report"
          )}`}
          className="text-sm font-medium text-slate-900 underline"
        >
          Verify MFA
        </Link>
      )}
      {error && <span className="text-sm text-red-700">{error}</span>}
    </div>
  );
}
