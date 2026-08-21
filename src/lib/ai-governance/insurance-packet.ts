/**
 * Cyber Insurance AI Risk Packet (approved roadmap item #3).
 *
 * Maps the org's existing governance data onto the AI/SaaS questions
 * that appear (in near-identical form) on cyber insurance applications
 * and renewals. Pure functions — callers fetch the inputs.
 *
 * Honesty rules baked in:
 *   - Every answer derives only from data ShadowGuard actually holds.
 *   - Questions we can't evidence are answered "no_data", never "yes".
 *   - The packet disclaims that it informs (not guarantees) coverage.
 */

import type { PortfolioGovernanceReport } from "./portfolio-report";

export type InsuranceAnswerStatus = "yes" | "partial" | "no" | "no_data";

export type InsurancePacketItem = {
  /** Stable key for tests and rendering. */
  key: string;
  /** The question as insurers typically phrase it. */
  question: string;
  status: InsuranceAnswerStatus;
  /** Plain-English answer with the numbers behind it. */
  answer: string;
  /** Where in ShadowGuard the proof lives. */
  evidence: string[];
};

export type InsurancePacketStats = {
  /** Versioned AI usage policies stored in ShadowGuard. */
  policyDocumentCount: number;
  /** Total workspace scans recorded. */
  scanCount: number;
  lastScannedAt: string | null;
  /** AI tools detected by the latest discovery data. */
  aiToolsDetected: number;
  approvedToolsCount: number;
  blockedToolsCount: number;
  googleConnected: boolean;
  microsoftConnected: boolean;
};

export type InsurancePacket = {
  generatedAt: string;
  items: InsurancePacketItem[];
  summary: {
    yes: number;
    partial: number;
    no: number;
    noData: number;
    readinessLabel: string;
  };
  disclaimer: string;
};

export const INSURANCE_PACKET_DISCLAIMER =
  "This packet summarizes AI governance records maintained in ShadowGuard to support insurance applications and renewals. It reflects recorded data only, does not constitute a certification or audit, and does not guarantee any coverage, premium, or underwriting outcome.";

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

function readinessLabel(yes: number, total: number): string {
  if (total === 0) return "No data";
  const ratio = yes / total;
  if (ratio >= 0.8) return "Strong";
  if (ratio >= 0.5) return "Developing";
  return "Early";
}

