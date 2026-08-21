import {
  humanizeSnapshotMetric,
  riskTierFromSnapshotMetric,
  snapshotReportTypeLabels,
} from "./snapshots";
import { groupFrameworkCoverage } from "./frameworks";
import type {
  AIFrameworkCoverageItem,
  AIGovernanceRiskTier,
  GovernanceReportDeliveryStatus,
  GovernanceReportSnapshot,
  GovernanceReportSnapshotType,
} from "./types";

type JsonObject = Record<string, unknown>;

export type ClientExportPackMetric = {
  label: string;
  value: string;
  tone: "default" | "good" | "warning" | "risk";
};

export type ClientExportPackAppendixSection = {
  title: string;
  items: string[];
};

export type ClientExportPack = {
  title: string;
  reportType: GovernanceReportSnapshotType;
  reportTypeLabel: string;
  generatedAt: string;
  generatedBy: string;
  clientName: string;
  preparedByNote: string;
  executiveSummaryNote: string;
  deliveryStatus: GovernanceReportDeliveryStatus;
  executiveSummary: string;
  metrics: ClientExportPackMetric[];
  frameworkAlignment: string[];
  keyFindings: string[];
  evidenceGaps: string[];
  nextActions: string[];
  appendix: ClientExportPackAppendixSection[];
};

const highRiskTiers = new Set<AIGovernanceRiskTier>(["critical", "high"]);

