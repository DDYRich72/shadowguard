"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createPasswordRecoverySupabase } from "@/lib/supabase/client";
import { BrandMark } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Turnstile, TURNSTILE_ENABLED } from "@/components/turnstile";
import { getPublicAppUrl } from "@/lib/public-url";

function passwordRecoveryMessage(error: unknown): string {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  if (message.toLowerCase().includes("rate limit")) {
    return "Too many reset emails were requested. Wait before trying again, then use the newest reset email.";
  }

  return message || "We could not send a reset link. Try again in a moment.";
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (TURNSTILE_ENABLED && !turnstileToken) {
      setError("Please complete the challenge above.");
      return;
    }

    setSubmitting(true);
    const normalizedEmail = email.trim().toLowerCase();
    setEmail(normalizedEmail);
    const supabase = createPasswordRecoverySupabase();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo: `${getPublicAppUrl()}/login/reset-password`,
        ...(turnstileToken ? { captchaToken: turnstileToken } : {}),
      }
    );

    setSubmitting(false);
    if (resetError) {
      setError(passwordRecoveryMessage(resetError));
      return;
    }

    setSent(true);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-6 text-white">
      <div aria-hidden className="absolute inset-0 sg-grid" />
      <div
        aria-hidden
        className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[color:var(--brand)]/15 blur-[120px]"
      />
      <div className="relative w-full max-w-sm">
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
          <span className="sg-pill sg-pill-brand">Recovery</span>
        </div>

        <div className="sg-scanlines relative space-y-6 overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A] p-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
          {sent ? (
            <>
              <div>
                <p className="sg-mono text-[color:var(--approved-ink)]">
                  Reset email sent
                </p>
                <h1 className="font-display mt-3 text-2xl font-semibold tracking-tight">
                  Check your inbox.
                </h1>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  If that account exists, we sent a password reset link to{" "}
                  <strong className="text-white">{email}</strong>. Open it to
                  choose a new password. If it does not arrive, wait before
                  requesting another link.
                </p>
              </div>
              <Button
                render={<Link href="/login" />}
                nativeButton={false}
                className="h-10 w-full rounded-md bg-[color:var(--brand)] text-sm font-semibold tracking-tight text-white hover:bg-[color:var(--focus)]"
              >
                Back to sign in
              </Button>
            </>
          ) : (
            <>
              <div>
                <p className="sg-mono text-[color:var(--brand)]">
                  Account recovery
                </p>
                <h1 className="font-display mt-3 text-2xl font-semibold tracking-tight">
                  Reset your password.
                </h1>
                <p className="mt-1.5 text-sm leading-6 text-white/55">
                  Enter your account email and we&apos;ll send a secure reset
                  link.
                </p>
              </div>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-mono uppercase tracking-[0.18em] text-white/50">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-10 rounded-md border-white/10 bg-white/[0.04] text-white placeholder:text-white/30 focus-visible:border-[color:var(--focus)] focus-visible:ring-[color:var(--focus)]/40"
                  />
                </div>
                {TURNSTILE_ENABLED && <Turnstile onToken={setTurnstileToken} />}
                {error && (
                  <p className="rounded-md border border-[color:var(--risk)]/30 bg-[color:var(--risk)]/10 px-3 py-2 text-sm text-[color:var(--risk)]">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  className="h-10 w-full rounded-md bg-[color:var(--brand)] text-sm font-semibold tracking-tight text-white hover:bg-[color:var(--focus)]"
                  disabled={submitting || (TURNSTILE_ENABLED && !turnstileToken)}
                >
                  {submitting ? "Sending reset link..." : "Send reset link"}
                </Button>
              </form>
              <p className="text-center text-sm text-white/55">
                Remembered it?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-[color:var(--brand)] hover:text-[color:var(--focus)]"
                >
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>

        <p className="mt-4 text-center sg-mono-sm text-white/30">
          SHADOWGUARD · AUTH-03 · TLS 1.3
        </p>
      </div>
    </div>
  );
}
