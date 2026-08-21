"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AIDataSensitivity,
  AISystemApprovalStatus,
  AITrainingDataUse,
} from "@/lib/ai-governance/types";

export type AISystemFormRecord = {
  id: string;
  name: string;
  description: string | null;
  owner_name: string | null;
  owner_email: string | null;
  department: string | null;
  vendor_name: string | null;
  model_name: string | null;
  use_case: string;
  business_process: string | null;
  data_types: string[] | null;
  data_sensitivity: AIDataSensitivity;
  customer_facing: boolean;
  employee_facing: boolean;
  automated_decisions: boolean;
  human_review_required: boolean;
  training_data_use: AITrainingDataUse;
  approval_status: AISystemApprovalStatus;
  next_review_date: string | null;
};

type FormState = {
  name: string;
  description: string;
  ownerName: string;
  ownerEmail: string;
  department: string;
  vendorName: string;
  modelName: string;
  useCase: string;
  businessProcess: string;
  dataTypes: string;
  dataSensitivity: AIDataSensitivity;
  customerFacing: boolean;
  employeeFacing: boolean;
  automatedDecisions: boolean;
  humanReviewRequired: boolean;
  trainingDataUse: AITrainingDataUse;
  approvalStatus: AISystemApprovalStatus;
  nextReviewDate: string;
};

function initialState(system?: AISystemFormRecord): FormState {
  return {
    name: system?.name ?? "",
    description: system?.description ?? "",
    ownerName: system?.owner_name ?? "",
    ownerEmail: system?.owner_email ?? "",
    department: system?.department ?? "",
    vendorName: system?.vendor_name ?? "",
    modelName: system?.model_name ?? "",
    useCase: system?.use_case ?? "",
    businessProcess: system?.business_process ?? "",
    dataTypes: (system?.data_types ?? []).join(", "),
    dataSensitivity: system?.data_sensitivity ?? "internal",
    customerFacing: system?.customer_facing ?? false,
    employeeFacing: system?.employee_facing ?? true,
    automatedDecisions: system?.automated_decisions ?? false,
    humanReviewRequired: system?.human_review_required ?? true,
    trainingDataUse: system?.training_data_use ?? "unknown",
    approvalStatus: system?.approval_status ?? "under_review",
    nextReviewDate: system?.next_review_date?.slice(0, 10) ?? "",
  };
}

function textInputClass() {
  return "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";
}

export function AISystemForm({
  mode,
  system,
  onSaved,
}: {
  mode: "create" | "edit";
  system?: AISystemFormRecord;
  onSaved?: (system: AISystemFormRecord) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [form, setForm] = useState<FormState>(() => initialState(system));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresMfa, setRequiresMfa] = useState(false);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    if (!form.name.trim() || !form.useCase.trim()) {
      setError("Name and use case are required.");
      return;
    }

    setSaving(true);
    setError(null);
    setRequiresMfa(false);
    const payload = {
      ...form,
      dataTypes: form.dataTypes
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };

    try {
      const response = await fetch(
        mode === "create" ? "/api/ai-systems" : `/api/ai-systems/${system?.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        if (data.error === "mfa_required") {
          setRequiresMfa(true);
        }
        setError(data.message ?? data.error ?? "Unable to save AI system.");
        return;
      }

      if (onSaved) onSaved(data.system);
      else router.push(`/dashboard/ai-systems/${data.system.id}`);
      router.refresh();
    } catch {
      setError("Unable to save AI system.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          {mode === "create" ? "New AI System" : "Edit AI System"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <span>{error}</span>
            {requiresMfa && (
              <Link
                href={`/login/mfa?next=${encodeURIComponent(pathname || "/dashboard/ai-systems")}`}
                className="shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
              >
                Verify MFA
              </Link>
            )}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Name
            <input
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              className={textInputClass()}
              placeholder="Customer support reply assistant"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Department
            <input
              value={form.department}
              onChange={(e) => setField("department", e.target.value)}
              className={textInputClass()}
              placeholder="Support Ops"
            />
          </label>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          Use Case
          <textarea
            value={form.useCase}
            onChange={(e) => setField("useCase", e.target.value)}
            className={`${textInputClass()} min-h-24`}
            placeholder="Draft customer support replies from approved ticket context."
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Description
          <textarea
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            className={`${textInputClass()} min-h-20`}
            placeholder="Short internal description."
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Owner Name
            <input
              value={form.ownerName}
              onChange={(e) => setField("ownerName", e.target.value)}
              className={textInputClass()}
              placeholder="Jane Smith"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Owner Email
            <input
              value={form.ownerEmail}
              onChange={(e) => setField("ownerEmail", e.target.value)}
              className={textInputClass()}
              placeholder="jane@example.com"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Vendor
            <input
              value={form.vendorName}
              onChange={(e) => setField("vendorName", e.target.value)}
              className={textInputClass()}
              placeholder="OpenAI"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Model / Product
            <input
              value={form.modelName}
              onChange={(e) => setField("modelName", e.target.value)}
              className={textInputClass()}
              placeholder="ChatGPT Enterprise"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Business Process
            <input
              value={form.businessProcess}
              onChange={(e) => setField("businessProcess", e.target.value)}
              className={textInputClass()}
              placeholder="Customer support"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Data Types
            <input
              value={form.dataTypes}
              onChange={(e) => setField("dataTypes", e.target.value)}
              className={textInputClass()}
              placeholder="Names, emails, ticket text"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-sm font-medium text-slate-700">
            Data Sensitivity
            <select
              value={form.dataSensitivity}
              onChange={(e) => setField("dataSensitivity", e.target.value as AIDataSensitivity)}
              className={textInputClass()}
            >
              <option value="public">Public</option>
              <option value="internal">Internal</option>
              <option value="confidential">Confidential</option>
              <option value="restricted">Restricted</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Approval Status
            <select
              value={form.approvalStatus}
              onChange={(e) => setField("approvalStatus", e.target.value as AISystemApprovalStatus)}
              className={textInputClass()}
            >
              <option value="discovered">Discovered</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="blocked">Blocked</option>
              <option value="retired">Retired</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Training Data Use
            <select
              value={form.trainingDataUse}
              onChange={(e) => setField("trainingDataUse", e.target.value as AITrainingDataUse)}
              className={textInputClass()}
            >
              <option value="unknown">Unknown</option>
              <option value="none">Not Used</option>
              <option value="opt_out">Opted Out</option>
              <option value="allowed">Allowed</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Next Review Date
            <input
              type="date"
              value={form.nextReviewDate}
              onChange={(e) => setField("nextReviewDate", e.target.value)}
              className={textInputClass()}
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Toggle
            label="Customer-facing"
            checked={form.customerFacing}
            onChange={(value) => setField("customerFacing", value)}
          />
          <Toggle
            label="Employee-facing"
            checked={form.employeeFacing}
            onChange={(value) => setField("employeeFacing", value)}
          />
          <Toggle
            label="Automated decisions"
            checked={form.automatedDecisions}
            onChange={(value) => setField("automatedDecisions", value)}
          />
          <Toggle
            label="Human review"
            checked={form.humanReviewRequired}
            onChange={(value) => setField("humanReviewRequired", value)}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.back()} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            <Save className="mr-1 h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
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
