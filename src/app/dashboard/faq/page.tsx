"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

const FAQS = [
  {
    category: "Getting started",
    q: "What is ShadowGuard?",
    a: "ShadowGuard is a self-hosted AI discovery and governance application. It combines optional Google Workspace and Microsoft 365 discovery with manual inventory, risk assessments, controls, evidence, reporting, AgentGuard, and MCP governance.",
  },
  {
    category: "Getting started",
    q: "Do I need a hosted ShadowGuard account?",
    a: "No. Accounts, organizations, application data, and credentials belong to this installation's operator and Supabase project. No ShadowGuard-operated service is involved.",
  },
  {
    category: "Getting started",
    q: "How are organizations created?",
    a: "Every newly verified signup creates an isolated organization. Matching email domains never grant membership. A database operator can deliberately reassign a verified, bootstrapped user through the documented private SQL procedure.",
  },
  {
    category: "Discovery",
    q: "Are Google Workspace and Microsoft 365 required?",
    a: "No. Both discovery providers are optional. Without their credentials, you can use CSV import, manual AI System registration, assessments, controls, evidence, reports, AgentGuard, and MCP governance.",
  },
  {
    category: "Discovery",
    q: "What access do provider connectors use?",
    a: "The connector routes request read-oriented Google or Microsoft permissions needed for directory and authorization discovery. Review the exact scopes in the provider route before enabling an integration in your environment.",
  },
  {
    category: "Governance",
    q: "How do I run an AI governance assessment?",
    a: "Open Onboarding, create or import an AI System, complete its risk assessment, review generated control tasks, attach evidence, and save a governance snapshot. The workflow is authenticated self-service inside your organization.",
  },
  {
    category: "Governance",
    q: "Is the policy generator legal or compliance advice?",
    a: "No. It creates an editable versioned draft from manual inputs. Treat it as a starting point for internal review, not legal advice, certification, auditor attestation, employee acknowledgement, or final policy approval.",
  },
  {
    category: "Security",
    q: "Which security controls remain enabled?",
    a: "The application retains Supabase authentication, organization-scoped RLS, role authorization, MFA requirements for privileged mutations, same-origin checks, rate limits, source-key validation, encrypted integration credentials, and audit logging.",
  },
  {
    category: "Security",
    q: "Who is responsible for backups and incidents?",
    a: "The installation operator is responsible for infrastructure hardening, TLS, backups, restore testing, monitoring, updates, user access, incident response, and applicable legal or regulatory duties.",
  },
  {
    category: "Operation",
    q: "Is support or continued development guaranteed?",
    a: "No. ShadowGuard is provided as-is under Apache-2.0 without a hosted service, support SLA, security SLA, response timeline, remediation timeline, uptime commitment, or maintenance promise.",
  },
] as const;

export default function ShadowGuardFAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [filter, setFilter] = useState("All");
  const categories = ["All", ...Array.from(new Set(FAQS.map((faq) => faq.category)))];
  const filtered = filter === "All" ? FAQS : FAQS.filter((faq) => faq.category === filter);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">ShadowGuard FAQ</h2>
        <p className="text-sm text-slate-500">Current self-hosted behavior and operating boundaries.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setFilter(category)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === category
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((faq) => {
          const index = FAQS.indexOf(faq);
          const open = openIndex === index;
          return (
            <Card key={faq.q} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : index)}
                className="flex w-full items-center justify-between px-4 py-3.5 text-left hover:bg-slate-50"
              >
                <span className="pr-4 text-sm font-medium text-slate-900">{faq.q}</span>
                <span aria-hidden className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
              </button>
              {open && (
                <CardContent className="px-4 pb-4 pt-0">
                  <p className="text-sm leading-relaxed text-slate-600">{faq.a}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-wider text-slate-400">{faq.category}</p>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <p className="pt-4 text-center text-xs text-slate-400">
        For operational questions, consult this repository&apos;s README and your installation administrator.
      </p>
    </div>
  );
}
