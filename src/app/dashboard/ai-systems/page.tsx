"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Brain,
  Plus,
  Search,
  ShieldCheck,
  ShieldAlert,
  Archive,
  ClipboardCheck,
  Upload,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  AIDataSensitivity,
  AIGovernanceRiskTier,
  AISystemApprovalStatus,
} from "@/lib/ai-governance/types";
import { cn } from "@/lib/utils";

type AISystemRow = {
  id: string;
  name: string;
  owner_name: string | null;
  department: string | null;
  vendor_name: string | null;
  use_case: string;
  data_sensitivity: AIDataSensitivity;
  approval_status: AISystemApprovalStatus;
  risk_tier: AIGovernanceRiskTier;
  next_review_date: string | null;
  source: string;
  status: "active" | "archived";
  updated_at: string;
};

const riskClass: Record<AIGovernanceRiskTier, string> = {
  critical: "bg-red-50 text-red-700 border-red-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const approvalClass: Record<AISystemApprovalStatus, string> = {
  discovered: "bg-slate-50 text-slate-700 border-slate-200",
  under_review: "bg-blue-50 text-blue-700 border-blue-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  blocked: "bg-red-50 text-red-700 border-red-200",
  retired: "bg-slate-50 text-slate-500 border-slate-200",
};

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateOnly(value: string | null): string {
  if (!value) return "Not set";
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AISystemsPage() {
  const [systems, setSystems] = useState<AISystemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/ai-systems?status=active");
        const data = await response.json();
        setSystems(data.systems ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = search.toLowerCase().trim();
    return systems.filter((system) => {
      const matchesSearch =
        !needle ||
        system.name.toLowerCase().includes(needle) ||
        (system.vendor_name ?? "").toLowerCase().includes(needle) ||
        (system.department ?? "").toLowerCase().includes(needle) ||
        system.use_case.toLowerCase().includes(needle);
      const matchesRisk = !riskFilter || system.risk_tier === riskFilter;
      return matchesSearch && matchesRisk;
    });
  }, [systems, search, riskFilter]);

  const stats = useMemo(() => {
    return {
      total: systems.length,
      approved: systems.filter((s) => s.approval_status === "approved").length,
      review: systems.filter((s) => s.approval_status === "under_review").length,
      elevated: systems.filter((s) => s.risk_tier === "high" || s.risk_tier === "critical").length,
    };
  }, [systems]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">AI Systems</h2>
          <p className="text-sm text-slate-500">
            Governed AI use cases, owners, risk, and approval status.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/ai-systems/import"
            className={cn(buttonVariants({ variant: "outline" }), "gap-1")}
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </Link>
          <Link
            href="/dashboard/ai-systems/new"
            className={cn(buttonVariants({ variant: "default" }), "gap-1")}
          >
            <Plus className="h-4 w-4" />
            Add System
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Brain} label="Active systems" value={stats.total} />
        <StatCard icon={ShieldCheck} label="Approved" value={stats.approved} />
        <StatCard icon={ClipboardCheck} label="Under review" value={stats.review} />
        <StatCard icon={ShieldAlert} label="High risk" value={stats.elevated} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search systems, vendors, departments..."
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {["", "critical", "high", "medium", "low"].map((risk) => (
                <Button
                  key={risk || "all"}
                  variant={riskFilter === risk ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRiskFilter(risk)}
                >
                  {risk ? humanize(risk) : "All Risk"}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-sm text-slate-500">Loading AI systems...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Archive className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-700">No AI systems found</p>
              <p className="mt-1 text-sm text-slate-500">
                Add one manually, import a CSV, or convert a discovered app from Applications.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Link
                  href="/dashboard/ai-systems/import"
                  className={cn(buttonVariants({ variant: "outline" }), "gap-1")}
                >
                  <Upload className="h-4 w-4" />
                  Import CSV
                </Link>
                <Link
                  href="/dashboard/ai-systems/new"
                  className={cn(buttonVariants({ variant: "default" }), "gap-1")}
                >
                  <Plus className="h-4 w-4" />
                  Add System
                </Link>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>System</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((system) => (
                  <TableRow key={system.id}>
                    <TableCell>
                      <Link href={`/dashboard/ai-systems/${system.id}`} className="block">
                        <p className="font-medium text-slate-900 hover:underline">{system.name}</p>
                        <p className="max-w-md truncate text-xs text-slate-500">
                          {system.use_case}
                        </p>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-slate-700">{system.owner_name || "Unassigned"}</p>
                      <p className="text-xs text-slate-500">{system.department || "No department"}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{humanize(system.data_sensitivity)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={riskClass[system.risk_tier]}>
                        {humanize(system.risk_tier)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={approvalClass[system.approval_status]}>
                        {humanize(system.approval_status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-500">
                        {formatDateOnly(system.next_review_date)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-500">{humanize(system.source)}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Brain;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
          <Icon className="h-4 w-4 text-slate-700" />
        </div>
        <div>
          <p className="text-xl font-semibold text-slate-900">{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
