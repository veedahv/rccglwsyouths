"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { subscribeEvent, subscribeEventSessions, summarizeEvent } from "@/lib/gameEvents";
import { useRoundTimer } from "@/lib/useRoundTimer";
import RequireAuth from "@/components/RequireAuth";
import PresentFrame from "@/components/PresentFrame";
import { EventResult } from "@/components/ResultCard";
import { EventCover, OverallBoard, SessionBigScreen } from "@/components/EventScreens";
import { Loading, Notice } from "@/components/ui";
import type { GameEvent, GameSession } from "@/types/games";

// The big screen for a whole games event. It only listens: the admin runs
// everything from /games/events/[id] and /games/[id], and this screen follows.
// It shows the cover first, then each game as it is put on screen, then the
// standings and the final result. It sits on top of the app's sidebar.
function PresentInner() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<GameEvent | null>(null);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const off = [
      subscribeEvent(
        id,
        (e) => {
          setEvent(e);
          setLoading(false);
        },
        () => {
          setError("Couldn't load this event.");
          setLoading(false);
        }
      ),
      subscribeEventSessions(id, setSessions, () => setError("Couldn't load this event's games.")),
    ];
    return () => off.forEach((f) => f());
  }, [id]);

  const active = event?.view === "game" ? sessions.find((s) => s.id === event.activeSessionId) : undefined;
  const timer = useRoundTimer(active ?? null);
  const summary = useMemo(() => summarizeEvent(sessions), [sessions]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-mist">
        <Loading />
      </div>
    );
  }
  if (error || !event) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-mist p-8">
        <Notice tone="error">{error ?? "This event was not found."}</Notice>
      </div>
    );
  }

  // The cover fills the whole screen, like the poster.
  if (event.view === "cover" || (event.view === "game" && !active)) {
    return (
      <div className="fixed inset-0 z-50">
        <EventCover event={event} />
        <Link href={`/games/events/${event.id}`} className="absolute right-4 top-6 z-20 text-sm text-white/40 hover:text-white">
          Exit
        </Link>
      </div>
    );
  }

  const final = event.view === "final";
  return (
    <PresentFrame
      title={active ? active.title : event.title}
      subtitle={active ? event.title : final ? "Final result" : "Standings so far"}
      exitHref={`/games/events/${event.id}`}
    >
      {active ? (
        <SessionBigScreen session={active} timer={timer} />
      ) : final ? (
        // The result card names the winner; the table under it shows how each game went.
        <div className="mx-auto w-full max-w-5xl space-y-8">
          <EventResult summary={summary} final large />
          {summary.results.length > 0 && (
            <div className="rounded-3xl bg-white/80 p-6 shadow-sm">
              <OverallBoard summary={summary} large final bare />
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full">
            <OverallBoard summary={summary} large />
          </div>
        </div>
      )}
    </PresentFrame>
  );
}

export default function GameEventPresentPage() {
  return (
    <RequireAuth>
      <PresentInner />
    </RequireAuth>
  );
}
