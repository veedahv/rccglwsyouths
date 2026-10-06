"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { applyActionCode, checkActionCode, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { describeAuthError } from "@/lib/authErrors";
import AuthShell from "@/components/AuthShell";
import { Loading, Notice } from "@/components/ui";

// Where the link in the "Your sign-in email was changed" email lands.
// It undoes the change: the account's sign-in email goes back to the
// address it had before. We ask for a click rather than applying on load,
// because some mail scanners open links automatically and would otherwise
// use the code up before the person ever sees it.
function RecoverEmailInner() {
  const params = useSearchParams();
  const oobCode = params.get("oobCode");

  const [status, setStatus] = useState<"checking" | "invalid" | "ready" | "restored">("checking");
  const [restoreEmail, setRestoreEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      setStatus("invalid");
      return;
    }
    let cancelled = false;
    checkActionCode(auth, oobCode)
      .then((info) => {
        if (cancelled) return;
        const email = info.data.email;
        if (!email) {
          setStatus("invalid");
          return;
        }
        setRestoreEmail(email);
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

  async function handleRestore() {
    if (!oobCode) return;
    setSubmitting(true);
    setError(null);
    try {
      await applyActionCode(auth, oobCode);
      setStatus("restored");
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  // If the change wasn't theirs, the password may be compromised too —
  // this is the follow-up step Firebase recommends after a recovery.
  async function handleSendReset() {
    setSubmitting(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, restoreEmail);
      setResetSent(true);
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "checking") return <Loading label="Checking your link…" />;

  if (status === "invalid") {
    return (
      <>
        <div>
          <h2 className="text-2xl font-bold text-rccg-purple-800">Link not valid</h2>
          <p className="mt-1 text-sm text-muted">
            {error ?? "This link is invalid or has already been used."} If your sign-in email was changed and you
            didn't do it, contact a super admin.
          </p>
        </div>
        <Link href="/login" className="btn-primary w-full py-2.5">
          Back to sign in
        </Link>
      </>
    );
  }

  if (status === "restored") {
    return (
      <>
        <div>
          <h2 className="text-2xl font-bold text-rccg-purple-800">Sign-in email restored</h2>
          <p className="mt-1 text-sm text-muted">
            Your sign-in email is back to <span className="font-medium text-ink">{restoreEmail}</span>.
          </p>
        </div>

        <div className="panel space-y-3">
          <p className="text-sm text-ink">
            If you didn't ask for the change, someone else may have access to your account. Reset your password to
            be safe.
          </p>
          {resetSent ? (
            <Notice tone="success">Reset link sent to {restoreEmail}. Check your inbox.</Notice>
          ) : (
            <button type="button" onClick={handleSendReset} disabled={submitting} className="btn-secondary w-full">
              {submitting ? "Sending…" : "Email me a password reset link"}
            </button>
          )}
          {error && <Notice tone="error">{error}</Notice>}
        </div>

        <Link href="/login" className="btn-primary w-full py-2.5">
          Go to sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-rccg-purple-800">Restore your sign-in email?</h2>
        <p className="mt-1 text-sm text-muted">
          This will change your sign-in email back to <span className="font-medium text-ink">{restoreEmail}</span>.
        </p>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <button type="button" onClick={handleRestore} disabled={submitting} className="btn-primary w-full py-2.5">
        {submitting ? "Restoring…" : "Restore this email"}
      </button>
      <p className="text-center text-sm">
        <Link href="/login" className="link">
          Cancel
        </Link>
      </p>
    </>
  );
}

export default function RecoverEmailPage() {
  return (
    <AuthShell>
      <Suspense fallback={<Loading />}>
        <RecoverEmailInner />
      </Suspense>
    </AuthShell>
  );
}
