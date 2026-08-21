import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  KeyRound,
  Network,
  Radar,
  Server,
  Shield,
} from "lucide-react";
import { BrandMark } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { getServerAppUrl } from "@/lib/public-url";

const FEATURES = [
  {
    icon: Radar,
    title: "Shadow AI discovery",
    body: "Inventory AI-related Google Workspace and Microsoft 365 applications, permissions, users, and risk signals when you configure those optional providers.",
  },
  {
    icon: ClipboardList,
    title: "Governance assessments",
    body: "Register AI systems, score risks, map controls, attach evidence, track remediation, and review assessment results inside your own organization.",
  },
  {
    icon: Bot,
    title: "AgentGuard",
    body: "Accept metadata-only activity from customer-controlled sources, evaluate policy decisions, review outcomes, and export signed evidence to destinations you operate.",
  },
  {
    icon: Network,
    title: "MCP governance",
    body: "Register MCP servers and tools, review tool posture, and record governance events without sending operational ownership to a third party.",
  },
  {
    icon: FileText,
    title: "Evidence and reporting",
    body: "Create governance snapshots, review queues, PDFs, export packs, delivery links, and audit records from data stored in your Supabase project.",
  },
  {
    icon: KeyRound,
    title: "Security controls preserved",
    body: "Organization-scoped RLS, role checks, MFA gates, same-origin validation, rate limits, encrypted credentials, source keys, and audit logging remain in place.",
  },
];

const RESPONSIBILITIES = [
  "Application and Supabase hosting",
  "TLS, DNS, backups, monitoring, and updates",
  "OAuth, CAPTCHA, Redis, Slack, and outbound integration credentials",
  "User access, incident response, and regulatory obligations",
];

