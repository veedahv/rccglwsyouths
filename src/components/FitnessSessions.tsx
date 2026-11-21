"use client";

import { useState } from "react";
import Link from "next/link";
import { saveFitnessSessions } from "@/lib/gameEvents";
import { ALL_MOVE_IDS, ALL_SECTIONS, ROUTINE_MOVE_IDS, buildSteps, moveMatches, type Difficulty } from "@/lib/warmups";
import { Badge, Card, Notice } from "@/components/ui";
import type { FitnessSession, GameEvent } from "@/types/games";

const NAME_IDEAS = ["Warm-up", "Before the football", "Before the races", "Mid-day fitness"];

interface Draft {
  id: string | null; // null while adding a new one
  title: string;
  picked: Set<string>;
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** "Get warm · Loosen up (3 of 5)": which parts of the routine a session uses. */
function describeSession(moveIds: string[]): string {
  const picked = new Set(moveIds);
  return ALL_SECTIONS.flatMap((section) => {
    const k = section.moves.filter((m) => picked.has(m.id)).length;
    if (k === 0) return [];
    return [k === section.moves.length ? section.title : `${section.title} (${k} of ${section.moves.length})`];
  }).join(" · ");
}

/**
 * Tick the moves to use. The four parts of the routine come first, then the exercise library by category
 * (closed until opened, because there are a lot). A part or category can be ticked all at once, and a search
 * narrows the list.
 */
function MovePicker({ picked, onChange }: { picked: Set<string>; onChange: (next: Set<string>) => void }) {
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
  const filtering = query.trim() !== "" || difficulty !== "all";

  function toggleMove(id: string) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }
  function toggleSection(ids: string[]) {
    const next = new Set(picked);
    const allOn = ids.every((id) => next.has(id));
    for (const id of ids) {
      if (allOn) next.delete(id);
      else next.add(id);
    }
    onChange(next);
  }

  const groups = ALL_SECTIONS.map((section) => ({
    section,
    moves: section.moves.filter((m) => moveMatches(m, section, query, difficulty)),
  })).filter((g) => g.moves.length > 0);

  function renderGroup({ section, moves }: (typeof groups)[number]) {
    const ids = section.moves.map((m) => m.id);
    const k = ids.filter((id) => picked.has(id)).length;
    const library = section.kind === "library";
    const header = (
      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
        <input type="checkbox" checked={k === ids.length} onChange={() => toggleSection(ids)} className="h-4 w-4 accent-[#028A2C]" />
        <span aria-hidden="true">{section.emoji}</span>
        {section.title}
        <span className="font-normal text-muted">
          {section.minutes ? `· ${section.minutes} ` : ""}
          {k > 0 ? `· ${k} of ${ids.length} picked` : library ? `· ${ids.length} exercises` : ""}
        </span>
      </label>
    );
    const list = (
      <ul className="mt-2 space-y-1 pl-6">
        {moves.map((move) => (
          <li key={move.id}>
            <label className="flex cursor-pointer items-baseline gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={picked.has(move.id)}
                onChange={() => toggleMove(move.id)}
                className="h-4 w-4 shrink-0 translate-y-0.5 accent-[#028A2C]"
              />
              <span>
                {move.name} <span className="text-muted">· {move.dose}</span>
                {move.difficulty && move.difficulty !== "Beginner" && <span className="text-muted"> · {move.difficulty}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
    );

    if (!library) {
      return (
        <fieldset key={section.id} className="rounded-xl border border-line bg-white/70 p-3">
          {header}
          {list}
        </fieldset>
      );
    }
    // A library category: closed until opened (or until searching, or when it already has picked moves).
    return (
      <details key={section.id} open={filtering || k > 0 ? true : undefined} className="rounded-xl border border-line bg-white/70 p-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2">{header}</summary>
        {list}
      </details>
    );
  }

  const routine = groups.filter((g) => g.section.kind !== "library");
  const library = groups.filter((g) => g.section.kind === "library");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the moves, e.g. shoulder, lunge, neck"
          aria-label="Search the moves"
          className="input min-w-[12rem] flex-1"
        />
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty | "all")}
          aria-label="Difficulty"
          className="input !w-auto"
        >
          <option value="all">Any difficulty</option>
          <option value="Beginner">Beginner</option>
          <option value="Intermediate">Intermediate</option>
          <option value="Advanced">Advanced</option>
        </select>
      </div>

      {groups.length === 0 && <p className="text-sm text-muted">No moves match. Try a different word or difficulty.</p>}

      {routine.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">The routine</p>
          {routine.map(renderGroup)}
        </div>
      )}
      {library.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Exercise library</p>
          {library.map(renderGroup)}
        </div>
      )}
    </div>
  );
}

/**
 * The fitness warm-ups planned for a games event. An event can have several fitness sessions (a warm-up
 * before the games, another before the football…); each one picks the moves it uses from the routine
 * under Games, Fitness warm-ups, and has its own leader mode.
 */
