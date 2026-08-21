import type {
  GovernanceReportDeliveryStatus,
  GovernanceReportReviewStatus,
  GovernanceReportSnapshot,
  GovernanceReportSnapshotRemediation,
  GovernanceReportSnapshotRemediationStatus,
  GovernanceReportSnapshotType,
} from "./types";

export type ReportReviewQueueStatus =
  | "remediation_blocked"
  | "needs_review"
  | "changes_requested"
  | "ready_to_finalize";

export type ReportReviewQueueSnapshot = Pick<
  GovernanceReportSnapshot,
  "id" | "title" | "report_type" | "created_at"
> &
  Partial<GovernanceReportSnapshot>;

export type ReportReviewQueueRemediation = Pick<
  GovernanceReportSnapshotRemediation,
  "id" | "snapshot_id" | "status" | "due_date"
> &
  Partial<GovernanceReportSnapshotRemediation>;

export type ReportReviewQueueRow = {
  snapshotId: string;
  title: string;
  reportType: GovernanceReportSnapshotType;
  clientName: string | null;
  generatedByEmail: string | null;
  reviewStatus: GovernanceReportReviewStatus;
  deliveryStatus: GovernanceReportDeliveryStatus;
  createdAt: string;
  status: ReportReviewQueueStatus;
  statusLabel: string;
  priority: number;
  openRemediationCount: number;
  overdueRemediationCount: number;
  dueSoonRemediationCount: number;
  nextDueDate: string | null;
  remediationOwners: string[];
};

export type ReportReviewQueueSummary = {
  totalSnapshots: number;
  finalSnapshots: number;
  actionableSnapshots: number;
  needsReview: number;
  changesRequested: number;
  readyToFinalize: number;
  openRemediations: number;
  overdueRemediations: number;
  dueSoonRemediations: number;
};

export type ReportReviewQueue = {
  rows: ReportReviewQueueRow[];
  summary: ReportReviewQueueSummary;
};

export function isBlockingRemediationStatus(
  status: GovernanceReportSnapshotRemediationStatus
): boolean {
  return status === "open" || status === "in_progress";
}

export function isRemediationOverdue(
  remediation: Pick<GovernanceReportSnapshotRemediation, "due_date" | "status">,
  today: string
): boolean {
  if (!isBlockingRemediationStatus(remediation.status)) return false;
  if (!remediation.due_date) return false;

  return remediation.due_date.slice(0, 10) < today;
}

export function isRemediationDueSoon(
  remediation: Pick<GovernanceReportSnapshotRemediation, "due_date" | "status">,
  today: string,
  dueSoonDays = 7
): boolean {
  if (!isBlockingRemediationStatus(remediation.status)) return false;
  if (!remediation.due_date) return false;

  const dueDate = remediation.due_date.slice(0, 10);
  return dueDate >= today && dueDate <= addDaysDateKey(today, dueSoonDays);
}

export function buildReportReviewQueue(params: {
  snapshots: ReportReviewQueueSnapshot[];
  remediations: ReportReviewQueueRemediation[];
  now?: Date | string;
}): ReportReviewQueue {
  const today = dateKey(params.now ?? new Date());
  const nonFinalSnapshots = params.snapshots.filter(
    (snapshot) => (snapshot.delivery_status ?? "draft") !== "final"
  );
  const nonFinalSnapshotIds = new Set(nonFinalSnapshots.map((snapshot) => snapshot.id));
  const remediationGroups = groupRemediationsBySnapshot(
    params.remediations.filter((item) => nonFinalSnapshotIds.has(item.snapshot_id))
  );

  const rows = nonFinalSnapshots
    .map((snapshot): ReportReviewQueueRow | null => {
      const reviewStatus = snapshot.review_status ?? "not_submitted";
      const deliveryStatus = snapshot.delivery_status ?? "draft";
      const remediations = remediationGroups.get(snapshot.id) ?? [];
      const openRemediations = remediations.filter((item) =>
        isBlockingRemediationStatus(item.status)
      );
      const overdueRemediations = openRemediations.filter((item) =>
        isRemediationOverdue(item, today)
      );
      const dueSoonRemediations = openRemediations.filter((item) =>
        isRemediationDueSoon(item, today)
      );
      const nextDueDate = nextRemediationDueDate(openRemediations);

      if (openRemediations.length > 0) {
        return {
          snapshotId: snapshot.id,
          title: snapshot.title,
          reportType: snapshot.report_type,
          clientName: snapshot.client_name ?? null,
          generatedByEmail: snapshot.generated_by_email ?? null,
          reviewStatus,
          deliveryStatus,
          createdAt: snapshot.created_at,
          status: "remediation_blocked",
          statusLabel:
            overdueRemediations.length > 0
              ? "Overdue Remediation"
              : "Remediation Needed",
          priority: overdueRemediations.length > 0 ? 1 : 2,
          openRemediationCount: openRemediations.length,
          overdueRemediationCount: overdueRemediations.length,
          dueSoonRemediationCount: dueSoonRemediations.length,
          nextDueDate,
          remediationOwners: uniqueOwners(openRemediations),
        };
      }

      if (reviewStatus === "needs_review") {
        return queueRow(snapshot, reviewStatus, deliveryStatus, {
          status: "needs_review",
          statusLabel: "Needs Review",
          priority: 3,
        });
      }

      if (reviewStatus === "changes_requested") {
        return queueRow(snapshot, reviewStatus, deliveryStatus, {
          status: "changes_requested",
          statusLabel: "Changes Requested",
          priority: 4,
        });
      }

      if (reviewStatus === "approved") {
        return queueRow(snapshot, reviewStatus, deliveryStatus, {
          status: "ready_to_finalize",
          statusLabel: "Ready To Finalize",
          priority: 5,
        });
      }

      return null;
    })
    .filter((row): row is ReportReviewQueueRow => Boolean(row))
    .sort(compareRows);

  const summary = summarizeQueue(params.snapshots, params.remediations, rows, today);

  return { rows, summary };
}

