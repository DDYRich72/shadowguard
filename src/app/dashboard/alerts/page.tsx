"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Clock,
  ArrowRight,
  FileText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Alert = {
  id: string;
  type: "new_app" | "risk_threshold" | "bulk_adoption" | "policy_violation";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  message: string;
  app_name: string | null;
  acknowledged: boolean;
  created_at: string;
};

type GovernanceReportAlert = {
  id: string;
  type:
    | "overdue_remediation"
    | "due_soon_remediation"
    | "needs_review"
    | "changes_requested"
    | "ready_to_finalize";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  message: string;
  snapshotId: string;
  snapshotTitle: string;
  actionHref: string;
  dueDate: string | null;
  owner: string | null;
  createdAt: string;
};

type GovernanceReportAlertState = {
  alerts: GovernanceReportAlert[];
  remediationWarning: string;
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [governanceAlerts, setGovernanceAlerts] =
    useState<GovernanceReportAlertState>({
      alerts: [],
      remediationWarning: "",
    });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [alertsResult, governanceResult] = await Promise.allSettled([
      fetch("/api/alerts"),
      fetch("/api/governance/report-alerts"),
    ]);

    if (alertsResult.status === "fulfilled" && alertsResult.value.ok) {
      const data = await alertsResult.value.json();
      setAlerts(data.alerts ?? []);
    }

    if (governanceResult.status === "fulfilled" && governanceResult.value.ok) {
      const data = await governanceResult.value.json();
      setGovernanceAlerts({
        alerts: data.alerts ?? [],
        remediationWarning: data.remediationWarning ?? "",
      });
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const unacknowledged = alerts.filter((a) => !a.acknowledged);
  const acknowledged = alerts.filter((a) => a.acknowledged);
  const totalAttention = unacknowledged.length + governanceAlerts.alerts.length;

  async function acknowledgeAlert(id: string) {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
    );
    await fetch("/api/alerts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, acknowledged: true }),
    });
  }

  async function acknowledgeAll() {
    const pending = unacknowledged.map((a) => a.id);
    setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })));
    await Promise.all(
      pending.map((id) =>
        fetch("/api/alerts", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, acknowledged: true }),
        })
      )
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Alerts</h2>
          <p className="text-sm text-slate-500">
            {totalAttention} internal alert{totalAttention !== 1 ? "s" : ""} need attention
          </p>
        </div>
        {unacknowledged.length > 0 && (
          <Button variant="outline" onClick={acknowledgeAll}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Acknowledge All
          </Button>
        )}
      </div>

      {governanceAlerts.remediationWarning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {governanceAlerts.remediationWarning}
        </div>
      )}

      {governanceAlerts.alerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              Governance Reports
            </h3>
            <Button
              render={<Link href="/dashboard/report-review-queue" />}
              nativeButton={false}
              variant="outline"
              size="sm"
            >
              Review Queue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          {governanceAlerts.alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={{
                id: alert.id,
                severity: alert.severity,
                title: alert.title,
                message: [
                  alert.message,
                  alert.dueDate ? `Due ${formatDateOnly(alert.dueDate)}.` : "",
                  alert.owner ? `Owner: ${alert.owner}.` : "",
                ]
                  .filter(Boolean)
                  .join(" "),
                appName: alert.snapshotTitle,
                createdAt: alert.createdAt,
                actionHref: alert.actionHref,
                actionLabel: "Open Snapshot",
              }}
              onAcknowledge={() => {}}
              actionOnly
            />
          ))}
        </div>
      )}

      {/* Unacknowledged Alerts */}
      {unacknowledged.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Requires Attention
          </h3>
          {unacknowledged.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={{
                id: alert.id,
                severity: alert.severity,
                title: alert.title,
                message: alert.message,
                appName: alert.app_name ?? "",
                createdAt: alert.created_at,
              }}
              onAcknowledge={() => acknowledgeAlert(alert.id)}
            />
          ))}
        </div>
      )}

      {acknowledged.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
            Acknowledged
          </h3>
          {acknowledged.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={{
                id: alert.id,
                severity: alert.severity,
                title: alert.title,
                message: alert.message,
                appName: alert.app_name ?? "",
                createdAt: alert.created_at,
              }}
              onAcknowledge={() => {}}
              acknowledged
            />
          ))}
        </div>
      )}

      {!loading && alerts.length === 0 && governanceAlerts.alerts.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Bell className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-lg font-medium text-slate-600">No alerts yet</p>
            <p className="mt-1 text-sm text-slate-400">
              Run a scan to start monitoring your organization for shadow AI.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AlertCard({
  alert,
  onAcknowledge,
  acknowledged = false,
  actionOnly = false,
}: {
  alert: {
    id: string;
    severity: "critical" | "high" | "medium" | "low";
    title: string;
    message: string;
    appName: string;
    createdAt: string;
    actionHref?: string;
    actionLabel?: string;
  };
  onAcknowledge: () => void;
  acknowledged?: boolean;
  actionOnly?: boolean;
}) {
  const severityConfig = {
    critical: {
      icon: AlertCircle,
      color: "border-red-200 bg-red-50",
      iconColor: "text-red-600",
      badge: "bg-red-100 text-red-700",
    },
    high: {
      icon: AlertTriangle,
      color: "border-orange-200 bg-orange-50",
      iconColor: "text-orange-600",
      badge: "bg-orange-100 text-orange-700",
    },
    medium: {
      icon: Info,
      color: "border-amber-200 bg-amber-50",
      iconColor: "text-amber-600",
      badge: "bg-amber-100 text-amber-700",
    },
    low: {
      icon: Info,
      color: "border-slate-200 bg-slate-50",
      iconColor: "text-slate-600",
      badge: "bg-slate-100 text-slate-600",
    },
  };

  const config = severityConfig[alert.severity];
  const Icon = config.icon;

  return (
    <Card className={`${config.color} ${acknowledged ? "opacity-60" : ""}`}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          {actionOnly ? (
            <FileText className={`h-5 w-5 ${config.iconColor} mt-0.5 shrink-0`} />
          ) : (
            <Icon className={`h-5 w-5 ${config.iconColor} mt-0.5 shrink-0`} />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-slate-900">{alert.title}</p>
              <Badge className={config.badge}>{alert.severity}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-600">{alert.message}</p>
            <div className="mt-3 flex items-center gap-4">
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Clock className="h-3 w-3" />
                {timeAgo(alert.createdAt)}
              </span>
              {alert.actionHref && (
                <Button
                  render={<Link href={alert.actionHref} />}
                  nativeButton={false}
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                >
                  {alert.actionLabel ?? "Open"}
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              )}
              {!acknowledged && !actionOnly && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onAcknowledge}
                  className="text-xs"
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Acknowledge
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDateOnly(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;

  return `${month}/${day}/${year}`;
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
