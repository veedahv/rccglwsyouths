"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import AuthShell from "@/components/AuthShell";
import PasswordInput from "@/components/PasswordInput";
import { Notice } from "@/components/ui";

export default function LoginPage() {
  const { signIn, error } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signIn(email, password);
      router.push("/dashboard");
    } catch {
      // error is already set on the auth context and rendered below
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-rccg-purple-800">Sign in</h2>
          <p className="mt-1 text-sm text-muted">Exco accounts only.</p>
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
          />
        </label>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="login-password" className="text-sm font-medium text-ink">
              Password
            </label>
            <Link href="/forgot-password" className="link text-xs">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="login-password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5">
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
