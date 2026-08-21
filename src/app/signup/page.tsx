"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { BrandMark } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Turnstile, TURNSTILE_ENABLED } from "@/components/turnstile";
import { checkPassword, passwordStrengthLabel } from "@/lib/password-policy";
import { getPublicAppUrl } from "@/lib/public-url";

// Min time between form render and submit. Real humans take >1.5s to
// fill three fields; naive bots submit instantly.
const MIN_SUBMIT_MS = 1500;

export default function SignupPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Honeypot — hidden from humans, bots that auto-fill every field will
  // set it and get silently blocked. Named "website" because form bots
  // love filling that.
  const [honeypot, setHoneypot] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const renderedAtRef = useRef(0);

  useEffect(() => {
    renderedAtRef.current = Date.now();
  }, []);

  const pw = useMemo(() => checkPassword(password), [password]);
  const strengthLabel = passwordStrengthLabel(pw.score);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Honeypot + timing — fail silently (show the same confirmation UX)
    // so bots can't A/B our defenses.
    if (
      honeypot ||
      renderedAtRef.current === 0 ||
      Date.now() - renderedAtRef.current < MIN_SUBMIT_MS
    ) {
      setConfirmationSent(true);
      return;
    }

    if (!pw.ok) {
      setError(pw.problems[0]);
      return;
    }

    if (TURNSTILE_ENABLED && !turnstileToken) {
      setError("Please complete the challenge above.");
      return;
    }

    setSubmitting(true);
    const supabase = createBrowserSupabase();
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { org_name: orgName },
        emailRedirectTo: `${getPublicAppUrl()}/auth/callback`,
        ...(turnstileToken ? { captchaToken: turnstileToken } : {}),
      },
    });

    // Supabase hides "email exists" from the client response on signUp
    // (returns a fake user). We preserve that by always surfacing the
    // same "check your email" outcome on success, regardless of whether
    // the user is new or re-registering.
    if (err) {
      setSubmitting(false);
      // A real error (network, bad payload) — show it.
      setError(err.message);
      return;
    }

    // Supabase with "Confirm email" on returns no session — user must
    // click the link. Show the confirmation state unconditionally; the
    // bootstrap happens later in /auth/callback.
    if (!data.session) {
      setSubmitting(false);
      setConfirmationSent(true);
      return;
    }

    // Dev-only path (confirmation off). Bootstrap directly.
    const bootstrap = await fetch("/api/auth/bootstrap", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        user_id: data.user?.id,
        email,
        org_name: orgName,
      }),
    });

    if (!bootstrap.ok) {
      setSubmitting(false);
      const body = await bootstrap.json().catch(() => ({}));
      if (body.error === "email_not_verified") {
        setConfirmationSent(true);
        return;
      }
      setError("Account created, but organization setup failed. Ask this installation's administrator to check the server logs.");
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-6 py-10 text-white">
      <div aria-hidden className="absolute inset-0 sg-grid" />
      <div
        aria-hidden
        className="absolute -top-32 right-1/2 h-96 w-96 translate-x-1/2 rounded-full bg-[color:var(--brand)]/15 blur-[120px]"
      />
      <div className="relative w-full max-w-sm">
        {/* Top status strip */}
        <div className="mb-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark />
            <div className="leading-none">
              <div className="font-display text-[15px] font-semibold tracking-tight">
                ShadowGuard
              </div>
              <div className="sg-mono-sm mt-1 text-white/40">
                Command Console
              </div>
            </div>
          </Link>
          <span className="sg-pill sg-pill-brand">Step 01</span>
        </div>

        <div className="sg-scanlines relative space-y-6 overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A] p-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">

        {confirmationSent ? (
          <>
            <div>
              <p className="sg-mono text-[color:var(--approved-ink)]">
                Confirmation sent
              </p>
              <h1 className="font-display mt-3 text-2xl font-semibold tracking-tight">
                Check your email.
              </h1>
              <p className="mt-2 text-sm text-white/55">
                If that address can receive mail, we sent a confirmation link to{" "}
                <strong className="text-white">{email}</strong>. Click it to
                finish setting up your organization. The link expires in 24 hours.
              </p>
              <p className="mt-3 text-xs text-white/40">
                Didn&apos;t see it? Check spam, then try again.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full rounded-md border-white/10 bg-white/[0.04] text-sm font-semibold tracking-tight text-white hover:bg-white/[0.08] hover:text-white"
              onClick={() => {
                setConfirmationSent(false);
                setPassword("");
                setHoneypot("");
                setTurnstileToken(null);
              }}
            >
              Use a different email
            </Button>
          </>
        ) : (
          <>
            <div>
              <p className="sg-mono text-[color:var(--brand)]">
                Run your first scan
              </p>
              <h1 className="font-display mt-3 text-2xl font-semibold tracking-tight">
                Create your organization.
              </h1>
              <p className="mt-1.5 text-sm text-white/55">
                Discover Shadow AI in minutes — no credit card required.
              </p>
            </div>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org" className="text-xs font-mono uppercase tracking-[0.18em] text-white/50">
                  Organization name
                </Label>
                <Input
                  id="org"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  className="h-10 rounded-md border-white/10 bg-white/[0.04] text-white placeholder:text-white/30 focus-visible:border-[color:var(--focus)] focus-visible:ring-[color:var(--focus)]/40"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-mono uppercase tracking-[0.18em] text-white/50">
                  Work email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-10 rounded-md border-white/10 bg-white/[0.04] text-white placeholder:text-white/30 focus-visible:border-[color:var(--focus)] focus-visible:ring-[color:var(--focus)]/40"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-mono uppercase tracking-[0.18em] text-white/50">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-10 rounded-md border-white/10 bg-white/[0.04] text-white placeholder:text-white/30 focus-visible:border-[color:var(--focus)] focus-visible:ring-[color:var(--focus)]/40"
                />
                {password.length > 0 && (
                  <div className="space-y-1">
                    <p className={`text-xs font-medium ${strengthLabel.color}`}>
                      Strength: {strengthLabel.label}
                    </p>
                    {!pw.ok && pw.problems[0] && (
                      <p className="text-xs text-white/50">{pw.problems[0]}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Honeypot — visually hidden, unreachable via tab order */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: "-10000px",
                  width: "1px",
                  height: "1px",
                  overflow: "hidden",
                }}
              >
                <label htmlFor="website">Leave this empty</label>
                <input
                  id="website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              {TURNSTILE_ENABLED && (
                <Turnstile onToken={setTurnstileToken} />
              )}

              {error && (
                <p className="rounded-md border border-[color:var(--risk)]/30 bg-[color:var(--risk)]/10 px-3 py-2 text-sm text-[color:var(--risk)]">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="h-10 w-full rounded-md bg-[color:var(--brand)] text-sm font-semibold tracking-tight text-white hover:bg-[color:var(--focus)]"
                disabled={submitting || !pw.ok || (TURNSTILE_ENABLED && !turnstileToken)}
              >
                {submitting ? "Creating account…" : "Create account"}
              </Button>
            </form>
            <p className="text-center text-sm text-white/60">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-[color:var(--brand)] hover:text-[color:var(--focus)]">
                Sign in
              </Link>
            </p>
            <p className="text-center text-xs text-white/40">
              This account belongs to the operator of this self-hosted installation.
            </p>
          </>
        )}
        </div>

        <p className="mt-4 text-center sg-mono-sm text-white/30">
          SHADOWGUARD · AUTH-02 · TLS 1.3
        </p>
      </div>
    </div>
  );
}
