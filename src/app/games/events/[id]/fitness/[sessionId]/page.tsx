"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { subscribeEvent } from "@/lib/gameEvents";
import { buildSteps } from "@/lib/warmups";
import RequireAuth from "@/components/RequireAuth";
import PresentFrame from "@/components/PresentFrame";
import WarmupLeader from "@/components/WarmupLeader";
import { Loading, Notice } from "@/components/ui";
import type { GameEvent } from "@/types/games";

// Leader mode for one fitness session of a games event: the moves picked for it, one at a time.
function FitnessSessionInner() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const [event, setEvent] = useState<GameEvent | null | undefined>(undefined); // undefined while loading
  const [error, setError] = useState(false);

  useEffect(() => {
    return subscribeEvent(id, setEvent, () => setError(true));
  }, [id]);

  const session = event?.fitnessSessions?.find((s) => s.id === sessionId);
  const exitHref = `/games/events/${id}`;

  if (event && session) {
    return <WarmupLeader title={session.title} context={event.title} steps={buildSteps(session.moveIds)} exitHref={exitHref} />;
  }

  return (
    <PresentFrame title="Fitness warm-ups" exitHref={exitHref}>
      {error ? (
        <Notice tone="error">Couldn&apos;t load this fitness session.</Notice>
      ) : event === undefined ? (
        <Loading />
      ) : (
        <Notice tone="error">This fitness session was not found. It may have been removed.</Notice>
      )}
    </PresentFrame>
  );
}

export default function FitnessSessionPage() {
  return (
    <RequireAuth>
      <FitnessSessionInner />
    </RequireAuth>
  );
}
