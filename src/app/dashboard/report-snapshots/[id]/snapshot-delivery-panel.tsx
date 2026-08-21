"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Copy,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Lock,
  Loader2,
  MessageSquareWarning,
  Save,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type {
  GovernanceReportDeliveryLink,
  GovernanceReportDeliveryStatus,
  GovernanceReportReviewStatus,
} from "@/lib/ai-governance/types";

type SnapshotDeliveryPanelProps = {
  snapshotId: string;
  clientName: string;
  preparedByNote: string;
  executiveSummaryNote: string;
  deliveryStatus: GovernanceReportDeliveryStatus;
  finalizedAt?: string | null;
  reviewStatus: GovernanceReportReviewStatus;
  reviewerName: string;
  reviewerEmail: string;
  reviewNote: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  pdfGeneratedAt?: string | null;
  pdfFilename?: string | null;
  pdfSizeBytes?: number | null;
  deliveryLinks: GovernanceReportDeliveryLink[];
  deliveryLinksError?: string;
  openRemediationCount?: number;
  renderedAt: string;
  canMutate: boolean;
};

type SnapshotResponse = {
  error?: string;
  message?: string;
  snapshot?: {
    id: string;
  };
  link?: GovernanceReportDeliveryLink;
};

const statusClass: Record<GovernanceReportDeliveryStatus, string> = {
  draft: "border-amber-200 bg-amber-50 text-amber-700",
  final: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const reviewStatusClass: Record<GovernanceReportReviewStatus, string> = {
  not_submitted: "border-slate-200 bg-slate-100 text-slate-700",
  needs_review: "border-blue-200 bg-blue-50 text-blue-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  changes_requested: "border-amber-200 bg-amber-50 text-amber-700",
};

const reviewStatusLabel: Record<GovernanceReportReviewStatus, string> = {
  not_submitted: "Not Submitted",
  needs_review: "Needs Review",
  approved: "Approved",
  changes_requested: "Changes Requested",
};

const linkStatusClass = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  revoked: "border-slate-200 bg-slate-100 text-slate-600",
  expired: "border-amber-200 bg-amber-50 text-amber-700",
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "None";
  return new Date(value).toLocaleString();
}

function displayLinkStatus(
  link: GovernanceReportDeliveryLink,
  renderedAt: string
): "active" | "revoked" | "expired" {
  if (link.status === "revoked") return "revoked";
  if (link.expires_at && new Date(link.expires_at).getTime() <= new Date(renderedAt).getTime()) {
    return "expired";
  }
  return "active";
}

