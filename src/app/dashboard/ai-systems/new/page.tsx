"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AISystemForm } from "@/components/dashboard/ai-system-form";

export default function NewAISystemPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/ai-systems"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
      >
        <ChevronLeft className="h-4 w-4" />
        AI Systems
      </Link>
      <div>
        <h2 className="text-xl font-bold text-slate-900">Add AI System</h2>
        <p className="text-sm text-slate-500">
          Create a governed AI use case record.
        </p>
      </div>
      <AISystemForm mode="create" />
    </div>
  );
}

