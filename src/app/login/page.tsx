"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { BrandMark } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Turnstile, TURNSTILE_ENABLED } from "@/components/turnstile";

function safeNext(value: string | null): string {
  if (!value || typeof value !== "string") return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  if (/[\x00-\x1f]/.test(value)) return "/dashboard";
  return value;
}

// Map error codes set by /auth/callback (and anywhere else that
// redirects here with ?error=...) to user-facing copy. Anything we
// don't recognize is shown verbatim — Supabase's own error messages
// (e.g. "invalid request: both auth code and code verifier should be
// non-empty") are already readable.
function describeError(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "missing_code":
      return "That confirmation link is incomplete. Try clicking it again from the original email.";
    case "org_create_failed":
      return "We couldn't finish setting up your organization. Ask this installation's administrator to check the server logs.";
    case "user_create_failed":
      return "We couldn't finish creating your account. Ask this installation's administrator to check the server logs.";
    case "invalid_email":
      return "That email address doesn't look right.";
    case "pkce_missing":
      return "That email link opened without the signup verifier. If your email is confirmed, sign in with your password to finish setup.";
    default:
      return code;
  }
}

type BootstrapResult =
  | { ok: true }
  | { ok: false; message: string };

async function bootstrapSignedInUser(
  user: User | null,
  fallbackEmail: string
): Promise<BootstrapResult> {
  const userEmail = user?.email ?? fallbackEmail;
  if (!user?.id || !userEmail) {
    return {
      ok: false,
      message: "Signed in, but we couldn't identify the account for setup.",
    };
  }

  const payload: { user_id: string; email: string; org_name?: string } = {
    user_id: user.id,
    email: userEmail,
  };
  const orgName = user.user_metadata?.org_name;
  if (typeof orgName === "string" && orgName.trim()) {
    payload.org_name = orgName;
  }

  const res = await fetch("/api/auth/bootstrap", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.ok) return { ok: true };

  const body = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;
  if (body?.error === "email_not_verified") {
    return {
      ok: false,
      message: "Please confirm your email before signing in.",
    };
  }

  return {
    ok: false,
    message: "Signed in, but organization setup failed. Please try again.",
  };
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const initialError = describeError(params.get("error"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (TURNSTILE_ENABLED && !turnstileToken) {
      setError("Please complete the challenge above.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    setEmail(normalizedEmail);
    const supabase = createBrowserSupabase();
    const { data: signInData, error: err } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
      options: turnstileToken ? { captchaToken: turnstileToken } : undefined,
    });
    if (err) {
      setSubmitting(false);
      setError(err.message);
      return;
    }
    // Post-signin MFA routing. If the session needs to upgrade to AAL2
    // (user has a verified factor), challenge them now. If they're an
    // admin without a verified factor, send them to enrollment.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel === "aal1") {
      router.replace(`/login/mfa?next=${encodeURIComponent(next)}`);
      return;
    }
    // Look up the user's role to decide if enrollment is mandatory.
    let meRes = await fetch("/api/auth/me", { cache: "no-store" });
    if (meRes.status === 401) {
      const bootstrap = await bootstrapSignedInUser(signInData.user, normalizedEmail);
      if (!bootstrap.ok) {
        setSubmitting(false);
        setError(bootstrap.message);
        return;
      }
      meRes = await fetch("/api/auth/me", { cache: "no-store" });
    }
    if (meRes.ok) {
      const me = (await meRes.json()) as { role?: string };
      if (me.role === "admin" && aal?.nextLevel !== "aal2") {
        router.replace("/dashboard/settings/security?enrollment=required");
        return;
      }
    } else {
      setSubmitting(false);
      setError("Signed in, but we couldn't load your ShadowGuard profile.");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
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
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="password" className="text-xs font-mono uppercase tracking-[0.18em] text-white/50">
            Password
          </Label>
          <Link
            href="/login/forgot-password"
            className="text-xs font-medium text-[color:var(--brand)] hover:text-[color:var(--focus)]"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-6 text-white">
      <div aria-hidden className="absolute inset-0 sg-grid" />
      <div
        aria-hidden
        className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[color:var(--brand)]/15 blur-[120px]"
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
          <span className="sg-pill sg-pill-live">
            <span className="sg-dot bg-[color:var(--approved)] sg-pulse" />
            Live
          </span>
        </div>

        <div className="sg-scanlines relative space-y-6 overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A] p-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
          <div>
            <p className="sg-mono text-[color:var(--brand)]">
              Operator sign-in
            </p>
            <h1 className="font-display mt-3 text-2xl font-semibold tracking-tight">
              Welcome back.
            </h1>
            <p className="mt-1.5 text-sm text-white/55">
              Sign in to continue to your console.
            </p>
          </div>
          <Suspense>
            <LoginForm />
          </Suspense>
          <p className="text-center text-sm text-white/55">
            New here?{" "}
            <Link
              href="/signup"
              className="font-semibold text-[color:var(--brand)] hover:text-[color:var(--focus)]"
            >
              Create an account →
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center sg-mono-sm text-white/30">
          SHADOWGUARD · AUTH-01 · TLS 1.3
        </p>
      </div>
    </div>
  );
}
