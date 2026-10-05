"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { Loading, Notice, Page } from "@/components/ui";
import type { Permissions } from "@/types";

interface Props {
  perm?: keyof Permissions; // omit to just require any signed-in exco member
  fallback?: ReactNode;
  children: ReactNode;
}

// Wrap any page/section that should be hidden or blocked based on auth
// state or a specific permission, e.g.:
//   <RequireAuth perm="canEditFinance"><FinanceEditPage /></RequireAuth>
export default function RequireAuth({ perm, fallback, children }: Props) {
  const { user, exco, loading, error, hasPermission } = useAuth();
  const router = useRouter();

  // If a session expires (or never existed) partway through using the
  // app, bounce to /login rather than stranding the user on a page that
  // just prints an error.
  useEffect(() => {
    if (!loading && (!user || !exco)) {
      router.replace("/login");
    }
  }, [loading, user, exco, router]);

  if (loading) {
    return (
      <Page>
        <Loading />
      </Page>
    );
  }

  if (!user || !exco) {
    return (
      fallback ?? (
        <Page size="sm">
          {error ? <Notice tone="error">{error}</Notice> : <Loading label="Redirecting to sign in…" />}
        </Page>
      )
    );
  }

  if (perm && !hasPermission(perm)) {
    return (
      fallback ?? (
        <Page size="sm">
          <Notice tone="error">You don't have permission to view this page.</Notice>
        </Page>
      )
    );
  }

  return <>{children}</>;
}
