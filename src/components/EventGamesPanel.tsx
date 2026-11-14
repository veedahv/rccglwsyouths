"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createGamesEventFor, linkGamesEvent, listEvents as listGameEvents, unlinkGamesEvent } from "@/lib/gameEvents";
import { Badge, Card, Notice } from "@/components/ui";
import type { GameEvent } from "@/types/games";
import type { ChurchEvent } from "@/types";

interface Props {
  event: ChurchEvent;
  canEdit: boolean;
  createdBy: string;
  createdByName: string;
  /** Called with the games event's ID once linked, or "" once unlinked, so the page can update itself. */
  onChange: (gamesEventId: string) => void;
}

/**
 * The games at this event (Fitness Day, Love Feast…): start a games event from here, or link one that
 * was already made on the Games page. Attendance for linked games is taken on this page, not there.
 */
export default function EventGamesPanel({ event, canEdit, createdBy, createdByName, onChange }: Props) {
  const [gameEvents, setGameEvents] = useState<GameEvent[] | null>(null);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listGameEvents()
      .then(setGameEvents)
      .catch(() => {
        setGameEvents([]);
        setError("Couldn't load the games events.");
      });
  }, [event.gamesEventId]);

  // A stale link (the games event was deleted) counts as not linked.
  const linked = gameEvents?.find((g) => g.id === event.gamesEventId || g.churchEventId === event.id) ?? null;
  const unlinked = (gameEvents ?? []).filter((g) => !g.churchEventId);

  async function run(work: () => Promise<string>) {
    setBusy(true);
    setError(null);
    try {
      onChange(await work());
    } catch {
      setError("That didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (gameEvents === null) {
    return (
      <Card title="Games" description="Games played at this event.">
        <p className="text-sm text-muted">Loading…</p>
      </Card>
    );
  }

  if (linked) {
    return (
      <Card
        title="Games"
        description="Games played at this event. Attendance for them is the attendance on this page."
        action={
          <Link href={`/games/events/${linked.id}`} className="btn-secondary btn-sm">
            Open games
          </Link>
        }
      >
        {error && (
          <Notice tone="error" className="mb-3">
            {error}
          </Notice>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium text-ink">{linked.title}</p>
          <Badge tone={linked.status === "finished" ? "gray" : "green"} dot={linked.status !== "finished"}>
            {linked.status === "finished" ? "Finished" : "Live"}
          </Badge>
        </div>
        {canEdit && (
          <button
            disabled={busy}
            onClick={() => {
              if (!window.confirm("Unlink the games from this event? The games and scores are kept, but the games will go back to using their own attendance list.")) return;
              void run(async () => {
                await unlinkGamesEvent(linked.id, event.id);
                return "";
              });
            }}
            className="btn-ghost btn-sm mt-2 !text-muted"
          >
            Unlink
          </button>
        )}
      </Card>
    );
  }

  return (
    <Card title="Games" description="Games played at this event, such as a fitness day or a love feast.">
      {error && (
        <Notice tone="error" className="mb-3">
          {error}
        </Notice>
      )}
      <p className="mb-3 text-sm text-muted">No games linked to this event yet.</p>
      {canEdit && (
        <div className="space-y-3">
          <button
            disabled={busy}
            onClick={() => run(() => createGamesEventFor(event, { createdBy, createdByName }))}
            className="btn-secondary btn-sm"
          >
            {busy ? "Starting…" : "Start games for this event"}
          </button>
          {unlinked.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <select value={choice} onChange={(e) => setChoice(e.target.value)} className="input w-auto max-w-full py-1.5 text-sm" aria-label="A games event that's already made">
                <option value="">Or link one that already exists…</option>
                {unlinked.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
              <button
                disabled={busy || !choice}
                onClick={() =>
                  run(async () => {
                    await linkGamesEvent(choice, event.id);
                    return choice;
                  })
                }
                className="btn-secondary btn-sm"
              >
                Link
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
