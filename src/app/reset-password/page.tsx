"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { describeAuthError, MIN_PASSWORD_LENGTH, validateNewPassword } from "@/lib/authErrors";
import AuthShell from "@/components/AuthShell";
import PasswordInput from "@/components/PasswordInput";
import { Loading, Notice } from "@/components/ui";

// Where the link in the "Reset your password" email lands. The same link
// is used for invites (inviteExco emails a set-password link), so the
// copy says "set" as well as "reset".
function ResetPasswordInner() {
  const params = useSearchParams();
  const oobCode = params.get("oobCode");

  // "checking" while we verify the code; "invalid" if it's missing, used
  // or expired; "ready" shows the form; "done" after success.
  const [status, setStatus] = useState<"checking" | "invalid" | "ready" | "done">("checking");
  const [accountEmail, setAccountEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!oobCode) {
      setStatus("invalid");
      return;
    }
    let cancelled = false;
    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        if (cancelled) return;
        setAccountEmail(email);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(describeAuthError(err));
        setStatus("invalid");
      });
    return () => {
      cancelled = true;
    };
  }, [oobCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!oobCode) return;
    const problem = validateNewPassword(password, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStatus("done");
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "checking") {
    return <Loading label="Checking your link…" />;
  }

  if (status === "invalid") {
    return (
      <>
        <div>
          <h2 className="text-2xl font-bold text-rccg-purple-800">Link not valid</h2>
          <p className="mt-1 text-sm text-muted">
            {error ?? "This password reset link is invalid or has already been used."}
          </p>
        </div>
        <Link href="/forgot-password" className="btn-primary w-full py-2.5">
          Request a new link
        </Link>
        <p className="text-center text-sm">
          <Link href="/login" className="link">
            Back to sign in
          </Link>
        </p>
      </>
    );
  }

  if (status === "done") {
    return (
      <>
        <div>
          <h2 className="text-2xl font-bold text-rccg-purple-800">Password updated</h2>
          <p className="mt-1 text-sm text-muted">Your password has been saved. You can now sign in with it.</p>
        </div>
        <Link href="/login" className="btn-primary w-full py-2.5">
          Go to sign in
        </Link>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-rccg-purple-800">Set a new password</h2>
        <p className="mt-1 text-sm text-muted">
          For <span className="font-medium text-ink">{accountEmail}</span>
        </p>
      </div>

      <label className="block">
        <span className="label">New password</span>
        <PasswordInput
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
        />
        <span className="hint block">At least {MIN_PASSWORD_LENGTH} characters.</span>
      </label>

      <label className="block">
        <span className="label">Confirm new password</span>
        <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" />
      </label>

      {error && <Notice tone="error">{error}</Notice>}

      <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5">
        {submitting ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <Suspense fallback={<Loading />}>
        <ResetPasswordInner />
      </Suspense>
    </AuthShell>
  );
}
