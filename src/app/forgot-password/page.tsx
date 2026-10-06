"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { describeAuthError } from "@/lib/authErrors";
import AuthShell from "@/components/AuthShell";
import { Notice } from "@/components/ui";

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const clean = email.trim();
    try {
      await resetPassword(clean);
      setSentTo(clean);
    } catch (err) {
      // Firebase reports "no such account" differently depending on the
      // project's email-enumeration-protection setting. Either way we
      // show the same confirmation, so this page can't be used to find
      // out which emails belong to excos. Anything else (bad format,
      // network, rate limit) is worth telling the person about.
      const code = typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
      if (code === "auth/user-not-found") {
        setSentTo(clean);
      } else {
        setError(describeAuthError(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTo) {
    return (
      <AuthShell>
        <div>
          <h2 className="text-2xl font-bold text-rccg-purple-800">Check your email</h2>
          <p className="mt-1 text-sm text-muted">
            If <span className="font-medium text-ink">{sentTo}</span> belongs to an exco account, we've sent a link to
            reset the password. It can take a few minutes to arrive, so check your spam folder too.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSentTo(null);
            setEmail("");
          }}
          className="btn-secondary w-full py-2.5"
        >
          Use a different email
        </button>
        <p className="text-center text-sm">
          <Link href="/login" className="link">
            Back to sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-rccg-purple-800">Forgot your password?</h2>
          <p className="mt-1 text-sm text-muted">
            Enter the email on your exco account and we'll send you a link to set a new one.
          </p>
        </div>

        <label className="block">
          <span className="label">Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            required
            autoFocus
          />
        </label>

        {error && <Notice tone="error">{error}</Notice>}

        <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5">
          {submitting ? "Sending…" : "Send reset link"}
        </button>

        <p className="text-center text-sm">
          <Link href="/login" className="link">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