function queueRow(
  snapshot: ReportReviewQueueSnapshot,
  reviewStatus: GovernanceReportReviewStatus,
  deliveryStatus: GovernanceReportDeliveryStatus,
  status: Pick<ReportReviewQueueRow, "status" | "statusLabel" | "priority">
): ReportReviewQueueRow {
  return {
    snapshotId: snapshot.id,
    title: snapshot.title,
    reportType: snapshot.report_type,
    clientName: snapshot.client_name ?? null,
    generatedByEmail: snapshot.generated_by_email ?? null,
    reviewStatus,
    deliveryStatus,
    createdAt: snapshot.created_at,
    ...status,
    openRemediationCount: 0,
    overdueRemediationCount: 0,
    dueSoonRemediationCount: 0,
    nextDueDate: null,
    remediationOwners: [],
  };
}

function summarizeQueue(
  snapshots: ReportReviewQueueSnapshot[],
  remediations: ReportReviewQueueRemediation[],
  rows: ReportReviewQueueRow[],
  today: string
): ReportReviewQueueSummary {
  const nonFinalSnapshots = snapshots.filter(
    (snapshot) => (snapshot.delivery_status ?? "draft") !== "final"
  );
  const nonFinalSnapshotIds = new Set(nonFinalSnapshots.map((snapshot) => snapshot.id));
  const relevantRemediations = remediations.filter((item) =>
    nonFinalSnapshotIds.has(item.snapshot_id)
  );

  return {
    totalSnapshots: snapshots.length,
    finalSnapshots: snapshots.length - nonFinalSnapshots.length,
    actionableSnapshots: rows.length,
    needsReview: nonFinalSnapshots.filter(
      (snapshot) => (snapshot.review_status ?? "not_submitted") === "needs_review"
    ).length,
    changesRequested: nonFinalSnapshots.filter(
      (snapshot) => (snapshot.review_status ?? "not_submitted") === "changes_requested"
    ).length,
    readyToFinalize: rows.filter((row) => row.status === "ready_to_finalize").length,
    openRemediations: relevantRemediations.filter((item) =>
      isBlockingRemediationStatus(item.status)
    ).length,
    overdueRemediations: relevantRemediations.filter((item) =>
      isRemediationOverdue(item, today)
    ).length,
    dueSoonRemediations: relevantRemediations.filter((item) =>
      isRemediationDueSoon(item, today)
    ).length,
  };
}

function groupRemediationsBySnapshot(remediations: ReportReviewQueueRemediation[]) {
  const groups = new Map<string, ReportReviewQueueRemediation[]>();

  for (const remediation of remediations) {
    const existing = groups.get(remediation.snapshot_id) ?? [];
    existing.push(remediation);
    groups.set(remediation.snapshot_id, existing);
  }

  return groups;
}

function nextRemediationDueDate(
  remediations: ReportReviewQueueRemediation[]
): string | null {
  const dueDates = remediations
    .map((item) => item.due_date?.slice(0, 10) ?? null)
    .filter((value): value is string => Boolean(value))
    .sort();

  return dueDates[0] ?? null;
}

function uniqueOwners(remediations: ReportReviewQueueRemediation[]): string[] {
  const owners = new Set<string>();

  for (const remediation of remediations) {
    const owner = remediation.owner?.trim();
    if (owner) owners.add(owner);
  }

  return Array.from(owners).sort((a, b) => a.localeCompare(b));
}

function compareRows(a: ReportReviewQueueRow, b: ReportReviewQueueRow): number {
  if (a.priority !== b.priority) return a.priority - b.priority;

  const aDue = a.nextDueDate ?? "9999-12-31";
  const bDue = b.nextDueDate ?? "9999-12-31";
  if (aDue !== bDue) return aDue.localeCompare(bDue);

  return b.createdAt.localeCompare(a.createdAt);
}

function dateKey(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

export function addDaysDateKey(value: string, days: number): string {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));

  return date.toISOString().slice(0, 10);
}
