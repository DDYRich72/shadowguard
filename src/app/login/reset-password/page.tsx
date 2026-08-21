"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { BrandMark } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkPassword, passwordStrengthLabel } from "@/lib/password-policy";

function cleanRecoveryUrl() {
  if (typeof window === "undefined") return;
  window.history.replaceState(null, "", window.location.pathname);
}

function isPkceVerifierError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  const normalized = message.toLowerCase();
  return normalized.includes("pkce") || normalized.includes("code verifier");
}

function recoveryLinkMessage(error: unknown): string {
  if (isPkceVerifierError(error)) {
    return "This reset link was created by the previous recovery flow and could not be verified in this browser. Request a new reset link, then open the newest email link.";
  }

  return error instanceof Error
    ? error.message
    : "Reset link could not be verified. Request a new password reset link.";
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [loadingSession, setLoadingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [pendingTokenHash, setPendingTokenHash] = useState<string | null>(null);
  const [verifyingLink, setVerifyingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);

  const pw = useMemo(() => checkPassword(password), [password]);
  const strengthLabel = passwordStrengthLabel(pw.score);

  useEffect(() => {
    let mounted = true;
    const supabase = createBrowserSupabase();

    async function establishRecoverySession() {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const searchParams = new URLSearchParams(window.location.search);
      const urlError =
        hashParams.get("error_description") ||
        searchParams.get("error_description") ||
        hashParams.get("error") ||
        searchParams.get("error");
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type") || hashParams.get("type");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const code = searchParams.get("code");

      try {
        if (urlError) {
          throw new Error(urlError);
        }

        if (tokenHash && type === "recovery") {
          if (!mounted) return;
          setPendingTokenHash(tokenHash);
          setHasSession(false);
          return;
        }

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
          cleanRecoveryUrl();
        } else if (code) {
          const { error: codeError } = await supabase.auth.exchangeCodeForSession(code);
          if (codeError) throw codeError;
          cleanRecoveryUrl();
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!mounted) return;
        setHasSession(Boolean(data.session));
      } catch (sessionError) {
        if (!mounted) return;
        setLinkError(recoveryLinkMessage(sessionError));
        setHasSession(false);
      } finally {
        if (mounted) setLoadingSession(false);
      }
    }

    establishRecoverySession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted || event !== "PASSWORD_RECOVERY") return;
      setPendingTokenHash(null);
      setHasSession(Boolean(session));
      cleanRecoveryUrl();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function verifyPendingRecoveryLink() {
    if (!pendingTokenHash) return;
    setLinkError(null);
    setVerifyingLink(true);

    const supabase = createBrowserSupabase();
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: pendingTokenHash,
      type: "recovery",
    });

    if (verifyError) {
      setVerifyingLink(false);
      setLinkError(recoveryLinkMessage(verifyError));
      return;
    }

    const session = data.session ?? (await supabase.auth.getSession()).data.session;
    setPendingTokenHash(null);
    setHasSession(Boolean(session));
    setVerifyingLink(false);
    cleanRecoveryUrl();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!pw.ok) {
      setError(pw.problems[0]);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const supabase = createBrowserSupabase();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setSubmitting(false);
      setError(updateError.message);
      return;
    }

    await supabase.auth.signOut();
    setSubmitting(false);
    setComplete(true);
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
          <span className="sg-pill sg-pill-brand">Reset</span>
        </div>

        <div className="sg-scanlines relative space-y-6 overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A] p-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
          {complete ? (
            <>
              <div>
                <p className="sg-mono text-[color:var(--approved-ink)]">
                  Password updated
                </p>
                <h1 className="font-display mt-3 text-2xl font-semibold tracking-tight">
                  You&apos;re ready to sign in.
                </h1>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  Your password was changed. Sign in again with the new
                  password to continue.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => router.replace("/login")}
                className="h-10 w-full rounded-md bg-[color:var(--brand)] text-sm font-semibold tracking-tight text-white hover:bg-[color:var(--focus)]"
              >
                Sign in
              </Button>
            </>
          ) : loadingSession ? (
            <p className="text-sm text-white/55">Checking reset session...</p>
          ) : !hasSession ? (
            <>
              {pendingTokenHash ? (
                <>
                  <div>
                    <p className="sg-mono text-[color:var(--brand)]">
                      Confirm reset
                    </p>
                    <h1 className="font-display mt-3 text-2xl font-semibold tracking-tight">
                      Continue password reset.
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-white/55">
                      Confirm this request before choosing a new password. This
                      helps protect reset links from automated email scanners.
                    </p>
                  </div>
                  {linkError && (
                    <p className="rounded-md border border-[color:var(--risk)]/30 bg-[color:var(--risk)]/10 px-3 py-2 text-sm text-[color:var(--risk)]">
                      {linkError}
                    </p>
                  )}
                  <Button
                    type="button"
                    onClick={verifyPendingRecoveryLink}
                    disabled={verifyingLink}
                    className="h-10 w-full rounded-md bg-[color:var(--brand)] text-sm font-semibold tracking-tight text-white hover:bg-[color:var(--focus)]"
                  >
                    {verifyingLink ? "Verifying link..." : "Continue reset"}
                  </Button>
                </>
              ) : (
                <>
                  <div>
                    <p className="sg-mono text-[color:var(--risk)]">
                      Link required
                    </p>
                    <h1 className="font-display mt-3 text-2xl font-semibold tracking-tight">
                      Open your reset link.
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-white/55">
                      {linkError ||
                        "Password reset links expire and can only be used once. Request a new link if this one has already been used."}
                    </p>
                  </div>
                  <Button
                    render={<Link href="/login/forgot-password" />}
                    nativeButton={false}
                    className="h-10 w-full rounded-md bg-[color:var(--brand)] text-sm font-semibold tracking-tight text-white hover:bg-[color:var(--focus)]"
                  >
                    Request a new link
                  </Button>
                </>
              )}
            </>
          ) : (
            <>
              <div>
                <p className="sg-mono text-[color:var(--brand)]">
                  Choose a password
                </p>
                <h1 className="font-display mt-3 text-2xl font-semibold tracking-tight">
                  Set your new password.
                </h1>
                <p className="mt-1.5 text-sm leading-6 text-white/55">
                  Use at least 12 characters. Longer passphrases work well.
                </p>
              </div>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-mono uppercase tracking-[0.18em] text-white/50">
                    New password
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
                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-xs font-mono uppercase tracking-[0.18em] text-white/50">
                    Confirm password
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="h-10 rounded-md border-white/10 bg-white/[0.04] text-white placeholder:text-white/30 focus-visible:border-[color:var(--focus)] focus-visible:ring-[color:var(--focus)]/40"
                  />
                </div>
                {error && (
                  <p className="rounded-md border border-[color:var(--risk)]/30 bg-[color:var(--risk)]/10 px-3 py-2 text-sm text-[color:var(--risk)]">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  className="h-10 w-full rounded-md bg-[color:var(--brand)] text-sm font-semibold tracking-tight text-white hover:bg-[color:var(--focus)]"
                  disabled={submitting || !pw.ok}
                >
                  {submitting ? "Updating password..." : "Update password"}
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="mt-4 text-center sg-mono-sm text-white/30">
          SHADOWGUARD · AUTH-04 · TLS 1.3
        </p>
      </div>
    </div>
  );
}
