"use client";

import { useState } from "react";
import {
  MAX_EXTERNAL_TEAMS,
  defaultTeamNames,
  leadingTeams,
  makeTeams,
  moveToTeam,
  playersFor,
  rankTeams,
  unplacedPlayers,
} from "@/lib/externalGames";
import { Notice } from "@/components/ui";
import type { ExternalGame, GamePlayer, GameSide, TeamPick } from "@/types/games";

interface Props {
  game: ExternalGame;
  pool: GamePlayer[];
  canEdit: boolean;
  onSave: (patch: Partial<Omit<ExternalGame, "id">>) => void;
}

const PICK_LABEL: Record<TeamPick, { title: string; text: string }> = {
  gender: { title: "Boys vs Girls", text: "The system puts every boy on one team and every girl on the other." },
  random: { title: "Random draw", text: "The system shuffles everyone into teams as evenly as it can." },
  manual: { title: "Pick by hand", text: "Empty teams, and you place each person yourself." },
};

/** A team game (football, tug of war…): make the teams, change them any time, and keep the score. */
export default function ExternalTeamsGame({ game, pool, canEdit, onSave }: Props) {
  const players = playersFor(pool, game);
  const sides = game.sides ?? [];
  const scores = game.scores ?? {};

  const [pick, setPick] = useState<TeamPick>("gender");
  const [count, setCount] = useState(2);
  const [spread, setSpread] = useState(true);

  function build(how: TeamPick, names?: string[]) {
    const teamNames = names ?? (how === "gender" ? ["Boys", "Girls"] : defaultTeamNames(count));
    const made = makeTeams(how, players, teamNames, spread);
    onSave({ sides: made, scores: Object.fromEntries(made.map((s) => [s.id, 0])) });
  }

  /* ---------------------------- before teams exist ---------------------------- */
  if (sides.length === 0) {
    if (!canEdit) return <p className="text-sm text-muted">Teams haven&rsquo;t been made yet.</p>;
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">
          <span className="num font-semibold text-ink">{players.length}</span> {players.length === 1 ? "person" : "people"} can play
          {game.hosts.length > 0 && ", not counting the host"}. You can change the teams afterwards.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(PICK_LABEL) as TeamPick[]).map((p) => (
            <label
              key={p}
              className={[
                "flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm transition-colors",
                pick === p ? "border-rccg-green-500 bg-rccg-green-50" : "border-line bg-white hover:border-rccg-purple-300",
              ].join(" ")}
            >
              <input type="radio" name={`pick-${game.id}`} checked={pick === p} onChange={() => setPick(p)} className="mt-0.5 accent-rccg-green-600" />
              <span>
                <span className="block font-medium">{PICK_LABEL[p].title}</span>
                <span className="block text-xs text-muted">{PICK_LABEL[p].text}</span>
              </span>
            </label>
          ))}
        </div>

        {pick !== "gender" && (
          <div className="flex flex-wrap items-end gap-4">
            <label className="block">
              <span className="label">Number of teams</span>
              <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="input w-28">
                {Array.from({ length: MAX_EXTERNAL_TEAMS - 1 }, (_, i) => i + 2).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            {pick === "random" && (
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input type="checkbox" checked={spread} onChange={(e) => setSpread(e.target.checked)} className="h-4 w-4 accent-rccg-green-600" />
                Give every team a similar mix of boys and girls
              </label>
            )}
          </div>
        )}

        <button onClick={() => build(pick)} className="btn-primary" disabled={pick !== "manual" && players.length < 2}>
          {pick === "manual" ? "Make empty teams" : "Make the teams"}
        </button>
      </div>
    );
  }

  /* ----------------------------- teams and score ----------------------------- */
  const ranked = rankTeams(game);
  const lead = leadingTeams(game);
  const unplaced = unplacedPlayers(players, sides);

  function setSides(next: GameSide[]) {
    onSave({ sides: next });
  }

  function setScore(sideId: string, value: number) {
    onSave({ scores: { ...scores, [sideId]: Math.max(0, Math.round(value) || 0) } });
  }

  function rename(sideId: string, name: string) {
    const clean = name.trim();
    if (!clean) return;
    setSides(sides.map((s) => (s.id === sideId ? { ...s, name: clean } : s)));
  }

  function addTeam() {
    const n = sides.length + 1;
    const id = `team-${Date.now().toString(36)}`;
    onSave({
      sides: [...sides, { id, name: `Team ${String.fromCharCode(64 + n)}`, members: [] }],
      scores: { ...scores, [id]: 0 },
    });
  }

  function removeTeam(side: GameSide) {
    const { [side.id]: _gone, ...rest } = scores;
    void _gone;
    onSave({ sides: sides.filter((s) => s.id !== side.id), scores: rest });
  }

  function reshuffle() {
    const names = sides.map((s) => s.name);
    const made = makeTeams("random", players, names, spread);
    // Keep each team's id so its score stays where it was.
    const kept = made.map((s, i) => ({ ...s, id: sides[i].id }));
    setSides(kept);
  }

  function startOver() {
    if (!window.confirm("Clear the teams and the score and start again?")) return;
    onSave({ sides: [], scores: {} });
  }

  const scoreLine =
    ranked.every((r) => r.score === 0) ? "No score yet" : lead.length > 1 ? "Draw" : `${lead[0]?.name} ${game.status === "finished" ? "won" : "is leading"}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-rccg-purple-800">{scoreLine}</p>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <button onClick={reshuffle} className="btn-secondary btn-sm" title="Deal everyone into the same number of teams again at random">
              Shuffle again
            </button>
            {sides.length < MAX_EXTERNAL_TEAMS && (
              <button onClick={addTeam} className="btn-secondary btn-sm">
                Add a team
              </button>
            )}
            <button onClick={startOver} className="btn-ghost btn-sm !text-muted">
              Start over
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {sides.map((side) => (
          <div key={side.id} className="rounded-xl border border-line bg-mist p-3">
            <div className="flex items-center gap-2">
              {canEdit ? (
                <input
                  key={side.name}
                  defaultValue={side.name}
                  onBlur={(e) => e.target.value.trim() !== side.name && rename(side.id, e.target.value)}
                  aria-label="Team name"
                  className="input min-w-0 flex-1 py-1 font-semibold"
                />
              ) : (
                <p className="flex-1 font-semibold text-rccg-purple-800">{side.name}</p>
              )}
              {canEdit && sides.length > 2 && (
                <button onClick={() => removeTeam(side)} className="btn-ghost btn-sm !text-muted" aria-label={`Remove ${side.name}`}>
                  ×
                </button>
              )}
            </div>

            <div className="my-3 flex items-center justify-center gap-3">
              {canEdit && (
                <button onClick={() => setScore(side.id, (scores[side.id] ?? 0) - 1)} className="btn-secondary btn-sm h-9 w-9" aria-label={`Take a point off ${side.name}`}>
                  −
                </button>
              )}
              <span className="num min-w-[3ch] text-center font-display text-4xl font-bold text-rccg-purple-800">{scores[side.id] ?? 0}</span>
              {canEdit && (
                <button onClick={() => setScore(side.id, (scores[side.id] ?? 0) + 1)} className="btn-primary btn-sm h-9 w-9" aria-label={`Add a point to ${side.name}`}>
                  +
                </button>
              )}
            </div>

            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
              {side.members.length} {side.members.length === 1 ? "player" : "players"}
            </p>
            <ul className="space-y-1">
              {side.members.map((m) => (
                <li key={m.id} className="flex items-center gap-2 rounded-md bg-white px-2 py-1 text-sm">
                  <span className="min-w-0 flex-1 truncate">{m.name}</span>
                  {canEdit && (
                    <select
                      value=""
                      onChange={(e) => e.target.value && setSides(moveToTeam(sides, m, e.target.value === "none" ? "" : e.target.value))}
                      aria-label={`Move ${m.name}`}
                      className="rounded border border-line bg-white px-1 py-0.5 text-xs text-muted"
                    >
                      <option value="">Move…</option>
                      {sides
                        .filter((s) => s.id !== side.id)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            To {s.name}
                          </option>
                        ))}
                      <option value="none">Take off teams</option>
                    </select>
                  )}
                </li>
              ))}
              {side.members.length === 0 && <li className="text-xs text-muted">No one yet.</li>}
            </ul>
          </div>
        ))}
      </div>

      {unplaced.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Not on a team yet ({unplaced.length})</p>
          <ul className="flex flex-wrap gap-2">
            {unplaced.map((p) => (
              <li key={p.id} className="flex items-center gap-1 rounded-full border border-line bg-white py-0.5 pl-3 pr-1 text-sm">
                {p.name}
                {canEdit && (
                  <select
                    value=""
                    onChange={(e) => e.target.value && setSides(moveToTeam(sides, p, e.target.value))}
                    aria-label={`Put ${p.name} on a team`}
                    className="rounded-full border-0 bg-rccg-purple-100 px-2 py-0.5 text-xs text-rccg-purple-800"
                  >
                    <option value="">Add to…</option>
                    {sides.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {unplaced.some((p) => !p.gender) && (
        <Notice tone="info">Guests have no gender on record, so a Boys vs Girls draw leaves them for you to place.</Notice>
      )}
    </div>
  );
}
