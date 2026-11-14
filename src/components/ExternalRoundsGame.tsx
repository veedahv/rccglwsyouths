"use client";

import { useState } from "react";
import {
  drawPlayers,
  newLocalId,
  nextRoundName,
  ordinal,
  playedInRounds,
  playersFor,
  podium,
  roundWinners,
  togglePlacing,
} from "@/lib/externalGames";
import type { ExternalGame, ExternalRound, GamePlayer } from "@/types/games";

interface Props {
  game: ExternalGame;
  pool: GamePlayer[];
  canEdit: boolean;
  onSave: (patch: Partial<Omit<ExternalGame, "id">>) => void;
}

/** A game played in rounds (egg race…): choose who runs each round, then note who came 1st, 2nd, 3rd. */
export default function ExternalRoundsGame({ game, pool, canEdit, onSave }: Props) {
  const players = playersFor(pool, game);
  const rounds = game.rounds ?? [];
  const ran = playedInRounds(rounds);
  const top = podium(game);

  // The round being set up
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [count, setCount] = useState(6);
  const [fresh, setFresh] = useState(true); // draw only from people who haven't run yet
  const [selected, setSelected] = useState<GamePlayer[]>([]);
  const [search, setSearch] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const chosen = new Set(selected.map((p) => p.id));
  const shown = search ? players.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())) : players;

  function openForm(prefillName?: string, prefill: GamePlayer[] = []) {
    setName(prefillName ?? nextRoundName(rounds));
    setSelected(prefill);
    setSearch("");
    setNote(null);
    setCreating(true);
  }

  function draw() {
    const candidates = fresh ? players.filter((p) => !ran.has(p.id)) : players;
    const drawn = drawPlayers(candidates, count);
    setSelected(drawn);
    setNote(
      drawn.length < count
        ? `Only ${drawn.length} ${fresh ? "haven’t run yet" : "can play"}. Tick more by hand, or draw from everyone.`
        : null
    );
  }

  function toggleSelected(p: GamePlayer) {
    setSelected((prev) => (prev.some((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [...prev, p]));
  }

  function createRound() {
    if (selected.length === 0) return setNote("Pick at least one person for this round.");
    const round: ExternalRound = { id: newLocalId("round"), name: name.trim() || nextRoundName(rounds), players: selected, placings: [] };
    onSave({ rounds: [...rounds, round] });
    setCreating(false);
  }

  function updateRound(next: ExternalRound) {
    onSave({ rounds: rounds.map((r) => (r.id === next.id ? next : r)) });
  }

  function deleteRound(round: ExternalRound) {
    if (!window.confirm(`Delete “${round.name}”?`)) return;
    onSave({ rounds: rounds.filter((r) => r.id !== round.id) });
  }

  const winners = roundWinners(rounds, players);

  return (
    <div className="space-y-4">
      {top && (
        <div className="rounded-xl bg-rccg-purple-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{top.round.name}</p>
          <p className="mt-0.5 text-sm font-semibold text-rccg-purple-800">
            {top.places
              .slice(0, 3)
              .map((p) => `${ordinal(p.place)} ${p.player.name}`)
              .join(" · ")}
          </p>
        </div>
      )}

      {rounds.length === 0 && !creating && <p className="text-sm text-muted">No rounds yet.</p>}

      {rounds.map((round) => (
        <RoundCard
          key={round.id}
          round={round}
          available={players.filter((p) => !round.players.some((x) => x.id === p.id))}
          canEdit={canEdit}
          onChange={updateRound}
          onDelete={() => deleteRound(round)}
        />
      ))}

      {canEdit && !creating && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => openForm()} className="btn-primary btn-sm">
            Add a round
          </button>
          {winners.length > 1 && (
            <button onClick={() => openForm("Final", winners)} className="btn-secondary btn-sm">
              Final from the round winners ({winners.length})
            </button>
          )}
        </div>
      )}

      {creating && canEdit && (
        <div className="space-y-4 rounded-xl border border-line bg-mist p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="block">
              <span className="label">Round name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
            </label>
            <div className="flex items-end gap-2">
              <label className="block">
                <span className="label">How many run</span>
                <input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} className="input w-24" />
              </label>
              <button type="button" onClick={draw} className="btn-secondary">
                Draw at random
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={fresh} onChange={(e) => setFresh(e.target.checked)} className="h-4 w-4 accent-rccg-green-600" />
            Only draw people who haven&rsquo;t run in an earlier round
          </label>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="label !mb-0">
                In this round: <span className="num">{selected.length}</span>
              </span>
              {selected.length > 0 && (
                <button type="button" onClick={() => setSelected([])} className="btn-ghost btn-sm !text-muted">
                  Clear
                </button>
              )}
            </div>
            <p className="mb-2 text-xs text-muted">Drawn names appear ticked. Tick or untick anyone to change who runs, or pick everyone by hand.</p>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" aria-label="Search people" className="input mb-2 py-1.5" />
            <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-md border border-line bg-white text-sm">
              {shown.map((p) => (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2">
                    <input type="checkbox" checked={chosen.has(p.id)} onChange={() => toggleSelected(p)} className="h-4 w-4 accent-rccg-green-600" />
                    <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                    {ran.has(p.id) && <span className="text-xs text-muted">has run</span>}
                  </label>
                </li>
              ))}
              {shown.length === 0 && <li className="px-3 py-4 text-center text-muted">{search ? `No one matches “${search}”.` : "No one available to play."}</li>}
            </ul>
          </div>

          {note && <p className="text-sm text-amber-800">{note}</p>}

          <div className="flex gap-2">
            <button type="button" onClick={createRound} className="btn-primary">
              Create round
            </button>
            <button type="button" onClick={() => setCreating(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RoundCard({
  round,
  available,
  canEdit,
  onChange,
  onDelete,
}: {
  round: ExternalRound;
  available: GamePlayer[];
  canEdit: boolean;
  onChange: (round: ExternalRound) => void;
  onDelete: () => void;
}) {
  // Placed people first, in order; everyone else after, in the order they were picked.
  const placed = round.placings.map((id) => round.players.find((p) => p.id === id)).filter((p): p is GamePlayer => !!p);
  const rest = round.players.filter((p) => !round.placings.includes(p.id));

  function removePlayer(id: string) {
    onChange({ ...round, players: round.players.filter((p) => p.id !== id), placings: round.placings.filter((x) => x !== id) });
  }

  function addPlayer(id: string) {
    const p = available.find((x) => x.id === id);
    if (p) onChange({ ...round, players: [...round.players, p] });
  }

  return (
    <div className="rounded-xl border border-line p-3">
      <div className="mb-2 flex items-center gap-2">
        {canEdit ? (
          <input
            key={round.name}
            defaultValue={round.name}
            onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== round.name && onChange({ ...round, name: e.target.value.trim() })}
            aria-label="Round name"
            className="input min-w-0 flex-1 py-1 font-semibold"
          />
        ) : (
          <p className="flex-1 font-semibold text-rccg-purple-800">{round.name}</p>
        )}
        <span className="text-xs text-muted">
          {round.placings.length} of {round.players.length} placed
        </span>
        {canEdit && (
          <button onClick={onDelete} className="btn-ghost-danger btn-sm" aria-label={`Delete ${round.name}`}>
            Delete
          </button>
        )}
      </div>

      <ul className="space-y-1">
        {[...placed, ...rest].map((p) => {
          const place = round.placings.indexOf(p.id) + 1;
          return (
            <li key={p.id} className="flex items-center gap-2 rounded-md bg-mist px-2 py-1 text-sm">
              <span
                className={[
                  "num flex h-7 min-w-[2.75rem] items-center justify-center rounded-full text-xs font-bold",
                  place ? "bg-rccg-green-600 text-white" : "bg-white text-muted",
                ].join(" ")}
              >
                {place ? ordinal(place) : "—"}
              </span>
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {canEdit && (
                <>
                  <button onClick={() => onChange(togglePlacing(round, p.id))} className={place ? "btn-ghost btn-sm !text-muted" : "btn-secondary btn-sm"}>
                    {place ? "Clear place" : `Give ${ordinal(round.placings.length + 1)}`}
                  </button>
                  <button onClick={() => removePlayer(p.id)} className="btn-ghost btn-sm !text-muted" aria-label={`Take ${p.name} out of ${round.name}`}>
                    ×
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {canEdit && available.length > 0 && (
        <select
          value=""
          onChange={(e) => e.target.value && addPlayer(e.target.value)}
          aria-label={`Add someone to ${round.name}`}
          className="input mt-2 py-1.5 text-sm"
        >
          <option value="">Add someone to this round…</option>
          {available.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
