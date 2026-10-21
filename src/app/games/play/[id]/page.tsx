"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { subscribeRun } from "@/lib/teasers";
import { useAuth } from "@/lib/useAuth";
import RequireAuth from "@/components/RequireAuth";
import TeaserHost from "@/components/TeaserHost";
import { Page, Loading, EmptyState } from "@/components/ui";
import type { GameRun } from "@/types/teasers";

// The host controls for one play of a game that isn't a question-and-round
// game. The run's `kind` decides which controls load; add a case here (and in
// ./present) when another kind of game is added.
function PlayInner() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const canControl = hasPermission("canEditEvents");
  const [run, setRun] = useState<GameRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeRun(
      id,
      (r) => {
        setRun(r);
        setLoading(false);
      },
      () => {
        setError("Couldn't load this game.");
        setLoading(false);
      }
    );
  }, [id]);

  if (loading) {
    return (
      <Page>
        <Loading />
      </Page>
    );
  }
  if (!run) {
    return (
      <Page size="sm">
        <EmptyState
          title="Game not found"
          description={error ?? "It may have been deleted."}
          action={
            <Link href="/games/teasers" className="btn-secondary">
              Back to teasers
            </Link>
          }
        />
      </Page>
    );
  }

  switch (run.kind) {
    case "teaser":
      return <TeaserHost run={run} canControl={canControl} />;
  }
}

export default function GamePlayPage() {
  return (
    <RequireAuth>
      <PlayInner />
    </RequireAuth>
  );
}
