import {
  buildReportReviewQueue,
  isBlockingRemediationStatus,
  isRemediationDueSoon,
  isRemediationOverdue,
  type ReportReviewQueueRemediation,
  type ReportReviewQueueSnapshot,
  type ReportReviewQueueSummary,
} from "./review-queue";

export type GovernanceReportAlertType =
  | "overdue_remediation"
  | "due_soon_remediation"
  | "needs_review"
  | "changes_requested"
  | "ready_to_finalize";

export type GovernanceReportAlertSeverity = "critical" | "high" | "medium" | "low";

export type GovernanceReportAlert = {
  id: string;
  type: GovernanceReportAlertType;
  severity: GovernanceReportAlertSeverity;
  title: string;
  message: string;
  snapshotId: string;
  snapshotTitle: string;
  actionHref: string;
  dueDate: string | null;
  owner: string | null;
  createdAt: string;
};

export type GovernanceReportAlertSummary = ReportReviewQueueSummary & {
  dueSoonRemediations: number;
  totalAlerts: number;
};

export type GovernanceReportAlertResult = {
  summary: GovernanceReportAlertSummary;
  alerts: GovernanceReportAlert[];
};

export function buildGovernanceReportAlerts(params: {
  snapshots: ReportReviewQueueSnapshot[];
  remediations: ReportReviewQueueRemediation[];
  now?: Date | string;
  dueSoonDays?: number;
}): GovernanceReportAlertResult {
  const today = dateKey(params.now ?? new Date());
  const dueSoonDays = params.dueSoonDays ?? 7;
  const queue = buildReportReviewQueue({
    snapshots: params.snapshots,
    remediations: params.remediations,
    now: today,
  });
  const snapshotById = new Map(params.snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const nonFinalSnapshotIds = new Set(
    params.snapshots
      .filter((snapshot) => (snapshot.delivery_status ?? "draft") !== "final")
      .map((snapshot) => snapshot.id)
  );
  const alerts: GovernanceReportAlert[] = [];

  for (const remediation of params.remediations) {
    if (!nonFinalSnapshotIds.has(remediation.snapshot_id)) continue;
    if (!isBlockingRemediationStatus(remediation.status)) continue;

    const snapshot = snapshotById.get(remediation.snapshot_id);
    if (!snapshot) continue;

    if (isRemediationOverdue(remediation, today)) {
      alerts.push(
        remediationAlert({
          type: "overdue_remediation",
          severity: "critical",
          title: "Overdue remediation",
          snapshot,
          remediation,
          message: `${snapshot.title} has an open remediation item past its due date.`,
        })
      );
      continue;
    }

    if (isRemediationDueSoon(remediation, today, dueSoonDays)) {
      alerts.push(
        remediationAlert({
          type: "due_soon_remediation",
          severity: remediation.due_date?.slice(0, 10) === today ? "high" : "medium",
          title: "Remediation due soon",
          snapshot,
          remediation,
          message:
            remediation.due_date?.slice(0, 10) === today
              ? `${snapshot.title} has a remediation item due today.`
              : `${snapshot.title} has a remediation item due within ${dueSoonDays} days.`,
        })
      );
    }
  }

  for (const row of queue.rows) {
    if (row.status === "remediation_blocked") continue;

    if (row.status === "needs_review") {
      alerts.push({
        id: `governance-report:needs-review:${row.snapshotId}`,
        type: "needs_review",
        severity: "medium",
        title: "Report needs review",
        message: `${row.title} has been submitted and is waiting for internal review.`,
        snapshotId: row.snapshotId,
        snapshotTitle: row.title,
        actionHref: `/dashboard/report-snapshots/${row.snapshotId}`,
        dueDate: null,
        owner: row.generatedByEmail,
        createdAt: row.createdAt,
      });
    }

    if (row.status === "changes_requested") {
      alerts.push({
        id: `governance-report:changes-requested:${row.snapshotId}`,
        type: "changes_requested",
        severity: "high",
        title: "Report changes requested",
        message: `${row.title} needs changes before it can be approved.`,
        snapshotId: row.snapshotId,
        snapshotTitle: row.title,
        actionHref: `/dashboard/report-snapshots/${row.snapshotId}`,
        dueDate: null,
        owner: row.generatedByEmail,
        createdAt: row.createdAt,
      });
    }

    if (row.status === "ready_to_finalize") {
      alerts.push({
        id: `governance-report:ready-to-finalize:${row.snapshotId}`,
        type: "ready_to_finalize",
        severity: "low",
        title: "Report ready to finalize",
        message: `${row.title} is approved and ready to be marked Final.`,
        snapshotId: row.snapshotId,
        snapshotTitle: row.title,
        actionHref: `/dashboard/report-snapshots/${row.snapshotId}`,
        dueDate: null,
        owner: row.generatedByEmail,
        createdAt: row.createdAt,
      });
    }
  }

  const sortedAlerts = alerts.sort(compareAlerts);

  return {
    summary: {
      ...queue.summary,
      totalAlerts: sortedAlerts.length,
    },
    alerts: sortedAlerts,
  };
}

function remediationAlert(params: {
  type: Extract<GovernanceReportAlertType, "overdue_remediation" | "due_soon_remediation">;
  severity: GovernanceReportAlertSeverity;
  title: string;
  message: string;
  snapshot: ReportReviewQueueSnapshot;
  remediation: ReportReviewQueueRemediation;
}): GovernanceReportAlert {
  return {
    id: `governance-report:${params.type}:${params.snapshot.id}:${params.remediation.id}`,
    type: params.type,
    severity: params.severity,
    title: params.title,
    message: params.message,
    snapshotId: params.snapshot.id,
    snapshotTitle: params.snapshot.title,
    actionHref: `/dashboard/report-snapshots/${params.snapshot.id}`,
    dueDate: params.remediation.due_date?.slice(0, 10) ?? null,
    owner: params.remediation.owner ?? null,
    createdAt: params.remediation.updated_at ?? params.remediation.created_at ?? params.snapshot.created_at,
  };
}

function compareAlerts(a: GovernanceReportAlert, b: GovernanceReportAlert): number {
  const severityDelta = severityWeight(a.severity) - severityWeight(b.severity);
  if (severityDelta !== 0) return severityDelta;

  const aDue = a.dueDate ?? "9999-12-31";
  const bDue = b.dueDate ?? "9999-12-31";
  if (aDue !== bDue) return aDue.localeCompare(bDue);

  return b.createdAt.localeCompare(a.createdAt);
}

function severityWeight(severity: GovernanceReportAlertSeverity): number {
  if (severity === "critical") return 1;
  if (severity === "high") return 2;
  if (severity === "medium") return 3;
  return 4;
}

function dateKey(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}
