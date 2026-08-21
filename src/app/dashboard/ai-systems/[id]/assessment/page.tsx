"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ClipboardCheck, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AIDataSensitivity,
  AIGovernanceRiskTier,
  RecommendedControl,
} from "@/lib/ai-governance/types";

type AssessmentForm = {
  dataSensitivity: AIDataSensitivity;
  processesPersonalData: boolean;
  processesCustomerData: boolean;
  processesEmployeeData: boolean;
  regulatedDecisionArea:
    | "none"
    | "hiring"
    | "credit"
    | "insurance"
    | "healthcare"
    | "legal"
    | "financial"
    | "other";
  customerFacing: boolean;
  employeeFacing: boolean;
  autonomousActions: boolean;
  humanReviewRequired: boolean;
  vendorApproved: boolean;
  hasSoc2: boolean;
  hasDpa: boolean;
  loggingEnabled: boolean;
  businessCriticality: "low" | "medium" | "high";
  usesDataForTraining: boolean;
};

type AssessmentResult = {
  overallScore: number;
  riskTier: AIGovernanceRiskTier;
  summary: string;
  recommendedControls: RecommendedControl[];
  dataRiskScore: number;
  securityRiskScore: number;
  regulatoryRiskScore: number;
  businessImpactScore: number;
};

const riskClass: Record<AIGovernanceRiskTier, string> = {
  critical: "bg-red-50 text-red-700 border-red-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AISystemAssessmentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [systemName, setSystemName] = useState("AI System");
  const [form, setForm] = useState<AssessmentForm>({
    dataSensitivity: "internal",
    processesPersonalData: false,
    processesCustomerData: false,
    processesEmployeeData: false,
    regulatedDecisionArea: "none",
    customerFacing: false,
    employeeFacing: true,
    autonomousActions: false,
    humanReviewRequired: true,
    vendorApproved: false,
    hasSoc2: false,
    hasDpa: false,
    loggingEnabled: false,
    businessCriticality: "medium",
    usesDataForTraining: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);

  useEffect(() => {
    async function loadSystem() {
      const response = await fetch(`/api/ai-systems/${params.id}`);
      if (!response.ok) return;
      const data = await response.json();
      const system = data.system;
      setSystemName(system.name);
      setForm((prev) => ({
        ...prev,
        dataSensitivity: system.data_sensitivity ?? prev.dataSensitivity,
        customerFacing: system.customer_facing ?? prev.customerFacing,
        employeeFacing: system.employee_facing ?? prev.employeeFacing,
        autonomousActions: system.automated_decisions ?? prev.autonomousActions,
        humanReviewRequired: system.human_review_required ?? prev.humanReviewRequired,
      }));
    }
    loadSystem();
  }, [params.id]);

  function setField<K extends keyof AssessmentForm>(key: K, value: AssessmentForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/ai-systems/${params.id}/assessments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, status: "completed" }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? data.error ?? "Unable to save assessment.");
        return;
      }
      setResult(data.result);
      router.refresh();
    } catch {
      setError("Unable to save assessment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/ai-systems/${params.id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
      >
        <ChevronLeft className="h-4 w-4" />
        {systemName}
      </Link>

      <div>
        <h2 className="text-xl font-bold text-slate-900">Risk Assessment</h2>
        <p className="text-sm text-slate-500">
          Score the AI use case and generate required controls.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Data And Impact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Data Sensitivity
                  <select
                    value={form.dataSensitivity}
                    onChange={(e) => setField("dataSensitivity", e.target.value as AIDataSensitivity)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="public">Public</option>
                    <option value="internal">Internal</option>
                    <option value="confidential">Confidential</option>
                    <option value="restricted">Restricted</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Business Criticality
                  <select
                    value={form.businessCriticality}
                    onChange={(e) =>
                      setField("businessCriticality", e.target.value as AssessmentForm["businessCriticality"])
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Toggle label="Processes personal data" checked={form.processesPersonalData} onChange={(v) => setField("processesPersonalData", v)} />
                <Toggle label="Processes customer data" checked={form.processesCustomerData} onChange={(v) => setField("processesCustomerData", v)} />
                <Toggle label="Processes employee data" checked={form.processesEmployeeData} onChange={(v) => setField("processesEmployeeData", v)} />
                <Toggle label="Customer-facing" checked={form.customerFacing} onChange={(v) => setField("customerFacing", v)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Governance And Vendor Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Regulated Decision Area
                <select
                  value={form.regulatedDecisionArea}
                  onChange={(e) =>
                    setField("regulatedDecisionArea", e.target.value as AssessmentForm["regulatedDecisionArea"])
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="none">None</option>
                  <option value="hiring">Hiring</option>
                  <option value="credit">Credit</option>
                  <option value="insurance">Insurance</option>
                  <option value="healthcare">Healthcare</option>
                  <option value="legal">Legal</option>
                  <option value="financial">Financial</option>
                  <option value="other">Other regulated area</option>
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Toggle label="Can take autonomous actions" checked={form.autonomousActions} onChange={(v) => setField("autonomousActions", v)} />
                <Toggle label="Human review required" checked={form.humanReviewRequired} onChange={(v) => setField("humanReviewRequired", v)} />
                <Toggle label="Vendor approved" checked={form.vendorApproved} onChange={(v) => setField("vendorApproved", v)} />
                <Toggle label="SOC 2 reviewed" checked={form.hasSoc2} onChange={(v) => setField("hasSoc2", v)} />
                <Toggle label="DPA reviewed" checked={form.hasDpa} onChange={(v) => setField("hasDpa", v)} />
                <Toggle label="Usage logging enabled" checked={form.loggingEnabled} onChange={(v) => setField("loggingEnabled", v)} />
                <Toggle label="Employee-facing" checked={form.employeeFacing} onChange={(v) => setField("employeeFacing", v)} />
                <Toggle label="Data can train vendor models" checked={form.usesDataForTraining} onChange={(v) => setField("usesDataForTraining", v)} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Assessment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={submit} disabled={saving} className="w-full">
                <Save className="mr-1 h-4 w-4" />
                {saving ? "Saving..." : "Complete Assessment"}
              </Button>
              {result && (
                <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">Risk Tier</span>
                    <Badge className={riskClass[result.riskTier]}>
                      {humanize(result.riskTier)}
                    </Badge>
                  </div>
                  <div className="text-2xl font-semibold text-slate-900">
                    {result.overallScore}/100
                  </div>
                  <p className="text-sm text-slate-600">{result.summary}</p>
                  <Button
                    render={<Link href={`/dashboard/ai-systems/${params.id}`} />}
                    nativeButton={false}
                    variant="outline"
                    className="w-full"
                  >
                    <ClipboardCheck className="mr-1 h-4 w-4" />
                    View System
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {result && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Recommended Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.recommendedControls.map((control) => (
                  <div key={control.key} className="rounded-lg border border-slate-200 p-3">
                    <p className="text-sm font-medium text-slate-900">{control.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{control.reason}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded"
      />
    </label>
  );
}