const SOFTWARE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareSourceCode",
  name: "ShadowGuard",
  url: getServerAppUrl(),
  programmingLanguage: ["TypeScript", "SQL"],
  runtimePlatform: "Node.js",
  license: "https://www.apache.org/licenses/LICENSE-2.0",
  description:
    "An Apache-2.0 self-hosted application for AI discovery, governance assessments, AgentGuard policy evaluation, MCP governance, evidence, and reporting.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_JSONLD) }}
      />

      <nav className="sticky top-0 z-40 border-b border-white/10 bg-[#050505]/95 text-white backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark priority />
            <div className="leading-none">
              <span className="font-display text-[15px] font-semibold tracking-tight">
                ShadowGuard
              </span>
              <span className="sg-mono-sm mt-1 hidden text-white/40 sm:block">
                Open-source command console
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-2 sm:gap-5">
            <Link href="#capabilities" className="hidden text-[13px] text-white/55 hover:text-white md:inline">
              Capabilities
            </Link>
            <Link href="#self-host" className="hidden text-[13px] text-white/55 hover:text-white md:inline">
              Self-host
            </Link>
            <Link href="/login" className="hidden text-[13px] text-white/55 hover:text-white sm:inline">
              Sign in
            </Link>
            <ThemeToggle className="hidden border-white/10 bg-white/5 sm:inline-flex" />
            <Button
              render={<Link href="/signup" />}
              nativeButton={false}
              className="h-9 rounded-md bg-[color:var(--brand)] px-4 text-[13px] font-semibold text-white hover:bg-[color:var(--focus)]"
            >
              Open console
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative overflow-hidden border-b border-white/10 bg-[#050505] text-white">
          <div aria-hidden className="absolute inset-0 sg-grid" />
          <div aria-hidden className="absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-[color:var(--brand)]/15 blur-[130px]" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--brand)]/35 bg-[color:var(--brand)]/10 px-3 py-1.5 sg-mono text-[color:var(--brand)]">
                <span className="sg-dot bg-[color:var(--brand)]" />
                Apache-2.0 · self-hosted
              </div>
              <h1 className="font-display mt-7 max-w-4xl text-[2.9rem] font-semibold leading-[1.01] tracking-tight sm:text-6xl lg:text-[4.6rem]">
                Run AI governance on infrastructure you control.
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-7 text-white/65 sm:text-lg">
                ShadowGuard is a complete, self-hosted resource for discovery,
                assessments, policy evaluation, MCP governance, evidence, and
                reporting. There is no paid tier, hosted ShadowGuard account, or
                owner-operated telemetry.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button
                  render={<Link href="/signup" />}
                  nativeButton={false}
                  className="h-12 rounded-md bg-[color:var(--brand)] px-6 text-sm font-semibold text-white hover:bg-[color:var(--focus)]"
                >
                  Create local account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  render={<Link href="#self-host" />}
                  nativeButton={false}
                  variant="outline"
                  className="h-12 rounded-md border-white/15 bg-white/[0.03] px-6 text-sm font-semibold text-white hover:bg-white/10 hover:text-white"
                >
                  Deployment overview
                </Button>
              </div>
            </div>

            <div className="sg-scanlines relative overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="sg-mono text-[color:var(--brand)]">Deployment boundary</p>
                  <h2 className="font-display mt-2 text-xl font-semibold">Your stack, your data</h2>
                </div>
                <Shield className="h-6 w-6 text-[color:var(--brand)]" />
              </div>
              <div className="mt-6 space-y-3">
                {[
                  [Server, "Next.js application", "Container or Node.js server"],
                  [Database, "Supabase", "Postgres, Auth, RLS, and Storage"],
                  [Shield, "Security boundary", "Your keys, users, policies, and backups"],
                ].map(([Icon, title, detail]) => {
                  const ItemIcon = Icon as typeof Server;
                  return (
                    <div key={String(title)} className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--brand)]/10 text-[color:var(--brand)]">
                        <ItemIcon className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">{String(title)}</p>
                        <p className="mt-1 text-xs text-white/45">{String(detail)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-5 text-xs leading-5 text-white/40">
                Optional integrations are disabled when their credentials are
                absent. Manual governance workflows remain available.
              </p>
            </div>
          </div>
        </section>

        <section id="capabilities" className="border-b border-border bg-background py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-6">
            <p className="sg-mono text-[color:var(--brand)]">Included for every organization</p>
            <h2 className="font-display mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
              One authorization model. No product entitlements.
            </h2>
            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <article key={feature.title} className="rounded-2xl border border-border bg-card p-6">
                  <feature.icon className="h-5 w-5 text-[color:var(--brand)]" />
                  <h3 className="font-display mt-5 text-lg font-semibold tracking-tight">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="self-host" className="border-b border-white/10 bg-[#050505] py-20 text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-6 lg:grid-cols-2">
            <div>
              <p className="sg-mono text-[color:var(--brand)]">Local development</p>
              <h2 className="font-display mt-4 text-4xl font-semibold tracking-tight">Start from a clean stack.</h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-white/60">
                The repository includes a deterministic initial database, local
                Supabase configuration, and a standalone application image. Read
                the README before exposing an installation to the internet.
              </p>
              <pre className="mt-8 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-7 text-white/75"><code>{`npm ci
copy .env.example .env.local
npm run db:start
npm run dev`}</code></pre>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <p className="sg-mono text-[color:var(--brand)]">Operator responsibility</p>
              <h3 className="font-display mt-3 text-2xl font-semibold">No hosted service or support SLA.</h3>
              <ul className="mt-6 space-y-3">
                {RESPONSIBILITIES.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-white/65">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand)]" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-6 border-t border-white/10 pt-6 text-xs leading-5 text-white/40">
                ShadowGuard is provided as-is. Continued development, response
                times, remediation timelines, uptime, and implementation help are
                not guaranteed.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-background py-20">
          <div className="mx-auto max-w-4xl px-5 text-center sm:px-6">
            <p className="sg-mono text-[color:var(--brand)]">Self-service governance</p>
            <h2 className="font-display mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              Use the complete application in your own environment.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-muted-foreground">
              New verified users receive an isolated organization. Administrators
              deliberately add team members through the documented database-operator procedure.
            </p>
            <Button
              render={<Link href="/ai-governance-assessment" />}
              nativeButton={false}
              className="mt-8 h-12 rounded-md bg-[color:var(--brand)] px-6 text-sm font-semibold text-white hover:bg-[color:var(--focus)]"
            >
              Start an assessment
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#050505] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <BrandMark />
            <span>ShadowGuard open-source distribution</span>
          </div>
          <span>Apache License 2.0 · Provided as-is · Self-hosted</span>
        </div>
      </footer>
    </div>
  );
}
