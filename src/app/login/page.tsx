"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import Logo from "@/components/Logo";
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
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel */}
      <div className="flex flex-col justify-between bg-rccg-purple-700 px-6 py-8 text-white sm:px-10 lg:w-[44%] lg:px-14 lg:py-14">
        <Logo size={56} chip />
        <div className="mt-10 lg:mt-0">
          <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
            LWS RCCG
            <br />
            Youths Platform
          </h1>
          <p className="mt-3 max-w-sm text-sm text-rccg-purple-200 sm:text-base">
            Dues, meetings, events and contributions for the youth department excos, in one place.
          </p>
        </div>
        <div className="mt-10 hidden h-1.5 w-24 overflow-hidden rounded-full lg:flex" aria-hidden="true">
          <span className="h-full flex-1 bg-rccg-green-500" />
          <span className="h-full flex-1 bg-rccg-red-600" />
        </div>
      </div>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center bg-mist px-6 py-10">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
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

          <label className="block">
            <span className="label">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              required
            />
          </label>

          {error && <Notice tone="error">{error}</Notice>}

          <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5">
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
