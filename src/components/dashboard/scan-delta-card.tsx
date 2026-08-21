"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  KeyRound,
  Plus,
  Users,
} from "lucide-react";
import type { ScanDelta } from "@/lib/ai-governance/scan-delta";

type DeltaResponse = {
  from?: { scanId: string; scannedAt: string };
  to?: { scanId: string; scannedAt: string };
  delta: ScanDelta | null;
  reason?: string;
  error?: string;
};

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "insufficient" }
  | { kind: "ready"; data: DeltaResponse & { delta: ScanDelta } };

/**
 * "What changed since last scan" panel. Renders nothing while the org
 * has fewer than two scans recorded — the delta story starts at scan #2.
 */
export function ScanDeltaCard({ refreshKey = 0 }: { refreshKey?: number }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setState({ kind: "loading" });
        const response = await fetch("/api/scan/delta");
        if (!active) return;
        if (!response.ok) {
          setState({ kind: "error" });
          return;
        }
        const data = (await response.json()) as DeltaResponse;
        if (!active) return;
        if (!data.delta) {
          setState({ kind: "insufficient" });
          return;
        }
        setState({ kind: "ready", data: data as DeltaResponse & { delta: ScanDelta } });
      } catch {
        if (active) setState({ kind: "error" });
      }
    })();

    return () => {
      active = false;
    };
  }, [refreshKey]);

  // Fewer than two scans: stay out of the way entirely.
  if (state.kind === "insufficient") return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-px w-6 bg-[color:var(--brand)]" />
            <p className="sg-mono text-[color:var(--brand)]">Scan delta</p>
          </div>
          <h3 className="font-display mt-2 text-lg font-semibold tracking-tight text-foreground">
            What changed since your last scan
          </h3>
        </div>
        {state.kind === "ready" && (
          <span className="sg-mono-sm text-muted-foreground">
            {new Date(state.data.from!.scannedAt).toLocaleDateString()} →{" "}
            {new Date(state.data.to!.scannedAt).toLocaleDateString()}
          </span>
        )}
      </header>

      {state.kind === "loading" && (
        <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card px-5 py-4">
              <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
              <div className="mt-3 h-7 w-12 animate-pulse rounded bg-muted" />
              <div className="mt-1.5 h-3 w-20 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {state.kind === "error" && (
        <div className="flex items-start gap-3 p-6 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--warning-ink)]" />
          Couldn&apos;t load scan changes right now. Refresh to try again.
        </div>
      )}

      {state.kind === "ready" && <DeltaBody delta={state.data.delta} />}
    </section>
  );
}

function DeltaBody({ delta }: { delta: ScanDelta }) {
  const s = delta.summary;
  const noChanges =
    s.newApps === 0 &&
    s.removedApps === 0 &&
    s.riskIncreased === 0 &&
    s.riskDecreased === 0 &&
    s.scopeExpansions === 0 &&
    s.netUserChange === 0;

  if (noChanges) {
    return (
      <div className="flex items-center gap-3 p-6 text-sm text-foreground/85">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-[color:var(--approved)]" />
        No changes since your last scan — no new AI tools, risk movement, or
        permission expansions detected.
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
        <DeltaStat
          icon={<Plus className="h-4 w-4" />}
          label="New AI tools"
          value={s.newAiTools}
          tone={s.newAiTools > 0 ? "risk" : "neutral"}
        />
        <DeltaStat
          icon={<ArrowUpRight className="h-4 w-4" />}
          label="Risk increased"
          value={s.riskIncreased}
          tone={s.riskIncreased > 0 ? "warning" : "neutral"}
        />
        <DeltaStat
          icon={<KeyRound className="h-4 w-4" />}
          label="Scope expansions"
          value={s.scopeExpansions}
          tone={s.scopeExpansions > 0 ? "warning" : "neutral"}
        />
        <DeltaStat
          icon={<Users className="h-4 w-4" />}
          label="Net user change"
          value={s.netUserChange}
          signed
          tone={s.netUserChange > 0 ? "brand" : "neutral"}
        />
      </div>

      {(delta.newApps.length > 0 ||
        delta.riskIncreases.length > 0 ||
        delta.scopeAdditions.length > 0) && (
        <div className="space-y-1.5 border-t border-border px-6 py-4">
          {delta.newApps.slice(0, 3).map((a) => (
            <DeltaLine key={`new-${a.canonicalName}`}>
              <Plus className="h-3.5 w-3.5 text-[color:var(--risk)]" />
              <span className="font-semibold text-foreground">{a.appName}</span>{" "}
              {a.isAiTool ? "is a newly detected AI tool" : "newly detected"} ·{" "}
              {a.userCount} user{a.userCount !== 1 ? "s" : ""} · {a.riskLevel} risk
            </DeltaLine>
          ))}
          {delta.riskIncreases.slice(0, 3).map((r) => (
            <DeltaLine key={`risk-${r.app.canonicalName}`}>
              <ArrowUpRight className="h-3.5 w-3.5 text-[color:var(--warning-ink)]" />
              <span className="font-semibold text-foreground">{r.app.appName}</span>{" "}
              risk {r.previousScore} → {r.app.riskScore}
              {r.significant ? " (significant)" : ""}
            </DeltaLine>
          ))}
          {delta.scopeAdditions.slice(0, 3).map((sa) => (
            <DeltaLine key={`scope-${sa.app.canonicalName}`}>
              <KeyRound className="h-3.5 w-3.5 text-[color:var(--warning-ink)]" />
              <span className="font-semibold text-foreground">{sa.app.appName}</span>{" "}
              gained {sa.addedScopes.length} permission scope
              {sa.addedScopes.length !== 1 ? "s" : ""}
            </DeltaLine>
          ))}
          {delta.removedApps.length > 0 && (
            <DeltaLine>
              <ArrowDownRight className="h-3.5 w-3.5 text-muted-foreground" />
              {delta.removedApps.length} app
              {delta.removedApps.length !== 1 ? "s" : ""} no longer detected
            </DeltaLine>
          )}
        </div>
      )}
    </div>
  );
}

function DeltaLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function DeltaStat({
  icon,
  label,
  value,
  tone,
  signed = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "risk" | "warning" | "brand" | "neutral";
  signed?: boolean;
}) {
  const iconWrap = {
    risk: "bg-[color:var(--risk)]/12 text-[color:var(--risk)]",
    warning: "bg-[color:var(--warning)]/15 text-[color:var(--warning-ink)]",
    brand: "bg-[color:var(--brand)]/12 text-[color:var(--brand)]",
    neutral: "bg-muted text-muted-foreground",
  }[tone];
  return (
    <div className="bg-card px-5 py-4">
      <div className="flex items-center justify-between">
        <span className="sg-mono-sm text-muted-foreground">{label}</span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-md ${iconWrap}`}>
          {icon}
        </span>
      </div>
      <p className="font-display mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {signed && value > 0 ? `+${value}` : value}
      </p>
    </div>
  );
}
