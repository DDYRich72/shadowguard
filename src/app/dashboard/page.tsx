"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  AppWindow,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  Building2,
  ClipboardCheck,
  FileText,
  ListChecks,
  MessageSquareWarning,
  Radar,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScanDeltaCard } from "@/components/dashboard/scan-delta-card";
import { ReviewCycleCard } from "@/components/dashboard/review-cycle-card";

interface ScanResult {
  summary: {
    totalApps: number;
    aiTools: number;
    criticalRisk: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
  };
  apps: Array<{
    appName: string;
    category: string;
    isAITool: boolean;
    riskScore: number;
    riskLevel: "critical" | "high" | "medium" | "low";
    riskFactors: string[];
    connectedUsers: string[];
    lastActive: string;
    status: string;
    securityInfo: {
      hasSOC2: boolean;
      hasGDPR: boolean;
      hasHIPAA: boolean;
      dataResidency: string;
    };
  }>;
  errors?: Array<{ provider: string; message: string }>;
  scannedAt: string;
}

type GovernanceAlertSummary = {
  needsReview: number;
  changesRequested: number;
  openRemediations: number;
  overdueRemediations: number;
  readyToFinalize: number;
};

const RISK_PILL: Record<"critical" | "high" | "medium" | "low", string> = {
  critical: "sg-pill sg-pill-risk",
  high: "sg-pill sg-pill-risk",
  medium: "sg-pill sg-pill-warning",
  low: "sg-pill sg-pill-neutral",
};

const RISK_DOT: Record<"critical" | "high" | "medium" | "low", string> = {
  critical: "bg-[color:var(--risk)]",
  high: "bg-[color:var(--risk)]/80",
  medium: "bg-[color:var(--warning)]",
  low: "bg-muted-foreground/60",
};

