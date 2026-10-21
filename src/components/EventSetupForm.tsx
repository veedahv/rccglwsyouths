"use client";

import { useState } from "react";
import { parseISODate } from "@/lib/format";
import { Field, Notice } from "@/components/ui";
import { GAME_LABEL } from "@/types/games";
import type { GameKind } from "@/types/games";

export interface EventDraft {
  title: string;
  subtitle?: string;
  venue?: string;
  plannedGames: GameKind[];
}

const ALL_GAMES: GameKind[] = ["scramble", "bibleOrCap", "emoji", "bookGuess", "fillBlank", "whoAmI", "board"];

/** "Wednesday · 21 October 2026 · 5:00 PM", from a date (yyyy-MM-dd) and a time (HH:mm), either of which can be left out. */
function whenLine(date: string, time: string): string | undefined {
  const parts: string[] = [];
  if (date) {
    const d = parseISODate(date);
    parts.push(d.toLocaleDateString("en-GB", { weekday: "long" }));
    parts.push(d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }));
  }
  if (time) {
    const [h, m] = time.split(":").map(Number);
    parts.push(`${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`);
  }
  return parts.length ? parts.join(" · ") : undefined;
}

/**
 * Starts a games event: a title, when and where, and which games are planned.
 * The planned games only fill the cover screen. Each game's own sides, rounds
 * and timer are set up later, one game at a time, from the event page.
 */
export default function EventSetupForm({ saving, onSubmit }: { saving: boolean; onSubmit: (draft: EventDraft) => void }) {
  const [title, setTitle] = useState("Games Day");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [venue, setVenue] = useState("");
  const [planned, setPlanned] = useState<GameKind[]>([]);
  const [error, setError] = useState<string | null>(null);

  function toggle(game: GameKind) {
    setPlanned((prev) => (prev.includes(game) ? prev.filter((g) => g !== game) : [...prev, game]));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Give the event a title.");
    setError(null);
    onSubmit({
      title: title.trim(),
      subtitle: whenLine(date, time),
      venue: venue.trim() || undefined,
      // Keep the games in the same order as the list below, so the cover reads 01, 02, 03…
      plannedGames: ALL_GAMES.filter((g) => planned.includes(g)),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Event title" hint="Shown large on the cover screen and as the tag on the video overlay.">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" required />
      </Field>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Date (optional)">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </Field>
        <Field label="Time (optional)">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input" />
        </Field>
        <Field label="Venue (optional)">
          <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Church Auditorium" className="input" />
        </Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="label">Games to be played</legend>
        <p className="text-xs text-muted">
          Tick one for a single-game event, or several for a games day. They are listed on the cover screen. You choose the
          players, teams and questions for each game when you add it, so every game can have different sides.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ALL_GAMES.map((g) => (
            <label
              key={g}
              className={[
                "flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors",
                planned.includes(g) ? "border-rccg-green-500 bg-rccg-green-50" : "border-line bg-white hover:border-rccg-purple-300",
              ].join(" ")}
            >
              <input type="checkbox" checked={planned.includes(g)} onChange={() => toggle(g)} className="h-4 w-4 accent-rccg-green-600" />
              {GAME_LABEL[g]}
            </label>
          ))}
        </div>
      </fieldset>

      {error && <Notice tone="error">{error}</Notice>}

      <button disabled={saving} className="btn-primary">
        {saving ? "Creating…" : "Create event"}
      </button>
    </form>
  );
}
