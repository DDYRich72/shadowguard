"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { BrandMark } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function safeNext(value: string | null): string {
  if (!value || typeof value !== "string") return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  if (/[\x00-\x1f]/.test(value)) return "/dashboard";
  return value;
}

function MfaChallengeForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [factorId, setFactorId] = useState<string | null>(null);
  const [factorName, setFactorName] = useState<string>("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (!active) return;
        if (error) {
          setBootError(error.message);
          return;
        }
        const verified = (data?.totp ?? []).find((f) => f.status === "verified");
        if (!verified) {
          setBootError(
            "No verified TOTP factor on this account. Enroll one first."
          );
          return;
        }
        setFactorId(verified.id);
        setFactorName(verified.friendly_name ?? "TOTP");
        const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({
          factorId: verified.id,
        });
        if (!active) return;
        if (chErr) {
          setBootError(chErr.message);
          return;
        }
        setChallengeId(ch?.id ?? null);
      })();
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [supabase]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!factorId || !challengeId) return;
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code: code.trim(),
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  if (bootError) {
    return (
      <div className="space-y-4">
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {bootError}
        </p>
        <Link href="/dashboard/settings/security" className="text-sm font-medium text-slate-900 underline">
          Go to Security settings →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="code">6-digit code from {factorName}</Label>
        <Input
          id="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="font-mono tracking-[0.3em] text-center text-lg"
          autoFocus
          required
        />
      </div>
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <Button
        type="submit"
        className="w-full bg-slate-900 hover:bg-slate-800"
        disabled={submitting || code.length < 6 || !challengeId}
      >
        {submitting ? "Verifying…" : "Verify"}
      </Button>
    </form>
  );
}

export default function MfaPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-2">
          <BrandMark className="rounded-lg" />
          <span className="text-lg font-semibold text-slate-900">
            ShadowGuard
          </span>
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Two-factor authentication
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Enter the code from your authenticator app to finish signing in.
          </p>
        </div>
        <Suspense>
          <MfaChallengeForm />
        </Suspense>
        <div className="text-center text-sm">
          <Link
            href="/login/mfa/recover"
            className="text-slate-500 hover:text-slate-900"
          >
            Lost your authenticator? Use a backup code →
          </Link>
        </div>
      </div>
    </div>
  );
}