export default function DashboardPage() {
  const router = useRouter();
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [governanceSummary, setGovernanceSummary] =
    useState<GovernanceAlertSummary | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [domain, setDomain] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadGovernanceSummary() {
      try {
        const response = await fetch("/api/governance/report-alerts");
        if (!response.ok) return;

        const data = await response.json();
        if (active) setGovernanceSummary(data.summary ?? null);
      } catch {
        if (active) setGovernanceSummary(null);
      }
    }

    loadGovernanceSummary();

    return () => {
      active = false;
    };
  }, []);

  async function startScan() {
    if (!domain) {
      setError("Enter your Google Workspace domain");
      return;
    }

    setIsScanning(true);
    setError("");

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Scan failed");
      }

      setScanResult({
        ...data,
        apps: Array.isArray(data.apps) ? data.apps : [],
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Scan failed";
      setError(message);
    } finally {
      setIsScanning(false);
    }
  }

  // ===== Connect / scan screen =====
  if (!scanResult) {
    return (
      <div className="space-y-8">
        <GovernanceWorkflowSummary summary={governanceSummary} />
        <ReviewCycleCard />
        <ScanDeltaCard />

        <div className="mx-auto max-w-3xl py-2">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card">
              <Radar className="h-7 w-7 text-[color:var(--brand)]" strokeWidth={1.75} />
            </div>
            <p className="mt-6 sg-mono text-[color:var(--brand)]">
              Step 01 · Discovery
            </p>
            <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight text-foreground">
              Discover your Shadow AI
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Connect Google Workspace or Microsoft 365 to scan for unauthorized
              AI tools your employees are using.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <ConnectCard
              icon={<AppWindow className="h-4 w-4" />}
              name="Google Workspace"
              code="WSP-GOOG"
              meta="OAuth grants · Drive · Gmail · Audit"
              description="Connect your Workspace domain. We'll redirect you to Google to authorize admin access. ShadowGuard only reads — it never modifies your data."
            >
              <label className="block sg-mono-sm text-muted-foreground">
                Workspace domain
              </label>
              <input
                type="text"
                placeholder="yourcompany.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="mt-2 w-full rounded-md border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-[color:var(--focus)] focus:outline-none focus:ring-1 focus:ring-[color:var(--focus)]"
              />
              <Button
                className="mt-3 h-10 w-full rounded-md bg-[color:var(--brand)] text-sm font-semibold tracking-tight text-white hover:bg-[color:var(--focus)]"
                onClick={() => router.push("/api/auth/google")}
              >
                Connect Google Workspace
              </Button>
            </ConnectCard>

            <ConnectCard
              icon={<Building2 className="h-4 w-4" />}
              name="Microsoft 365"
              code="WSP-M365"
              meta="Entra ID · Delegated permissions · Policy"
              description="Connect your Entra ID tenant to scan enterprise apps, delegated permission grants, and policy signals."
            >
              <Button
                className="h-10 w-full rounded-md bg-foreground text-sm font-semibold tracking-tight text-background hover:opacity-90"
                onClick={() => router.push("/api/auth/microsoft")}
              >
                Connect Microsoft 365
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">
                You&apos;ll be redirected to Microsoft to authorize admin access.
                OAuth state and callback checks protect the handoff.
              </p>
            </ConnectCard>
          </div>

          {domain && (
            <Button
              onClick={startScan}
              disabled={isScanning}
              className="mt-5 h-11 w-full rounded-md bg-[color:var(--brand)] text-sm font-semibold tracking-tight text-white hover:bg-[color:var(--focus)]"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Scanning {domain}…
                </>
              ) : (
                <>
                  <Radar className="mr-2 h-4 w-4" />
                  Run Shadow AI Scan
                </>
              )}
            </Button>
          )}

          {error && (
            <div className="mt-5 flex items-start gap-3 rounded-md border border-[color:var(--risk)]/30 bg-[color:var(--risk)]/10 p-3 text-sm text-[color:var(--risk)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== Results dashboard =====
  const { summary, apps } = scanResult;
  const topRiskApps = apps.filter((a) => a.isAITool).slice(0, 5);
  const totalAiTools = summary.aiTools || 0;
  const exposurePct = totalAiTools
    ? Math.round(((summary.criticalRisk + summary.highRisk) / totalAiTools) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <GovernanceWorkflowSummary summary={governanceSummary} />
      <ReviewCycleCard />
      {/* Re-fetch after every fresh scan so the diff includes it. */}
      <ScanDeltaCard refreshKey={new Date(scanResult.scannedAt).getTime()} />

      {scanResult.errors && scanResult.errors.length > 0 && (
        <div className="flex items-start gap-3 rounded-md border border-[color:var(--warning)]/30 bg-[color:var(--warning)]/8 p-4 text-sm text-[color:var(--warning-ink)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Scan completed with partial results. Some provider checks need
            attention:{" "}
            <span className="font-mono">
              {scanResult.errors.map((e) => e.provider).join(", ")}
            </span>
            .
          </span>
        </div>
      )}

      {/* ============ EXECUTIVE EXPOSURE BANNER ============ */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card">
        <div className="relative grid gap-px bg-border lg:grid-cols-[1.4fr_1fr]">
          {/* Headline — the big number */}
          <div className="relative bg-card p-7 lg:p-9">
            <div className="flex items-center justify-between">
              <span className="sg-pill sg-pill-brand">
                <TrendingUp className="h-3 w-3" />
                Executive exposure
              </span>
              <span className="sg-mono-sm text-muted-foreground">
                SCAN-{new Date(scanResult.scannedAt).getTime().toString().slice(-4)}
              </span>
            </div>

            <div className="mt-7 flex items-end gap-4">
              <span
                className={`font-display text-[5.5rem] font-semibold leading-none tracking-[-0.04em] ${
                  exposurePct >= 30
                    ? "text-[color:var(--risk)]"
                    : exposurePct >= 10
                      ? "text-[color:var(--warning-ink)]"
                      : "text-foreground"
                }`}
              >
                {exposurePct}
                <span className="text-3xl text-muted-foreground/60">%</span>
              </span>
              <span className="mb-3 max-w-[18ch] text-sm leading-tight text-muted-foreground">
                of detected AI tools carry high or critical risk
              </span>
            </div>

            <div className="mt-7 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border">
              <ExposureFact label="AI tools" value={summary.aiTools} />
              <ExposureFact
                label="Critical + high"
                value={summary.criticalRisk + summary.highRisk}
                tone="risk"
              />
              <ExposureFact
                label="Total apps"
                value={summary.totalApps}
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={startScan}
              disabled={isScanning}
              className="mt-6 rounded-md"
            >
              <RefreshCw
                className={`mr-2 h-3.5 w-3.5 ${isScanning ? "animate-spin" : ""}`}
              />
              Re-scan now
            </Button>
          </div>

          {/* Side — stat tiles */}
          <div className="grid grid-cols-2 gap-px bg-border">
            <StatTile
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Critical"
              value={summary.criticalRisk}
              sub="Critical exposure"
              tone="risk"
            />
            <StatTile
              icon={<AlertTriangle className="h-4 w-4" />}
              label="High risk"
              value={summary.highRisk}
              sub="Needs review"
              tone="risk-soft"
            />
            <StatTile
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Approved"
              value={0}
              sub="Monitored"
              tone="approved"
            />
            <StatTile
              icon={<XCircle className="h-4 w-4" />}
              label="Blocked"
              value={0}
              sub="No tools blocked"
              tone="neutral"
            />
          </div>
        </div>
      </section>

      {/* ============ RISK DISTRIBUTION ============ */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="h-px w-6 bg-[color:var(--brand)]" />
            <p className="sg-mono text-[color:var(--brand)]">
              Risk distribution
            </p>
          </div>
          <span className="sg-mono-sm text-muted-foreground">
            {summary.aiTools} AI tools
          </span>
        </header>
        <div className="grid gap-6 p-6 sm:grid-cols-4">
          <RiskBar label="Critical" count={summary.criticalRisk} total={summary.aiTools} tone="critical" />
          <RiskBar label="High" count={summary.highRisk} total={summary.aiTools} tone="high" />
          <RiskBar label="Medium" count={summary.mediumRisk} total={summary.aiTools} tone="medium" />
          <RiskBar label="Low" count={summary.lowRisk} total={summary.aiTools} tone="low" />
        </div>
      </section>

      {/* ============ HIGHEST-RISK AI TOOLS ============ */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="h-px w-6 bg-[color:var(--brand)]" />
              <p className="sg-mono text-[color:var(--brand)]">Risk findings</p>
            </div>
            <h3 className="font-display mt-2 text-lg font-semibold tracking-tight text-foreground">
              Highest-risk AI tools
            </h3>
          </div>
          <Button
            render={<Link href="/dashboard/apps" />}
            nativeButton={false}
            variant="ghost"
            size="sm"
          >
            View AI Registry <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </header>

        <div>
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 border-b border-border bg-background px-6 py-2.5 sg-mono-sm text-muted-foreground">
            <span>ID</span>
            <span>Tool</span>
            <span>Risk</span>
            <span className="hidden sm:inline">Posture</span>
          </div>
          {topRiskApps.length === 0 && (
            <p className="px-6 py-12 text-center text-sm text-muted-foreground">
              No AI tools detected. Your organization may be clean — or the scan
              needs to cover more users.
            </p>
          )}
          {topRiskApps.map((app, idx) => {
            return (
              <div
                key={app.appName}
                className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-b border-border px-6 py-4 transition-colors last:border-b-0 hover:bg-background/60"
              >
                <span className="sg-mono-sm text-muted-foreground/70">
                  SCAN-{String(idx + 1).padStart(4, "0")}
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-foreground">
                    <AppWindow className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {app.appName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="sg-mono-sm">{app.category}</span> ·{" "}
                      {app.connectedUsers.length} user
                      {app.connectedUsers.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <span className={RISK_PILL[app.riskLevel]}>
                  <span className={`sg-dot ${RISK_DOT[app.riskLevel]}`} />
                  {app.riskLevel} · {app.riskScore}
                </span>
                <div className="hidden gap-1 sm:flex">
                  {app.securityInfo.hasSOC2 && (
                    <span className="rounded border border-border bg-background px-1.5 py-0.5 sg-mono-sm text-muted-foreground">
                      SOC 2
                    </span>
                  )}
                  {app.securityInfo.hasGDPR && (
                    <span className="rounded border border-border bg-background px-1.5 py-0.5 sg-mono-sm text-muted-foreground">
                      GDPR
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Scan footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-3.5">
        <div className="flex items-center gap-2 sg-mono-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Last scanned · {new Date(scanResult.scannedAt).toLocaleString()}
        </div>
        <span className="sg-pill sg-pill-live">
          <span className="sg-dot bg-[color:var(--approved)] sg-pulse" />
          Monitoring live
        </span>
      </div>
    </div>
  );
}

/* ============ Sub-components ============ */

function ConnectCard({
  icon,
  name,
  code,
  meta,
  description,
  children,
}: {
  icon: React.ReactNode;
  name: string;
  code: string;
  meta: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground">
            {icon}
          </span>
          <div>
            <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">
              {name}
            </h3>
            <p className="sg-mono-sm mt-0.5 text-muted-foreground">{meta}</p>
          </div>
        </div>
        <span className="sg-pill sg-pill-neutral">{code}</span>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">{description}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function GovernanceWorkflowSummary({
  summary,
}: {
  summary: GovernanceAlertSummary | null;
}) {
  const cards = [
    {
      label: "Needs review",
      value: summary?.needsReview ?? 0,
      icon: ClipboardCheck,
      tone: "info" as const,
      code: "QUE-01",
    },
    {
      label: "Changes requested",
      value: summary?.changesRequested ?? 0,
      icon: MessageSquareWarning,
      tone: "warning" as const,
      code: "QUE-02",
    },
    {
      label: "Open remediation",
      value: summary?.openRemediations ?? 0,
      icon: ListChecks,
      tone: "brand" as const,
      code: "QUE-03",
    },
    {
      label: "Overdue",
      value: summary?.overdueRemediations ?? 0,
      icon: AlertTriangle,
      tone: "risk" as const,
      code: "QUE-04",
    },
    {
      label: "Ready to finalize",
      value: summary?.readyToFinalize ?? 0,
      icon: FileText,
      tone: "approved" as const,
      code: "QUE-05",
    },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-px w-6 bg-[color:var(--brand)]" />
            <p className="sg-mono text-[color:var(--brand)]">
              Governance workflow
            </p>
          </div>
          <h3 className="font-display mt-2 text-lg font-semibold tracking-tight text-foreground">
            Internal review and remediation
          </h3>
        </div>
        <Button
          render={<Link href="/dashboard/report-review-queue" />}
          nativeButton={false}
          variant="outline"
          size="sm"
          className="rounded-md"
        >
          Review Queue
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </header>
      <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-5">
        {cards.map((card) => (
          <GovStat key={card.label} {...card} />
        ))}
      </div>
    </section>
  );
}

function GovStat({
  label,
  value,
  icon: Icon,
  tone,
  code,
}: {
  label: string;
  value: number;
  icon: typeof ClipboardCheck;
  tone: "info" | "warning" | "brand" | "risk" | "approved";
  code: string;
}) {
  const toneClasses = {
    info: "bg-[color:var(--info)]/10 text-[color:var(--info)]",
    warning: "bg-[color:var(--warning)]/15 text-[color:var(--warning-ink)]",
    brand: "bg-[color:var(--brand)]/12 text-[color:var(--brand)]",
    risk: "bg-[color:var(--risk)]/12 text-[color:var(--risk)]",
    approved: "bg-[color:var(--approved)]/30 text-[color:var(--approved-foreground)]",
  }[tone];
  return (
    <div className="bg-card px-5 py-4">
      <div className="flex items-center justify-between">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-md ${toneClasses}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="sg-mono-sm text-muted-foreground/60">{code}</span>
      </div>
      <p className="font-display mt-3 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-0.5 text-[11.5px] text-muted-foreground">{label}</p>
    </div>
  );
}

function ExposureFact({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "risk";
}) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="sg-mono-sm text-muted-foreground">{label}</p>
      <p
        className={`font-display mt-1 text-xl font-semibold tracking-tight ${
          tone === "risk" ? "text-[color:var(--risk)]" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  tone: "risk" | "risk-soft" | "approved" | "neutral";
}) {
  const iconWrap = {
    risk: "bg-[color:var(--risk)]/12 text-[color:var(--risk)]",
    "risk-soft": "bg-[color:var(--risk)]/8 text-[color:var(--risk)]/85",
    approved: "bg-[color:var(--approved)]/25 text-[color:var(--approved-foreground)]",
    neutral: "bg-muted text-muted-foreground",
  }[tone];
  const valueColor =
    tone === "risk"
      ? "text-[color:var(--risk)]"
      : tone === "risk-soft"
        ? "text-[color:var(--risk)]/85"
        : "text-foreground";
  return (
    <div className="bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="sg-mono-sm text-muted-foreground">{label}</span>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-md ${iconWrap}`}
        >
          {icon}
        </span>
      </div>
      <p className={`font-display mt-2 text-3xl font-semibold tracking-tight ${valueColor}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[11.5px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function RiskBar({
  label,
  count,
  total,
  tone,
}: {
  label: string;
  count: number;
  total: number;
  tone: "critical" | "high" | "medium" | "low";
}) {
  const dot = RISK_DOT[tone];
  const fill =
    tone === "critical"
      ? "bg-[color:var(--risk)]"
      : tone === "high"
        ? "bg-[color:var(--risk)]/75"
        : tone === "medium"
          ? "bg-[color:var(--warning)]"
          : "bg-muted-foreground/40";
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className={`sg-dot ${dot}`} />
          {label}
        </span>
        <span className="sg-mono-sm text-muted-foreground">{count}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${fill} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
