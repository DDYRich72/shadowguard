import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  MessageSquareText,
  Route,
  Target,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  assessmentKit,
  manualInventoryCsvPath,
} from "@/lib/ai-governance/assessment-kit";
import { cn } from "@/lib/utils";

export default function AssessmentKitPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-slate-700" />
            <h2 className="text-xl font-bold text-slate-900">Assessment Kit</h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Self-service templates for running an AI Governance Readiness Assessment.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={manualInventoryCsvPath}
            className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
          >
            <Download className="h-4 w-4" />
            Download CSV
          </Link>
          <Link
            href="/dashboard/ai-systems/import"
            className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </Link>
          <Link
            href="/dashboard/ai-systems"
            className={cn(buttonVariants({ variant: "default" }), "gap-2")}
          >
            Open AI Systems
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <BriefcaseBusiness className="h-4 w-4 text-slate-600" />
            Assessment Workflows
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          {assessmentKit.packages.map((pkg) => (
            <div key={pkg.name} className="rounded-lg border border-slate-200 p-4">
              <Badge variant="outline" className="bg-slate-50 text-slate-700">
                {pkg.timeline}
              </Badge>
              <h3 className="mt-3 text-sm font-semibold text-slate-950">
                {pkg.name}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {pkg.audience}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {pkg.outcome}
              </p>
              <ul className="mt-3 space-y-2">
                {pkg.deliverables.map((item) => (
                  <li key={item} className="flex gap-2 text-sm leading-6 text-slate-600">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <FileText className="h-4 w-4 text-slate-600" />
              Assessment Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Badge variant="outline" className="bg-slate-50 text-slate-700">
                Self-service workflow
              </Badge>
              <h3 className="mt-3 text-2xl font-semibold text-slate-950">
                {assessmentKit.offer.title}
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                {assessmentKit.offer.promise}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <ListBlock title="Ideal For" items={assessmentKit.offer.idealFor} />
              <ListBlock title="Deliverables" items={assessmentKit.offer.deliverables} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Target className="h-4 w-4 text-slate-600" />
              Success Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {assessmentKit.successMetrics.map((metric) => (
                <li key={metric} className="flex gap-2 text-sm leading-6 text-slate-700">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{metric}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ClipboardList className="h-4 w-4 text-slate-600" />
              Intake Checklist
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {assessmentKit.intakeChecklist.map((section) => (
              <ListBlock key={section.title} title={section.title} items={section.items} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Download className="h-4 w-4 text-slate-600" />
              Manual Inventory Template
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">
              Use this when your organization is not ready to connect Google or Microsoft. Each row becomes a candidate AI System.
            </p>
            <Link
              href={manualInventoryCsvPath}
              className={cn(buttonVariants({ variant: "outline" }), "w-full gap-2")}
            >
              <Download className="h-4 w-4" />
              Download CSV Template
            </Link>
            <Link
              href="/dashboard/ai-systems/import"
              className={cn(buttonVariants({ variant: "default" }), "w-full gap-2")}
            >
              <Upload className="h-4 w-4" />
              Import CSV
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Route className="h-4 w-4 text-slate-600" />
            Discovery-To-Governance Workflow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-5">
            {assessmentKit.workflow.map((step, index) => (
              <div key={step.title} className="rounded-lg border border-slate-200 p-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-xs font-semibold text-white">
                  {index + 1}
                </div>
                <h3 className="mt-3 text-sm font-semibold text-slate-950">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
                {step.route && (
                  <Link
                    href={step.route}
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-slate-900 underline"
                  >
                    Open
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <CalendarCheck className="h-4 w-4 text-slate-600" />
              Kickoff And Materials
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <ListBlock title="Kickoff Agenda" items={assessmentKit.kickoffAgenda} />
            <ListBlock title="Materials Request" items={assessmentKit.materialsRequest} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <FileText className="h-4 w-4 text-slate-600" />
              Final Delivery
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <ListBlock title="Deliverable Checklist" items={assessmentKit.deliveryChecklist} />
            <ListBlock title="Executive Readout" items={assessmentKit.executiveReadout} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <MessageSquareText className="h-4 w-4 text-slate-600" />
              Validation Conversation Guide
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {assessmentKit.conversationGuide.map((question) => (
                <li key={question} className="rounded-lg border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-700">
                  {question}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <CheckCircle2 className="h-4 w-4 text-slate-600" />
              Guardrails
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {assessmentKit.guardrails.map((guardrail) => (
                <li key={guardrail} className="flex gap-2 text-sm leading-6 text-slate-700">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
                  <span>{guardrail}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-6 text-slate-600">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