export function buildInsurancePacket(params: {
  report: PortfolioGovernanceReport;
  stats: InsurancePacketStats;
  generatedAt: string;
}): InsurancePacket {
  const { report, stats, generatedAt } = params;
  const totals = report.totals;
  const items: InsurancePacketItem[] = [];

  // 1. AI inventory.
  items.push({
    key: "ai-inventory",
    question:
      "Does your organization maintain an inventory of AI systems and AI-enabled tools in use?",
    status: totals.totalSystems > 0 ? "yes" : "no",
    answer:
      totals.totalSystems > 0
        ? `Yes. ${totals.totalSystems} AI ${pluralize(totals.totalSystems, "system")} ${totals.totalSystems === 1 ? "is" : "are"} registered in the AI System Registry with owner, use case, and data sensitivity recorded.`
        : "No AI systems are registered yet. Start the AI System Registry to answer this affirmatively.",
    evidence: ["AI System Registry (Dashboard → AI Systems)"],
  });

  // 2. Shadow AI / unauthorized tool discovery.
  const discoveryConnected = stats.googleConnected || stats.microsoftConnected;
  items.push({
    key: "shadow-ai-discovery",
    question:
      "Do you have a process to discover unauthorized or unmanaged AI tools connected to corporate systems?",
    status: discoveryConnected && stats.scanCount > 0 ? "yes" : discoveryConnected ? "partial" : "no",
    answer: discoveryConnected
      ? stats.scanCount > 0
        ? `Yes. ${stats.scanCount} workspace discovery ${pluralize(stats.scanCount, "scan has", "scans have")} been run against connected ${[stats.googleConnected ? "Google Workspace" : null, stats.microsoftConnected ? "Microsoft 365" : null].filter(Boolean).join(" and ")} ${stats.googleConnected && stats.microsoftConnected ? "tenants" : "tenant"}${stats.lastScannedAt ? `, most recently on ${new Date(stats.lastScannedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}. ${stats.aiToolsDetected} AI ${pluralize(stats.aiToolsDetected, "tool")} detected.`
        : "A workspace is connected for discovery, but no scan has been recorded yet."
      : "No workspace is connected for automated discovery. Connect Google Workspace or Microsoft 365 to evidence this control.",
    evidence: ["Scan history (Dashboard → Overview)", "Application inventory (Dashboard → Applications)"],
  });

  // 3. AI usage policy.
  items.push({
    key: "ai-usage-policy",
    question: "Do you maintain a written AI acceptable-use policy?",
    status: stats.policyDocumentCount > 0 ? "yes" : "no",
    answer:
      stats.policyDocumentCount > 0
        ? `Yes. ${stats.policyDocumentCount} versioned AI usage ${pluralize(stats.policyDocumentCount, "policy is", "policies are")} stored, generated from the organization's approved and blocked tool lists.`
        : "No AI usage policy has been generated or stored yet.",
    evidence: ["Policy documents (Dashboard → Policy Generator)"],
  });

  // 4. Risk assessments.
  items.push({
    key: "risk-assessments",
    question: "Are AI systems risk-assessed before or during use?",
    status:
      totals.totalSystems === 0
        ? "no_data"
        : totals.assessedSystems === totals.totalSystems
          ? "yes"
          : totals.assessedSystems > 0
            ? "partial"
            : "no",
    answer:
      totals.totalSystems === 0
        ? "No AI systems registered, so no assessments exist."
        : `${totals.assessedSystems} of ${totals.totalSystems} registered ${pluralize(totals.totalSystems, "system")} ${totals.assessedSystems === 1 ? "has" : "have"} a completed structured risk assessment covering data sensitivity, autonomy, human review, vendor posture, and regulated decision areas.`,
    evidence: ["Risk assessments (AI System → Assessment tab)"],
  });

  // 5. High-risk identification and control.
  items.push({
    key: "high-risk-controls",
    question:
      "Are higher-risk AI uses identified, and are compensating controls tracked to closure?",
    status:
      totals.totalSystems === 0
        ? "no_data"
        : totals.openRequiredControls === 0 && totals.totalControls > 0
          ? "yes"
          : totals.totalControls > 0
            ? "partial"
            : "no",
    answer:
      totals.totalSystems === 0
        ? "No AI systems registered yet."
        : `${totals.highRiskSystems} ${pluralize(totals.highRiskSystems, "system is", "systems are")} classified high or critical risk. ${totals.totalControls} ${pluralize(totals.totalControls, "control is", "controls are")} tracked; ${totals.openRequiredControls} required ${pluralize(totals.openRequiredControls, "control remains", "controls remain")} open. Portfolio control readiness is ${totals.readinessPercent}%.`,
    evidence: ["Control tracking (AI System → Controls)", "Governance report (Dashboard → Governance Report)"],
  });

  // 6. Third-party / OAuth access management.
  items.push({
    key: "third-party-access",
    question:
      "Do you review and restrict third-party applications' OAuth access to corporate data?",
    status:
      stats.approvedToolsCount + stats.blockedToolsCount > 0
        ? "yes"
        : discoveryConnected
          ? "partial"
          : "no_data",
    answer:
      stats.approvedToolsCount + stats.blockedToolsCount > 0
        ? `Yes. ${stats.approvedToolsCount} ${pluralize(stats.approvedToolsCount, "tool")} explicitly approved and ${stats.blockedToolsCount} blocked following review of discovered OAuth grants and permission scopes.`
        : discoveryConnected
          ? "Discovery is connected, but no approve/block decisions have been recorded yet."
          : "No discovery connection or review decisions recorded.",
    evidence: ["Approved tools and blocklist (Dashboard → Applications)", "Audit log (Dashboard → Audit)"],
  });

  // 7. Vendor due diligence.
  const vendorControls = report.systems.flatMap((s) =>
    s.controls.filter((c) => c.control_key === "vendor-review")
  );
  const closedVendorControls = vendorControls.filter(
    (c) => c.status === "completed" || c.status === "waived"
  );
  items.push({
    key: "vendor-diligence",
    question: "Do you perform security due diligence on AI vendors?",
    status:
      vendorControls.length === 0
        ? totals.totalSystems > 0
          ? "no"
          : "no_data"
        : closedVendorControls.length === vendorControls.length
          ? "yes"
          : "partial",
    answer:
      vendorControls.length === 0
        ? "No vendor-review controls are tracked yet."
        : `${closedVendorControls.length} of ${vendorControls.length} vendor-review ${pluralize(vendorControls.length, "control")} completed, with evidence metadata recorded against each closure.`,
    evidence: ["Vendor review controls (AI System → Controls)", "Evidence binder (AI System → Evidence)"],
  });

  // 8. Evidence retention.
  items.push({
    key: "evidence-retention",
    question:
      "Can you produce evidence of AI governance activities (assessments, approvals, reviews) on request?",
    status:
      totals.totalControls === 0
        ? "no_data"
        : totals.evidenceGaps === 0
          ? "yes"
          : "partial",
    answer:
      totals.totalControls === 0
        ? "No controls tracked yet, so no evidence trail exists."
        : totals.evidenceGaps === 0
          ? "Yes. Every closed control carries evidence metadata, and report snapshots preserve point-in-time records with review and approval history."
          : `Mostly. ${totals.evidenceGaps} closed ${pluralize(totals.evidenceGaps, "control lacks", "controls lack")} evidence metadata; the remainder are documented. Report snapshots preserve point-in-time records.`,
    evidence: [
      "Evidence binder (AI System → Evidence)",
      "Report snapshots (Dashboard → Report Snapshots)",
      "Audit log (Dashboard → Audit)",
    ],
  });

  // 9. Periodic review cadence.
  items.push({
    key: "review-cadence",
    question: "Is AI risk reviewed on a recurring cadence?",
    status:
      stats.scanCount >= 2
        ? "yes"
        : stats.scanCount === 1 || totals.totalSystems > 0
          ? "partial"
          : "no_data",
    answer:
      stats.scanCount >= 2
        ? `Yes. Repeated discovery scans (${stats.scanCount} recorded) enable period-over-period change tracking, and registry records carry next-review dates.`
        : stats.scanCount === 1
          ? "One scan has been recorded; a recurring cadence is not yet evidenced."
          : totals.totalSystems > 0
            ? "Registry records exist with review dates, but no recurring scan cadence is evidenced yet."
            : "No review cadence is evidenced yet.",
    evidence: ["Scan history and scan deltas (Dashboard → Overview)", "Next review dates (Dashboard → AI Systems)"],
  });

  const summaryCounts = items.reduce(
    (acc, item) => {
      if (item.status === "yes") acc.yes += 1;
      else if (item.status === "partial") acc.partial += 1;
      else if (item.status === "no") acc.no += 1;
      else acc.noData += 1;
      return acc;
    },
    { yes: 0, partial: 0, no: 0, noData: 0 }
  );

  return {
    generatedAt,
    items,
    summary: {
      ...summaryCounts,
      readinessLabel: readinessLabel(summaryCounts.yes, items.length),
    },
    disclaimer: INSURANCE_PACKET_DISCLAIMER,
  };
}