function deliveryStatusFromSnapshot(snapshot: GovernanceReportSnapshot): GovernanceReportDeliveryStatus {
  return snapshot.delivery_status === "final" ? "final" : "draft";
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asText(value: unknown, fallback = "Not provided"): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

function metricTone(key: string, value: unknown): ClientExportPackMetric["tone"] {
  const riskTier = riskTierFromSnapshotMetric(value);
  if (riskTier) return highRiskTiers.has(riskTier) ? "risk" : "warning";

  const normalizedKey = key.toLowerCase();
  const numberValue = asNumber(value);
  if (numberValue === null) return "default";

  if (normalizedKey.includes("readiness")) {
    if (numberValue >= 80) return "good";
    if (numberValue >= 50) return "warning";
    return "risk";
  }

  if (
    normalizedKey.includes("risk") ||
    normalizedKey.includes("open") ||
    normalizedKey.includes("gap") ||
    normalizedKey.includes("unassessed")
  ) {
    return numberValue > 0 ? "warning" : "good";
  }

  return "default";
}

function formatMetricValue(key: string, value: unknown): string {
  const riskTier = riskTierFromSnapshotMetric(value);
  if (riskTier) return humanize(riskTier);

  if (typeof value === "number") {
    return key.toLowerCase().includes("percent") ? `${value}%` : String(value);
  }

  return asText(value, "N/A");
}

function metricsFromSnapshot(summaryMetrics: Record<string, unknown>): ClientExportPackMetric[] {
  return Object.entries(summaryMetrics)
    .filter(([, value]) => typeof value === "string" || typeof value === "number")
    .slice(0, 8)
    .map(([key, value]) => ({
      label: humanizeSnapshotMetric(key),
      value: formatMetricValue(key, value),
      tone: metricTone(key, value),
    }));
}

function firstNumber(...values: unknown[]): number {
  for (const value of values) {
    const numberValue = asNumber(value);
    if (numberValue !== null) return numberValue;
  }
  return 0;
}

function textList(values: unknown[], fallback: string): string[] {
  const items = values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  return items.length > 0 ? items : [fallback];
}

function controlTitle(item: unknown): string {
  const control = asObject(item);
  return asText(control.title, "Untitled control");
}

function controlSummary(item: unknown): string {
  const control = asObject(item);
  const title = controlTitle(control);
  const category = asText(control.category, "Control");
  const priority = asText(control.priority, "recommended");
  const status = asText(control.status, "not_started");
  const owner = asText(control.owner, "");
  const dueDate = asText(control.due_date, "");
  const ownerPart = owner ? `, owner: ${owner}` : "";
  const duePart = dueDate ? `, due: ${dueDate}` : "";

  return `${title} (${category}, ${humanize(priority)}, ${humanize(status)}${ownerPart}${duePart})`;
}

function systemNameFromItem(item: unknown): string {
  const object = asObject(item);
  const system = asObject(object.system);
  return asText(system.name, asText(object.name, "AI system"));
}

function systemControlSummary(item: unknown): string {
  const object = asObject(item);
  const system = asObject(object.system);
  const control = asObject(object.control);
  const systemName = asText(system.name, "AI system");

  if (Object.keys(control).length > 0) {
    return `${systemName}: ${controlSummary(control)}`;
  }

  return systemNameFromItem(item);
}

function evidenceRecordSummary(item: unknown): string {
  const evidence = asObject(item);
  const title = asText(evidence.title, "Evidence record");
  const category = asText(evidence.category, "evidence");
  const status = asText(evidence.status, "draft");
  const owner = asText(evidence.owner, "");
  const url = asText(evidence.evidence_url, "");
  const ownerPart = owner ? `, owner: ${owner}` : "";
  const urlPart = url ? `, URL: ${url}` : "";

  return `${title} (${humanize(category)}, ${humanize(status)}${ownerPart}${urlPart})`;
}

function evidenceGroupSummary(item: unknown): string {
  const group = asObject(item);
  const control = asObject(group.control);
  const evidence = asArray(group.evidence);
  const legacy = Boolean(group.hasLegacyEvidence);
  const evidenceTitles = evidence.map(evidenceRecordSummary);

  if (legacy) evidenceTitles.push("Legacy control evidence metadata");
  if (evidenceTitles.length === 0) evidenceTitles.push("No linked evidence records");

  return `${controlTitle(control)}: ${evidenceTitles.join("; ")}`;
}

function limitList(items: string[], fallback: string, limit = 12): string[] {
  const filtered = items.filter((item) => item.trim());
  if (filtered.length === 0) return [fallback];

  if (filtered.length <= limit) return filtered;
  return [
    ...filtered.slice(0, limit),
    `${filtered.length - limit} additional ${pluralize(filtered.length - limit, "item")} omitted from this printable summary.`,
  ];
}

function frameworkCoverageSummary(item: unknown): string {
  const coverage = asObject(item);
  const frameworkLabel = asText(coverage.framework_label, "Framework");
  const code = asText(coverage.code, "");
  const category = asText(coverage.category, "Category");
  const closed = firstNumber(coverage.closedControls);
  const total = firstNumber(coverage.totalControls);
  const readiness = firstNumber(coverage.readinessPercent);
  const title = asText(coverage.title, category);
  const codePart = code ? ` ${code}` : "";

  return `${frameworkLabel}${codePart} - ${title}: ${closed}/${total} controls closed (${readiness}% ready).`;
}

function frameworkAlignmentFromReport(report: JsonObject): string[] {
  const coverage = asArray(report.frameworkCoverage) as AIFrameworkCoverageItem[];
  const groups = groupFrameworkCoverage(coverage);

  if (groups.length > 0) {
    return limitList(
      groups.flatMap((group) => [
        `${group.label} crosswalks:`,
        ...group.items.map(frameworkCoverageSummary),
      ]),
      "No framework alignment metadata was captured in this saved snapshot.",
      18
    );
  }

  return limitList(
    coverage.map(frameworkCoverageSummary),
    "No framework alignment metadata was captured in this saved snapshot."
  );
}

function buildReadinessExportPack(
  snapshot: GovernanceReportSnapshot,
  report: JsonObject,
  metrics: ClientExportPackMetric[]
): ClientExportPack {
  const system = asObject(report.system);
  const latestAssessment = asObject(report.latestAssessment);
  const readiness = asObject(report.readiness);
  const evidence = asObject(report.evidence);
  const systemName = asText(system.name, "AI System");
  const riskTier = asText(latestAssessment.risk_tier ?? system.risk_tier, "unknown");
  const readinessPercent = firstNumber(
    readiness.readinessPercent,
    snapshot.summary_metrics.readinessPercent
  );
  const totalControls = firstNumber(
    readiness.total,
    snapshot.summary_metrics.totalControls,
    asArray(report.openControls).length + asArray(report.closedControls).length
  );
  const openControls = asArray(report.openControls);
  const closedControls = asArray(report.closedControls);
  const openRequiredControls = openControls.filter(
    (control) => asText(asObject(control).priority, "") === "required"
  );
  const evidenceGaps = asArray(evidence.evidenceGaps);
  const evidenceRecords = asArray(report.evidenceRecords);
  const evidenceGroups = asArray(evidence.controlEvidenceGroups);
  const standaloneEvidence = asArray(evidence.standaloneEvidence);
  const frameworkAlignment = frameworkAlignmentFromReport(report);

  return {
    title: snapshot.title,
    reportType: "ai_system_readiness",
    reportTypeLabel: snapshotReportTypeLabels.ai_system_readiness,
    generatedAt: snapshot.created_at,
    generatedBy: snapshot.generated_by_email || "Unknown",
    clientName: asText(snapshot.client_name, "Client review"),
    preparedByNote: asText(snapshot.prepared_by_note, ""),
    executiveSummaryNote: asText(snapshot.executive_summary_note, ""),
    deliveryStatus: deliveryStatusFromSnapshot(snapshot),
    executiveSummary:
      `${systemName} was captured as a point-in-time AI governance readiness report. ` +
      `The saved snapshot shows ${readinessPercent}% readiness, ${humanize(riskTier)} risk, ` +
      `${openControls.length} open ${pluralize(openControls.length, "control")}, and ` +
      `${evidenceGaps.length} evidence ${pluralize(evidenceGaps.length, "gap")}.`,
    metrics,
    frameworkAlignment,
    keyFindings: [
      `Risk tier: ${humanize(riskTier)}.`,
      `${closedControls.length} of ${totalControls} ${pluralize(totalControls, "control")} are completed or waived.`,
      openRequiredControls.length > 0
        ? `${openRequiredControls.length} required ${pluralize(openRequiredControls.length, "control")} remain open.`
        : "No open required controls were captured in this snapshot.",
      evidenceRecords.length > 0
        ? `${evidenceRecords.length} evidence ${pluralize(evidenceRecords.length, "record")} are attached.`
        : "No standalone evidence records were captured in this snapshot.",
    ],
    evidenceGaps: limitList(
      evidenceGaps.map(controlSummary),
      "No evidence gaps were captured in this snapshot."
    ),
    nextActions: textList(
      asArray(report.nextActions),
      "Maintain periodic review and update evidence when the system, vendor, or use case changes."
    ),
    appendix: [
      {
        title: "System Overview",
        items: [
          `System: ${systemName}`,
          `Use case: ${asText(system.use_case)}`,
          `Owner: ${asText(system.owner_name, "Unassigned")}`,
          `Department: ${asText(system.department)}`,
          `Vendor: ${asText(system.vendor_name)}`,
          `Data sensitivity: ${humanize(asText(system.data_sensitivity, "unknown"))}`,
          `Approval status: ${humanize(asText(system.approval_status, "unknown"))}`,
        ],
      },
      {
        title: "Open Controls",
        items: limitList(openControls.map(controlSummary), "No open controls captured."),
      },
      {
        title: "Completed Or Waived Controls",
        items: limitList(closedControls.map(controlSummary), "No completed or waived controls captured."),
      },
      {
        title: "Linked Evidence",
        items: limitList(
          [
            ...evidenceGroups.map(evidenceGroupSummary),
            ...standaloneEvidence.map(evidenceRecordSummary),
          ],
          "No linked evidence records captured."
        ),
      },
    ],
  };
}

function buildPortfolioExportPack(
  snapshot: GovernanceReportSnapshot,
  report: JsonObject,
  metrics: ClientExportPackMetric[]
): ClientExportPack {
  const totals = asObject(report.totals);
  const riskPosture = asObject(report.riskPosture);
  const totalSystems = firstNumber(totals.totalSystems, snapshot.summary_metrics.totalSystems);
  const assessedSystems = firstNumber(totals.assessedSystems, snapshot.summary_metrics.assessedSystems);
  const readinessPercent = firstNumber(
    totals.readinessPercent,
    snapshot.summary_metrics.readinessPercent
  );
  const highRiskSystems = asArray(report.highRiskSystems);
  const unassessedSystems = asArray(report.unassessedSystems);
  const openRequiredControls = asArray(report.openRequiredControls);
  const evidenceGaps = asArray(report.evidenceGaps);
  const frameworkAlignment = frameworkAlignmentFromReport(report);
  const scanDelta = asObject(report.scanDelta);
  const scanDeltaSummary = asObject(scanDelta.summary);
  const hasScanDelta = Object.keys(scanDeltaSummary).length > 0;

  return {
    title: snapshot.title,
    reportType: "organization_governance",
    reportTypeLabel: snapshotReportTypeLabels.organization_governance,
    generatedAt: snapshot.created_at,
    generatedBy: snapshot.generated_by_email || "Unknown",
    clientName: asText(snapshot.client_name, "Client review"),
    preparedByNote: asText(snapshot.prepared_by_note, ""),
    executiveSummaryNote: asText(snapshot.executive_summary_note, ""),
    deliveryStatus: deliveryStatusFromSnapshot(snapshot),
    executiveSummary:
      `This saved organization governance snapshot covers ${totalSystems} active ` +
      `${pluralize(totalSystems, "AI system")}. Portfolio readiness is ${readinessPercent}%, ` +
      `with ${highRiskSystems.length} high or critical risk ${pluralize(highRiskSystems.length, "system")}, ` +
      `${openRequiredControls.length} open required ${pluralize(openRequiredControls.length, "control")}, and ` +
      `${evidenceGaps.length} evidence ${pluralize(evidenceGaps.length, "gap")}.`,
    metrics,
    frameworkAlignment,
    keyFindings: [
      `${assessedSystems} of ${totalSystems} ${pluralize(totalSystems, "system")} have completed assessments.`,
      `Risk posture: ${firstNumber(riskPosture.critical)} critical, ${firstNumber(riskPosture.high)} high, ${firstNumber(riskPosture.medium)} medium, ${firstNumber(riskPosture.low)} low.`,
      `${openRequiredControls.length} required ${pluralize(openRequiredControls.length, "control")} remain open across the portfolio.`,
      evidenceGaps.length > 0
        ? `${evidenceGaps.length} closed ${pluralize(evidenceGaps.length, "control")} still need evidence.`
        : "No portfolio evidence gaps were captured in this snapshot.",
      ...(hasScanDelta
        ? [
            `Since the previous workspace scan: ${firstNumber(scanDeltaSummary.newAiTools)} new AI ${pluralize(firstNumber(scanDeltaSummary.newAiTools), "tool")} detected, ${firstNumber(scanDeltaSummary.riskIncreased)} risk ${pluralize(firstNumber(scanDeltaSummary.riskIncreased), "increase")}, ${firstNumber(scanDeltaSummary.scopeExpansions)} permission scope ${pluralize(firstNumber(scanDeltaSummary.scopeExpansions), "expansion")}.`,
          ]
        : []),
    ],
    evidenceGaps: limitList(
      evidenceGaps.map(systemControlSummary),
      "No evidence gaps were captured in this snapshot."
    ),
    nextActions: textList(
      asArray(report.nextActions),
      "Maintain periodic review and re-run assessments when systems, vendors, or data use materially change."
    ),
    appendix: [
      {
        title: "High Or Critical Risk Systems",
        items: limitList(highRiskSystems.map(systemNameFromItem), "No high or critical risk systems captured."),
      },
      {
        title: "Systems Missing Assessments",
        items: limitList(unassessedSystems.map(systemNameFromItem), "No systems missing assessments captured."),
      },
      {
        title: "Open Required Controls",
        items: limitList(openRequiredControls.map(systemControlSummary), "No open required controls captured."),
      },
      {
        title: "Evidence Gaps",
        items: limitList(evidenceGaps.map(systemControlSummary), "No evidence gaps captured."),
      },
      ...(hasScanDelta
        ? [
            {
              title: "Changes Since Previous Scan",
              items: limitList(
                [
                  ...asArray(scanDelta.newApps).map((item) => {
                    const app = asObject(item);
                    return `New: ${asText(app.appName, "App")} (${humanize(asText(app.riskLevel, "low"))} risk, ${firstNumber(app.userCount)} ${pluralize(firstNumber(app.userCount), "user")})`;
                  }),
                  ...asArray(scanDelta.riskIncreases).map((item) => {
                    const change = asObject(item);
                    return `Risk increased: ${asText(change.appName, "App")} ${firstNumber(change.previousScore)} → ${firstNumber(change.currentScore)}`;
                  }),
                  ...asArray(scanDelta.scopeAdditions).map((item) => {
                    const addition = asObject(item);
                    const scopes = asArray(addition.addedScopes).length;
                    return `Scope expansion: ${asText(addition.appName, "App")} gained ${scopes} ${pluralize(scopes, "permission scope")}`;
                  }),
                ],
                "No discovery changes captured between the two most recent scans."
              ),
            },
          ]
        : []),
    ],
  };
}

export function buildClientExportPack(snapshot: GovernanceReportSnapshot): ClientExportPack {
  const report = asObject(snapshot.snapshot);
  const metrics = metricsFromSnapshot(snapshot.summary_metrics);

  if (snapshot.report_type === "organization_governance") {
    return buildPortfolioExportPack(snapshot, report, metrics);
  }

  return buildReadinessExportPack(snapshot, report, metrics);
}
