"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

export default function RootPage() {
  const { user, exco, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user && exco ? "/dashboard" : "/login");
  }, [user, exco, loading, router]);

  return null;
}
