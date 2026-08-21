"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AppWindow,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  FilePlus2,
  KeyRound,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRiskColor } from "@/lib/risk-scoring";

type Provider = "google" | "microsoft";

type RevocationResult = {
  success?: boolean;
  appId?: string;
  appName?: string;
  provider?: Provider;
  result?: string;
  error?: string;
  message?: string;
  rescanRecommended?: boolean;
  targetCount?: number;
  revokedTargetCount?: number;
  alreadyRevokedTargetCount?: number;
  providerErrorCategory?: string | null;
  newStatus?: App["status"];
};

interface App {
  id: string;
  appName: string;
  category: string;
  isAITool: boolean;
  riskScore: number;
  riskLevel: "critical" | "high" | "medium" | "low";
  riskFactors: string[];
  permissions: string[];
  connectedUsers: string[];
  sourcePlatforms: Provider[];
  oauthRevocation: {
    targetCounts: Record<Provider, number>;
    lastResult: unknown | null;
  };
  lastActive: string;
  status: "active" | "blocked" | "approved" | "pending";
  securityInfo: {
    hasSOC2: boolean;
    hasGDPR: boolean;
    hasHIPAA: boolean;
    dataResidency: string;
  };
}

export default function AppsPage() {
  const router = useRouter();
  const [apps, setApps] = useState<App[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ai_only");
  const [loading, setLoading] = useState(true);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<{
    app: App;
    provider: Provider;
  } | null>(null);
  const [revokingKey, setRevokingKey] = useState<string | null>(null);
  const [revokeResult, setRevokeResult] = useState<RevocationResult | null>(null);

  const loadApps = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter) params.set("filter", filter);

      const response = await fetch(`/api/apps?${params}`);
      const data = await response.json();
      setApps(data.apps || []);
    } catch (error) {
      console.error("Failed to load apps:", error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    async function run() {
      await loadApps();
    }
    void run();
  }, [loadApps]);

  useEffect(() => {
    async function loadRole() {
      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();
        setUserRole(data.role ?? null);
      } catch {
        setUserRole(null);
      }
    }
    void loadRole();
  }, []);

  const filteredApps = useMemo(() => {
    let filtered = [...apps];

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.appName.toLowerCase().includes(searchLower) ||
          a.category.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [apps, search]);

  async function handleAction(appId: string, action: string) {
    try {
      await fetch(`/api/apps/${appId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      // Update local state
      setApps((prev) =>
        prev.map((a) => {
          if (a.id === appId) {
            const statusMap: Record<string, App["status"]> = {
              approve: "approved",
              block: "blocked",
              revoke: "blocked",
              pending: "pending",
            };
            return { ...a, status: statusMap[action] || a.status };
          }
          return a;
        })
      );
    } catch (error) {
      console.error("Action failed:", error);
    }
  }

  async function convertToAISystem(appId: string) {
    setConvertingId(appId);
    try {
      const response = await fetch("/api/ai-systems/from-connected-app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectedAppId: appId }),
      });
      const data = await response.json();
      if (response.ok && data.system?.id) {
        router.push(`/dashboard/ai-systems/${data.system.id}`);
      }
    } catch (error) {
      console.error("AI system conversion failed:", error);
    } finally {
      setConvertingId(null);
    }
  }

  async function revokeOAuth(app: App, provider: Provider) {
    const key = `${app.id}:${provider}`;
    setRevokingKey(key);
    setRevokeResult(null);
    try {
      const response = await fetch(`/api/apps/${app.id}/revoke-oauth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = (await response.json()) as RevocationResult;
      setRevokeResult(data);
      if (response.ok && data.newStatus) {
        setApps((prev) =>
          prev.map((candidate) =>
            candidate.id === app.id
              ? { ...candidate, status: data.newStatus ?? candidate.status }
              : candidate
          )
        );
      }
    } catch {
      setRevokeResult({
        result: "request_failed",
        message: "The revocation request could not be completed.",
      });
    } finally {
      setRevokingKey(null);
    }
  }

  const canRevoke = userRole === "admin" || userRole === "manager";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Applications</h2>
          <p className="text-sm text-slate-500">
            {filteredApps.length} applications detected
          </p>
        </div>
        <Button render={<Link href="/dashboard" />} nativeButton={false} variant="outline">
          Run New Scan
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search by name or category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant={filter === "ai_only" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("ai_only")}
              >
                AI Tools Only
              </Button>
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
              >
                All Apps
              </Button>
              <Button
                variant={filter === "critical" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("critical")}
                className={filter === "critical" ? "bg-red-600 hover:bg-red-700" : ""}
              >
                Critical
              </Button>
              <Button
                variant={filter === "high" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("high")}
                className={filter === "high" ? "bg-orange-600 hover:bg-orange-700" : ""}
              >
                High
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Apps Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-slate-500">Loading applications...</div>
          ) : filteredApps.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              No applications found. Run a scan first from the{" "}
              <Link href="/dashboard" className="text-slate-900 underline">
                dashboard
              </Link>.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Application</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Risk Score</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Security</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApps.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                          <AppWindow className="h-4 w-4 text-slate-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{app.appName}</p>
                          <p className="text-xs text-slate-500">
                            {app.permissions.slice(0, 2).join(", ")}
                            {app.permissions.length > 2 && ` +${app.permissions.length - 2} more`}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-600">{app.category}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={getRiskColor(app.riskLevel)}>
                        {app.riskLevel} — {app.riskScore}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-600">
                        {app.connectedUsers.length}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {app.securityInfo.hasSOC2 && (
                          <Badge variant="outline" className="text-xs">
                            <ShieldCheck className="mr-1 h-3 w-3" /> SOC 2
                          </Badge>
                        )}
                        {app.securityInfo.hasGDPR && (
                          <Badge variant="outline" className="text-xs">GDPR</Badge>
                        )}
                        {app.securityInfo.hasHIPAA && (
                          <Badge variant="outline" className="text-xs">HIPAA</Badge>
                        )}
                        {!app.securityInfo.hasSOC2 &&
                          !app.securityInfo.hasGDPR &&
                          !app.securityInfo.hasHIPAA && (
                            <Badge variant="outline" className="text-xs text-red-600">
                              <ShieldAlert className="mr-1 h-3 w-3" /> None
                            </Badge>
                          )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={app.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => convertToAISystem(app.id)}
                          disabled={convertingId === app.id}
                        >
                          <FilePlus2 className="mr-1 h-4 w-4" />
                          {convertingId === app.id ? "Adding..." : "Add to AI Systems"}
                        </Button>
                        {app.status !== "approved" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAction(app.id, "approve")}
                            className="text-emerald-600 hover:text-emerald-700"
                          >
                            <CheckCircle2 className="mr-1 h-4 w-4" />
                            Approve
                          </Button>
                        )}
                        {app.status !== "blocked" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAction(app.id, "block")}
                            className="text-red-600 hover:text-red-700"
                          >
                            <XCircle className="mr-1 h-4 w-4" />
                            Block
                          </Button>
                        )}
                        {canRevoke &&
                          app.status !== "blocked" &&
                          (app.sourcePlatforms ?? []).map((provider) => (
                            <Button
                              key={provider}
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setRevokeTarget({ app, provider });
                                setRevokeResult(null);
                              }}
                              className="text-amber-700 hover:text-amber-800"
                            >
                              <KeyRound className="mr-1 h-4 w-4" />
                              Revoke {providerLabel(provider)}
                            </Button>
                          ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Risk Factors Detail */}
      {filteredApps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Risk Factors Detail</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredApps.slice(0, 10).map((app) => (
                <div key={app.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-900">{app.appName}</p>
                    <Badge className={getRiskColor(app.riskLevel)}>
                      {app.riskScore}/100
                    </Badge>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {app.riskFactors.map((factor, i) => (
                      <li key={i} className="text-sm text-slate-600">
                        · {factor}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRevokeTarget(null);
            setRevokeResult(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Revoke OAuth access</DialogTitle>
            <DialogDescription>
              {revokeTarget
                ? `${providerLabel(revokeTarget.provider)} access for ${revokeTarget.app.appName} will be revoked at the provider when ShadowGuard has a recorded grant target. Users may need to reconnect the app after this action.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {revokeTarget && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 p-3">
                <div>
                  <p className="text-xs text-slate-500">Provider</p>
                  <p className="font-medium text-slate-900">
                    {providerLabel(revokeTarget.provider)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Users</p>
                  <p className="font-medium text-slate-900">
                    {revokeTarget.app.connectedUsers.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Grant targets</p>
                  <p className="font-medium text-slate-900">
                    {revokeTarget.app.oauthRevocation.targetCounts[
                      revokeTarget.provider
                    ] ?? 0}
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                This removes provider-side OAuth authorization where supported.
                ShadowGuard will not mark this as revoked unless the provider
                succeeds or confirms the grant is already gone.
              </div>
              {revokeResult && (
                <div
                  className={
                    revokeResult.success
                      ? "rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800"
                      : "rounded-lg border border-red-200 bg-red-50 p-3 text-red-800"
                  }
                >
                  <p className="font-medium">
                    {revokeResult.result ?? revokeResult.error ?? "Result"}
                  </p>
                  <p className="mt-1">{revokeResult.message}</p>
                  {revokeResult.rescanRecommended && (
                    <p className="mt-2 text-xs">
                      Rescan recommended to refresh provider state.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRevokeTarget(null);
                setRevokeResult(null);
              }}
            >
              Close
            </Button>
            {revokeTarget && (
              <Button
                onClick={() => revokeOAuth(revokeTarget.app, revokeTarget.provider)}
                disabled={
                  revokingKey === `${revokeTarget.app.id}:${revokeTarget.provider}`
                }
                className="bg-amber-600 hover:bg-amber-700"
              >
                {revokingKey === `${revokeTarget.app.id}:${revokeTarget.provider}` ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="mr-1 h-4 w-4" />
                )}
                Revoke {providerLabel(revokeTarget.provider)}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function providerLabel(provider: Provider) {
  return provider === "google" ? "Google" : "Microsoft";
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "approved":
      return (
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
          <CheckCircle2 className="mr-1 h-3 w-3" /> Approved
        </Badge>
      );
    case "blocked":
      return (
        <Badge className="bg-red-50 text-red-700 border-red-200">
          <XCircle className="mr-1 h-3 w-3" /> Blocked
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-amber-50 text-amber-700 border-amber-200">
          <Clock className="mr-1 h-3 w-3" /> Pending
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          Active
        </Badge>
      );
  }
}
