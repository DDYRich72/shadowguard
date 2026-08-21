"use client";

import { Network, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AGENT_GUARD_CONNECTOR_READINESS_COPY,
  agentGuardConnectorReadinessStatusCounts,
  groupAgentGuardConnectorReadinessCatalog,
  type AgentGuardConnectorReadinessStatus,
} from "@/lib/agent-guard/connector-readiness";

const STATUS_CLASSES: Record<AgentGuardConnectorReadinessStatus, string> = {
  ready_with_https_receiver: "border-green-200 bg-green-50 text-green-700",
  requires_customer_middleware: "border-amber-200 bg-amber-50 text-amber-800",
  future_native_connector: "border-slate-200 bg-slate-100 text-slate-600",
};

export function ConnectorReadinessPanel() {
  const groups = groupAgentGuardConnectorReadinessCatalog();
  const counts = agentGuardConnectorReadinessStatusCounts();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Network className="h-4 w-4 text-[color:var(--brand)]" />
          {AGENT_GUARD_CONNECTOR_READINESS_COPY.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm leading-6 text-muted-foreground">
            {AGENT_GUARD_CONNECTOR_READINESS_COPY.overview}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {AGENT_GUARD_CONNECTOR_READINESS_COPY.boundary}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
              {counts.ready_with_https_receiver} HTTPS-ready
            </Badge>
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
              {counts.requires_customer_middleware} middleware paths
            </Badge>
            <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-600">
              {counts.future_native_connector} native connectors
            </Badge>
          </div>
        </div>

        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.category} className="rounded-xl border border-border bg-background p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[color:var(--brand)]" />
                  <p className="text-sm font-semibold text-foreground">{group.label}</p>
                </div>
                <Badge variant="outline">{group.entries.length} path</Badge>
              </div>
              <div className="space-y-3">
                {group.entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {entry.label}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {entry.description}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={STATUS_CLASSES[entry.status]}
                      >
                        {entry.statusLabel}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Supported path
                        </p>
                        <p className="mt-1 text-xs leading-5 text-foreground">
                          {entry.supportedPath}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Customer requirement
                        </p>
                        <p className="mt-1 text-xs leading-5 text-foreground">
                          {entry.customerRequirement}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Evidence to prepare
                        </p>
                        <ul className="mt-1 space-y-1 text-xs leading-5 text-foreground">
                          {entry.evidenceToPrepare.map((item) => (
                            <li key={item} className="flex gap-2">
                              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[color:var(--brand)]" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <p className="mt-3 rounded-lg border border-border bg-background px-3 py-2 text-xs leading-5 text-muted-foreground">
                      {entry.boundary}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