export default function FitnessSessions({ event, canEdit }: { event: GameEvent; canEdit: boolean }) {
  const sessions = event.fitnessSessions ?? [];
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startAdd() {
    setError(null);
    setDraft({
      id: null,
      title: sessions.length === 0 ? "Warm-up" : `Fitness session ${sessions.length + 1}`,
      picked: new Set(ROUTINE_MOVE_IDS), // starts with the whole routine; untick what isn't wanted, or add from the library
    });
  }

  function startEdit(s: FitnessSession) {
    setError(null);
    setDraft({ id: s.id, title: s.title, picked: new Set(s.moveIds) });
  }

  async function persist(next: FitnessSession[]): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      await saveFitnessSessions(event.id, next);
      return true;
    } catch (err) {
      console.error(err);
      setError("Couldn't save the fitness sessions. Check your connection and try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft() {
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) return setError("Give the session a name, like Warm-up or Before the football.");
    if (draft.picked.size === 0) return setError("Pick at least one move.");
    const moveIds = ALL_MOVE_IDS.filter((id) => draft.picked.has(id)); // kept in the order of the routine, then the library
    const session: FitnessSession = { id: draft.id ?? newId(), title, moveIds };
    const next = draft.id ? sessions.map((s) => (s.id === draft.id ? session : s)) : [...sessions, session];
    if (await persist(next)) setDraft(null);
  }

  async function remove(s: FitnessSession) {
    if (!window.confirm(`Remove the fitness session "${s.title}"?`)) return;
    await persist(sessions.filter((x) => x.id !== s.id));
  }

  async function move(i: number, by: -1 | 1) {
    const j = i + by;
    if (j < 0 || j >= sessions.length) return;
    const next = [...sessions];
    [next[i], next[j]] = [next[j], next[i]];
    await persist(next);
  }

  return (
    <Card
      title="Fitness warm-ups"
      description="Warm-up sessions for this games event, made from the routine and exercise library under Games, Fitness warm-ups. Add as many sessions as you need and pick the moves for each."
      action={
        canEdit && !draft ? (
          <button type="button" onClick={startAdd} className="btn-secondary">
            Add a fitness session
          </button>
        ) : undefined
      }
    >
      {error && (
        <Notice tone="error" className="mb-3">
          {error}
        </Notice>
      )}

      {draft && canEdit && (
        <div className="mb-4 space-y-3 rounded-xl border border-line bg-mist/60 p-4">
          <div>
            <label className="label" htmlFor="fitness-title">
              Name of this session
            </label>
            <input
              id="fitness-title"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="input"
              maxLength={40}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {NAME_IDEAS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => setDraft({ ...draft, title: idea })}
                  className="rounded-full border border-line bg-white px-3 py-0.5 text-xs text-ink hover:border-rccg-purple-300"
                >
                  {idea}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="label !mb-0">Moves to use ({draft.picked.size} of {ALL_MOVE_IDS.length})</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setDraft({ ...draft, picked: new Set(ROUTINE_MOVE_IDS) })} className="btn-ghost btn-sm">
                  Pick the routine
                </button>
                <button type="button" onClick={() => setDraft({ ...draft, picked: new Set() })} className="btn-ghost btn-sm">
                  Clear
                </button>
              </div>
            </div>
            <MovePicker picked={draft.picked} onChange={(picked) => setDraft({ ...draft, picked })} />
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={saveDraft} disabled={saving} className="btn-primary">
              {saving ? "Saving…" : draft.id ? "Save changes" : "Add session"}
            </button>
            <button type="button" onClick={() => setDraft(null)} disabled={saving} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {sessions.length === 0 ? (
        !draft && (
          <p className="text-sm text-muted">
            No fitness sessions yet.{" "}
            {canEdit
              ? "Add one for the warm-up before the games, or several, like one in the morning and another before the football."
              : "The people running this event can add them."}
          </p>
        )
      ) : (
        <ul className="divide-y divide-line">
          {sessions.map((s, i) => {
            const count = buildSteps(s.moveIds).length;
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold text-ink">
                    <span className="truncate">{s.title}</span>
                    <Badge tone="green">{count === 1 ? "1 move" : `${count} moves`}</Badge>
                  </p>
                  <p className="mt-0.5 text-sm text-muted">{describeSession(s.moveIds) || "No moves picked"}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  {count > 0 && (
                    <Link href={`/games/events/${event.id}/fitness/${s.id}`} className="btn-primary btn-sm">
                      Lead
                    </Link>
                  )}
                  {canEdit && (
                    <>
                      <button type="button" onClick={() => move(i, -1)} disabled={saving || i === 0} aria-label="Move earlier" className="btn-ghost btn-sm">
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={saving || i === sessions.length - 1}
                        aria-label="Move later"
                        className="btn-ghost btn-sm"
                      >
                        ↓
                      </button>
                      <button type="button" onClick={() => startEdit(s)} disabled={saving} className="btn-ghost btn-sm">
                        Edit
                      </button>
                      <button type="button" onClick={() => remove(s)} disabled={saving} className="btn-ghost-danger btn-sm">
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