export function SnapshotDeliveryPanel({
  snapshotId,
  clientName,
  preparedByNote,
  executiveSummaryNote,
  deliveryStatus,
  finalizedAt,
  reviewStatus,
  reviewerName,
  reviewerEmail,
  reviewNote,
  reviewedAt,
  reviewedBy,
  pdfGeneratedAt,
  pdfFilename,
  pdfSizeBytes,
  deliveryLinks,
  deliveryLinksError = "",
  openRemediationCount = 0,
  renderedAt,
  canMutate,
}: SnapshotDeliveryPanelProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    clientName,
    preparedByNote,
    executiveSummaryNote,
  });
  const [reviewForm, setReviewForm] = useState({
    reviewerName,
    reviewerEmail,
    reviewNote,
  });
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);
  const [revokingLinkId, setRevokingLinkId] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewing, setReviewing] = useState<"" | "approve" | "changes_requested">("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [requiresMfa, setRequiresMfa] = useState(false);
  const isFinal = deliveryStatus === "final";
  const isApproved = reviewStatus === "approved";
  const hasOpenRemediation = openRemediationCount > 0;
  const busy =
    saving ||
    finalizing ||
    duplicating ||
    generatingPdf ||
    creatingLink ||
    submittingReview ||
    Boolean(reviewing) ||
    Boolean(revokingLinkId);
  const disabled = !canMutate || isFinal || busy;
  const finalDisabled = disabled || hasOpenRemediation;
  const reviewDisabled = !canMutate || isFinal || isApproved || busy;

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateReviewField(field: keyof typeof reviewForm, value: string) {
    setReviewForm((current) => ({ ...current, [field]: value }));
  }

  function handleFailure(data: SnapshotResponse, fallback: string) {
    setRequiresMfa(data.error === "mfa_required");
    setError(data.message ?? data.error ?? fallback);
  }

  async function saveDeliveryFields() {
    setSaving(true);
    setError("");
    setMessage("");
    setRequiresMfa(false);

    try {
      const response = await fetch(`/api/governance/report-snapshots/${snapshotId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as SnapshotResponse;
      if (!response.ok) {
        handleFailure(data, "Unable to save delivery fields.");
        return;
      }
      setMessage("Delivery fields saved.");
      router.refresh();
    } catch {
      setError("Unable to save delivery fields.");
    } finally {
      setSaving(false);
    }
  }

  async function finalizeSnapshot() {
    if (!window.confirm("Mark this snapshot Final? Final snapshots are locked unless duplicated.")) {
      return;
    }

    setFinalizing(true);
    setError("");
    setMessage("");
    setRequiresMfa(false);

    try {
      const response = await fetch(`/api/governance/report-snapshots/${snapshotId}/finalize`, {
        method: "POST",
      });
      const data = (await response.json()) as SnapshotResponse;
      if (!response.ok) {
        handleFailure(data, "Unable to finalize snapshot.");
        return;
      }
      setMessage("Snapshot finalized.");
      router.refresh();
    } catch {
      setError("Unable to finalize snapshot.");
    } finally {
      setFinalizing(false);
    }
  }

  async function submitReview() {
    setSubmittingReview(true);
    setError("");
    setMessage("");
    setRequiresMfa(false);

    try {
      const response = await fetch(`/api/governance/report-snapshots/${snapshotId}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(reviewForm),
      });
      const data = (await response.json()) as SnapshotResponse;
      if (!response.ok) {
        handleFailure(data, "Unable to submit snapshot for review.");
        return;
      }
      setMessage("Snapshot submitted for review.");
      router.refresh();
    } catch {
      setError("Unable to submit snapshot for review.");
    } finally {
      setSubmittingReview(false);
    }
  }

  async function recordReviewDecision(action: "approve" | "changes_requested") {
    setReviewing(action);
    setError("");
    setMessage("");
    setRequiresMfa(false);

    try {
      const response = await fetch(`/api/governance/report-snapshots/${snapshotId}/review`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...reviewForm, action }),
      });
      const data = (await response.json()) as SnapshotResponse;
      if (!response.ok) {
        handleFailure(data, "Unable to record review decision.");
        return;
      }
      setMessage(action === "approve" ? "Snapshot approved." : "Changes requested.");
      router.refresh();
    } catch {
      setError("Unable to record review decision.");
    } finally {
      setReviewing("");
    }
  }

  async function duplicateSnapshot() {
    setDuplicating(true);
    setError("");
    setMessage("");
    setRequiresMfa(false);

    try {
      const response = await fetch(`/api/governance/report-snapshots/${snapshotId}/duplicate`, {
        method: "POST",
      });
      const data = (await response.json()) as SnapshotResponse;
      if (!response.ok) {
        handleFailure(data, "Unable to duplicate snapshot.");
        return;
      }
      if (data.snapshot?.id) {
        router.push(`/dashboard/report-snapshots/${data.snapshot.id}`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Unable to duplicate snapshot.");
    } finally {
      setDuplicating(false);
    }
  }

  async function generatePdf() {
    setGeneratingPdf(true);
    setError("");
    setMessage("");
    setRequiresMfa(false);

    try {
      const response = await fetch(`/api/governance/report-snapshots/${snapshotId}/pdf`, {
        method: "POST",
      });
      const data = (await response.json()) as SnapshotResponse;
      if (!response.ok) {
        handleFailure(data, "Unable to generate PDF.");
        return;
      }
      setMessage("PDF generated.");
      router.refresh();
    } catch {
      setError("Unable to generate PDF.");
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function createDeliveryLink() {
    setCreatingLink(true);
    setError("");
    setMessage("");
    setRequiresMfa(false);

    try {
      const response = await fetch(
        `/api/governance/report-snapshots/${snapshotId}/delivery-links`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ expiresAt }),
        }
      );
      const data = (await response.json()) as SnapshotResponse;
      if (!response.ok) {
        handleFailure(data, "Unable to create delivery link.");
        return;
      }
      setMessage("Client delivery link created.");
      setExpiresAt("");
      router.refresh();
    } catch {
      setError("Unable to create delivery link.");
    } finally {
      setCreatingLink(false);
    }
  }

  async function revokeDeliveryLink(linkId: string) {
    if (!window.confirm("Revoke this client delivery link? The URL will stop working immediately.")) {
      return;
    }

    setRevokingLinkId(linkId);
    setError("");
    setMessage("");
    setRequiresMfa(false);

    try {
      const response = await fetch(
        `/api/governance/report-snapshots/${snapshotId}/delivery-links/${linkId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "revoked" }),
        }
      );
      const data = (await response.json()) as SnapshotResponse;
      if (!response.ok) {
        handleFailure(data, "Unable to revoke delivery link.");
        return;
      }
      setMessage("Client delivery link revoked.");
      router.refresh();
    } catch {
      setError("Unable to revoke delivery link.");
    } finally {
      setRevokingLinkId("");
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Delivery URL copied.");
      setError("");
    } catch {
      setError("Unable to copy delivery URL.");
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-950">Client Delivery</h3>
            <Badge className={cn("capitalize", statusClass[deliveryStatus])}>
              {deliveryStatus}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Delivery fields appear on the Client Export Pack. Final snapshots are locked from edits.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canMutate && !isFinal && (
            <Button onClick={saveDeliveryFields} disabled={disabled} variant="outline" className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Delivery Fields
            </Button>
          )}
          {canMutate && !isFinal && isApproved && (
            <Button onClick={finalizeSnapshot} disabled={finalDisabled} className="gap-2">
              {finalizing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Mark Final
            </Button>
          )}
          {canMutate && !isFinal && !isApproved && (
            <Button disabled variant="outline" className="gap-2" suppressHydrationWarning>
              <ShieldCheck className="h-4 w-4" />
              Approval Required
            </Button>
          )}
          {canMutate && (
            <Button onClick={duplicateSnapshot} disabled={busy} variant="outline" className="gap-2">
              {duplicating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              Duplicate Snapshot
            </Button>
          )}
          {canMutate && isFinal && (
            <Button onClick={generatePdf} disabled={busy} className="gap-2">
              {generatingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Generate PDF
            </Button>
          )}
          {isFinal && pdfGeneratedAt && (
            <Link
              href={`/api/governance/report-snapshots/${snapshotId}/pdf/download`}
              className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
            >
              <Download className="h-4 w-4" />
              Download PDF
            </Link>
          )}
        </div>
      </div>

      {isFinal && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <Lock className="mt-0.5 h-4 w-4" />
          <div>
            <p className="font-medium">This snapshot is final and locked.</p>
            <p className="mt-1">
              Duplicate it to create an editable Draft copy. Finalized{" "}
              {finalizedAt ? new Date(finalizedAt).toLocaleString() : "date unavailable"}.
            </p>
          </div>
        </div>
      )}

      {!isFinal && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          PDF generation and client delivery links are available after approval and Final status.
        </div>
      )}

      {isFinal && pdfGeneratedAt && (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p className="font-medium">PDF ready</p>
          <p className="mt-1">
            Generated {new Date(pdfGeneratedAt).toLocaleString()}{" "}
            {pdfFilename ? `as ${pdfFilename}` : ""}
            {pdfSizeBytes ? ` (${Math.ceil(pdfSizeBytes / 1024)} KB)` : ""}.
          </p>
        </div>
      )}

      <div className="mt-5 rounded-lg border border-slate-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-slate-700" />
              <h4 className="text-sm font-semibold text-slate-950">Review Workflow</h4>
              <Badge className={cn("capitalize", reviewStatusClass[reviewStatus])}>
                {reviewStatusLabel[reviewStatus]}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Internal approval status. This is not shown as a client-facing compliance claim.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canMutate &&
              !isFinal &&
              (reviewStatus === "not_submitted" || reviewStatus === "changes_requested") && (
                <Button onClick={submitReview} disabled={reviewDisabled} className="gap-2">
                  {submittingReview ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Submit Review
                </Button>
              )}
            {canMutate && !isFinal && reviewStatus === "needs_review" && (
              <>
                <Button
                  onClick={() => recordReviewDecision("approve")}
                  disabled={busy || hasOpenRemediation}
                  className="gap-2"
                  suppressHydrationWarning
                >
                  {reviewing === "approve" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Approve
                </Button>
                <Button
                  onClick={() => recordReviewDecision("changes_requested")}
                  disabled={busy}
                  variant="outline"
                  className="gap-2 text-amber-700 hover:text-amber-700"
                  suppressHydrationWarning
                >
                  {reviewing === "changes_requested" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquareWarning className="h-4 w-4" />
                  )}
                  Request Changes
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="snapshot-reviewer-name">Reviewer name</Label>
            <Input
              id="snapshot-reviewer-name"
              value={reviewForm.reviewerName}
              onChange={(event) => updateReviewField("reviewerName", event.target.value)}
              placeholder="Security or governance reviewer"
              disabled={reviewDisabled}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="snapshot-reviewer-email">Reviewer email</Label>
            <Input
              id="snapshot-reviewer-email"
              type="email"
              value={reviewForm.reviewerEmail}
              onChange={(event) => updateReviewField("reviewerEmail", event.target.value)}
              placeholder="reviewer@example.com"
              disabled={reviewDisabled}
            />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="snapshot-review-note">Review note</Label>
            <textarea
              id="snapshot-review-note"
              value={reviewForm.reviewNote}
              onChange={(event) => updateReviewField("reviewNote", event.target.value)}
              placeholder="Internal review note or requested changes."
              disabled={reviewDisabled}
              className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
              Reviewed Date
            </p>
            <p className="mt-1">{formatDateTime(reviewedAt)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
              Reviewed By
            </p>
            <p className="mt-1">{reviewerEmail || reviewerName || reviewedBy || "None"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
              Final Gate
            </p>
            <p className="mt-1">
              {hasOpenRemediation
                ? `${openRemediationCount} open remediation ${openRemediationCount === 1 ? "item" : "items"} block approval`
                : isApproved
                  ? "Ready for Final"
                  : "Approval required before Final"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-slate-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-slate-700" />
              <h4 className="text-sm font-semibold text-slate-950">Client Delivery Links</h4>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Active links show the client export pack without dashboard controls or raw JSON.
            </p>
          </div>
          {canMutate && isFinal && !deliveryLinksError && (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label htmlFor="delivery-link-expires" className="text-xs">
                  Expires
                </Label>
                <Input
                  id="delivery-link-expires"
                  type="date"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  disabled={busy}
                  className="mt-1 w-44"
                  suppressHydrationWarning
                />
              </div>
              <Button onClick={createDeliveryLink} disabled={busy} className="gap-2">
                {creatingLink ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                Create Link
              </Button>
            </div>
          )}
        </div>

        {deliveryLinksError && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {deliveryLinksError}
          </div>
        )}

        {!isFinal && !deliveryLinksError && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Client delivery links are available after this snapshot is marked Final.
          </div>
        )}

        {isFinal && !deliveryLinksError && deliveryLinks.length === 0 && (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            No client delivery links have been created for this snapshot yet.
          </div>
        )}

        {deliveryLinks.length > 0 && (
          <div className="mt-4 space-y-3">
            {deliveryLinks.map((link) => {
              const status = displayLinkStatus(link, renderedAt);
              const publicUrl = link.public_url || `/client-reports/${link.url_token}`;
              const canRevoke = canMutate && status === "active";
              return (
                <div key={link.id} className="rounded-md border border-slate-200 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={cn("capitalize", linkStatusClass[status])}>
                          {status}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          Created {formatDateTime(link.created_at)}
                        </span>
                        <span className="text-xs text-slate-500">
                          Expires {formatDateTime(link.expires_at)}
                        </span>
                      </div>
                      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
                        <code className="min-w-0 flex-1 overflow-hidden text-ellipsis rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
                          {publicUrl}
                        </code>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => copyUrl(publicUrl)}
                          className="gap-2"
                          suppressHydrationWarning
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </Button>
                        <a
                          href={publicUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open
                        </a>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        Opened {link.open_count} time{link.open_count === 1 ? "" : "s"}
                        {link.last_opened_at ? `, last ${formatDateTime(link.last_opened_at)}` : ""}.
                      </p>
                    </div>
                    {canRevoke && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => revokeDeliveryLink(link.id)}
                        disabled={busy}
                        className="gap-2 text-red-700 hover:text-red-700"
                        suppressHydrationWarning
                      >
                        {revokingLinkId === link.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!canMutate && (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Viewers can read delivery fields but cannot edit, finalize, or duplicate snapshots.
        </div>
      )}

      <div className="mt-5 grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="snapshot-client-name">Client or company name</Label>
          <Input
            id="snapshot-client-name"
            value={form.clientName}
            onChange={(event) => updateField("clientName", event.target.value)}
            placeholder="Acme Corporation"
            disabled={disabled}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="snapshot-executive-note">Executive summary note</Label>
          <textarea
            id="snapshot-executive-note"
            value={form.executiveSummaryNote}
            onChange={(event) => updateField("executiveSummaryNote", event.target.value)}
            placeholder="Short client-facing note to place above the generated summary."
            disabled={disabled}
            className="min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="snapshot-prepared-note">Prepared-by note</Label>
          <textarea
            id="snapshot-prepared-note"
            value={form.preparedByNote}
            onChange={(event) => updateField("preparedByNote", event.target.value)}
            placeholder="Example: Prepared by the governance team after the quarterly review."
            disabled={disabled}
            className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
          />
        </div>
      </div>

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
