"use client";

import { ChangeEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  RefreshCw,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { manualInventoryCsvPath } from "@/lib/ai-governance/assessment-kit";
import type {
  AISystemImportPreviewStatus,
  AISystemImportSummary,
} from "@/lib/ai-governance/csv-import";
import { cn } from "@/lib/utils";

type ImportRow = {
  rowNumber: number;
  status: AISystemImportPreviewStatus;
  errors: string[];
  warnings: string[];
  duplicateOf?: {
    source: "existing" | "import";
    id?: string;
    name: string;
  };
  payload: {
    name: string;
    ownerName: string;
    department: string;
    vendorName: string;
    useCase: string;
    dataSensitivity: string;
    approvalStatus: string;
    nextReviewDate: string;
  };
};

type ImportResponse = {
  success?: boolean;
  dryRun?: boolean;
  error?: string;
  message?: string;
  globalErrors?: string[];
  rows?: ImportRow[];
  summary?: AISystemImportSummary;
  createdSystems?: Array<{ id: string; name: string }>;
};

const statusClass: Record<AISystemImportPreviewStatus, string> = {
  ready: "border-blue-200 bg-blue-50 text-blue-700",
  duplicate: "border-amber-200 bg-amber-50 text-amber-700",
  error: "border-red-200 bg-red-50 text-red-700",
  created: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function emptySummary(): AISystemImportSummary {
  return {
    totalRows: 0,
    readyRows: 0,
    duplicateRows: 0,
    errorRows: 0,
    createdRows: 0,
    skippedRows: 0,
  };
}

export default function AISystemImportPage() {
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<ImportResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);

  const summary = preview?.summary ?? emptySummary();
  const canPreview = csvText.trim().length > 0 && !loadingPreview && !importing;
  const canImport =
    Boolean(preview) &&
    summary.readyRows > 0 &&
    (preview?.globalErrors?.length ?? 0) === 0 &&
    !loadingPreview &&
    !importing;

  const resultText = useMemo(() => {
    if (!preview) return "";
    if (summary.createdRows > 0) {
      return `${summary.createdRows} created, ${summary.skippedRows} skipped.`;
    }
    if (summary.readyRows > 0) {
      return `${summary.readyRows} ready, ${summary.skippedRows} skipped.`;
    }
    return `${summary.skippedRows} skipped.`;
  }, [preview, summary.createdRows, summary.readyRows, summary.skippedRows]);

  function resetForNewCsv(nextValue: string) {
    setCsvText(nextValue);
    setPreview(null);
    setError("");
    setMfaRequired(false);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    resetForNewCsv(await file.text());
  }

  async function submitImport(dryRun: boolean) {
    setError("");
    setMfaRequired(false);
    if (dryRun) setLoadingPreview(true);
    else setImporting(true);

    try {
      const response = await fetch("/api/ai-systems/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csvText, dryRun }),
      });
      const data = (await response.json()) as ImportResponse;

      if (!response.ok) {
        if (data.error === "mfa_required") setMfaRequired(true);
        setError(data.message ?? "Import request failed.");
        return;
      }

      setPreview(data);
    } catch {
      setError("Import request failed.");
    } finally {
      setLoadingPreview(false);
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/ai-systems"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        AI Systems
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Import AI Inventory</h2>
          <p className="text-sm text-slate-500">
            Preview the manual inventory CSV before creating AI System records.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={manualInventoryCsvPath}
            className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
          >
            <FileSpreadsheet className="h-4 w-4" />
            CSV Template
          </Link>
          <Link
            href="/dashboard/assessment-kit"
            className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
          >
            <ClipboardCheck className="h-4 w-4" />
            Assessment Kit
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Upload className="h-4 w-4 text-slate-600" />
              CSV Source
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-slate-200 p-4">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFile}
                className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
              />
            </div>

            <textarea
              value={csvText}
              onChange={(event) => resetForNewCsv(event.target.value)}
              placeholder="Paste CSV rows here..."
              className="min-h-64 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-3 font-mono text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!canPreview}
                onClick={() => submitImport(true)}
              >
                {loadingPreview ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                )}
                Preview Rows
              </Button>
              <Button type="button" disabled={!canImport} onClick={() => submitImport(false)}>
                {importing ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Import Ready Rows
              </Button>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {mfaRequired && (
              <Link
                href={`/login/mfa?next=${encodeURIComponent("/dashboard/ai-systems/import")}`}
                className="inline-flex text-sm font-medium text-slate-900 underline"
              >
                Verify MFA to continue
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Import Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Rows" value={summary.totalRows} />
              <Metric label="Ready" value={summary.readyRows} />
              <Metric label="Created" value={summary.createdRows} />
              <Metric label="Skipped" value={summary.skippedRows} />
            </div>
            {preview && (
              <div className="rounded-lg border border-slate-200 px-4 py-3">
                <p className="text-sm font-medium text-slate-900">{resultText}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Duplicates: {summary.duplicateRows} · Errors: {summary.errorRows}
                </p>
              </div>
            )}
            {summary.createdRows > 0 && (
              <Link
                href="/dashboard/ai-systems"
                className={cn(buttonVariants({ variant: "default" }), "w-full")}
              >
                View AI Systems
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {preview?.globalErrors?.map((globalError) => (
        <div
          key={globalError}
          className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{globalError}</span>
        </div>
      ))}

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Preview</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(preview.rows?.length ?? 0) === 0 ? (
              <div className="py-14 text-center text-sm text-slate-500">No rows to preview.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>System</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Messages</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows?.map((row) => (
                    <TableRow key={row.rowNumber}>
                      <TableCell className="text-sm text-slate-500">{row.rowNumber}</TableCell>
                      <TableCell>
                        <Badge className={statusClass[row.status]}>{humanize(row.status)}</Badge>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-slate-900">
                          {row.payload.name || "Missing system name"}
                        </p>
                        <p className="max-w-md truncate text-xs text-slate-500">
                          {row.payload.useCase || "Missing use case"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-slate-700">
                          {row.payload.ownerName || "Unassigned"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {row.payload.department || "No department"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-slate-700">
                          {humanize(row.payload.dataSensitivity)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {humanize(row.payload.approvalStatus)}
                        </p>
                        <p className="text-xs text-slate-400">
                          Review: {row.payload.nextReviewDate || "Not set"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <RowMessages row={row} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 px-4 py-3">
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function RowMessages({ row }: { row: ImportRow }) {
  const messages = [
    ...row.errors,
    ...row.warnings,
    row.duplicateOf ? `Duplicate of ${row.duplicateOf.name}` : "",
  ].filter(Boolean);

  if (messages.length === 0) {
    return <span className="text-sm text-slate-500">Ready to import</span>;
  }

  return (
    <ul className="space-y-1">
      {messages.map((message) => (
        <li key={message} className="max-w-md text-sm text-slate-600">
          {message}
        </li>
      ))}
    </ul>
  );
}
