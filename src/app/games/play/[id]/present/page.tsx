"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { subscribeRun } from "@/lib/teasers";
import RequireAuth from "@/components/RequireAuth";
import TeaserScreen from "@/components/TeaserScreen";
import { Loading, Notice } from "@/components/ui";
import type { GameRun } from "@/types/teasers";

// The big screen for a game that isn't a question-and-round game. It only
// listens. The run's `kind` decides which view loads.
function PresentInner() {
  const { id } = useParams<{ id: string }>();
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-mist">
        <Loading />
      </div>
    );
  }
  if (error || !run) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-mist p-8">
        <Notice tone="error">{error ?? "This game was not found."}</Notice>
      </div>
    );
  }
  switch (run.kind) {
    case "teaser":
      return <TeaserScreen run={run} exitHref={`/games/play/${run.id}`} />;
  }
}

export default function GamePlayPresentPage() {
  return (
    <RequireAuth>
      <PresentInner />
    </RequireAuth>
  );
}
