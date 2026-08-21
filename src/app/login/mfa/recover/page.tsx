"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function RecoverForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/auth/mfa/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(
        j.error === "invalid_code"
          ? "That code is not valid or has already been used."
          : j.error === "rate_limited"
          ? "Too many attempts. Wait a minute and try again."
          : "Recovery failed. Please try again."
      );
      return;
    }
    const j = (await res.json()) as { nextStep: string };
    router.replace(j.nextStep);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="code">Backup code</Label>
        <Input
          id="code"
          type="text"
          autoComplete="off"
          maxLength={32}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="XXXXX-XXXXX"
          className="font-mono tracking-[0.2em] text-center text-lg uppercase"
          autoFocus
          required
        />
        <p className="text-xs text-slate-500">
          Codes are case-insensitive. Dashes are optional.
        </p>
      </div>
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <Button
        type="submit"
        className="w-full bg-slate-900 hover:bg-slate-800"
        disabled={submitting || code.replace(/[\s-]/g, "").length < 10}
      >
        {submitting ? "Verifying…" : "Recover account"}
      </Button>
      <p className="text-center text-xs text-slate-500">
        After recovery you must enroll a new authenticator immediately.
      </p>
    </form>
  );
}

export default function RecoverPage() {
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
            Use a backup code
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Enter one of the recovery codes you saved when you enrolled
            two-factor authentication. The code will be consumed and your
            current authenticator will be removed.
          </p>
        </div>
        <Suspense>
          <RecoverForm />
        </Suspense>
        <div className="text-center text-sm">
          <Link
            href="/login/mfa"
            className="text-slate-500 hover:text-slate-900"
          >
            ← Back to authenticator code
          </Link>
        </div>
      </div>
    </div>
  );
}
