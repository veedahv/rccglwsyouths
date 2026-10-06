"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import { Loading } from "@/components/ui";

// Firebase lets you set ONE "action URL" for all its emails (Authentication
// → Templates → customize action URL). Every email link — password reset,
// email-change recovery — arrives here with ?mode=…&oobCode=…, and this
// page just forwards to the right screen. Point the templates at:
//   https://YOUR-DOMAIN/auth/action
function ActionRouter() {
  const params = useSearchParams();
  const router = useRouter();
  const mode = params.get("mode");
  const oobCode = params.get("oobCode");

  const target =
    oobCode && mode === "resetPassword"
      ? "/reset-password"
      : oobCode && mode === "recoverEmail"
        ? "/recover-email"
        : null;

  useEffect(() => {
    if (target && oobCode) {
      router.replace(`${target}?oobCode=${encodeURIComponent(oobCode)}`);
    }
  }, [target, oobCode, router]);

  if (target) return <Loading label="One moment…" />;

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-rccg-purple-800">Link not recognised</h2>
        <p className="mt-1 text-sm text-muted">
          This link is incomplete or isn't one this app can handle. Try the link in your email again, or request a
          new one.
        </p>
      </div>
      <Link href="/login" className="btn-primary w-full py-2.5">
        Back to sign in
      </Link>
    </>
  );
}

export default function AuthActionPage() {
  return (
    <AuthShell>
      <Suspense fallback={<Loading />}>
        <ActionRouter />
      </Suspense>
    </AuthShell>
  );
}
