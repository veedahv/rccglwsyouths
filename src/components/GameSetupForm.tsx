"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatPersonName } from "@/lib/formatName";
import { dealIntoTeams, genderSides, individualSides, newGuestId, shuffle, teamSides } from "@/lib/games";
import { Field, Notice } from "@/components/ui";
import { GAME_LABEL, MODE_LABEL, gameHasHints } from "@/types/games";
import type { GameKind, GameMode, GamePlayer, GameQuestion, GameSide } from "@/types/games";
import type { Youth } from "@/types";

export interface GameDraft {
  title: string;
  game: GameKind;
  mode: GameMode;
  sides: GameSide[];
  categories: string[];
  roundCount: number;
  timerSeconds: number; // 0 means no timer
  showHints: boolean;
}

interface Props {
  youths: Youth[]; // active youths
  questions: GameQuestion[]; // the whole question bank
  saving: boolean;
  onSubmit: (draft: GameDraft) => void;
}

const GAMES: { value: GameKind; description: string }[] = [
  { value: "scramble", description: "Unscramble the letters. Characters, Bible words, books, places and more." },
  { value: "bibleOrCap", description: "A quote is shown. Is it Scripture, or is it cap (a saying that is not in the Bible)?" },
  { value: "emoji", description: "A few emojis are shown. Guess the Bible story, character or miracle." },
  { value: "fillBlank", description: "A verse is shown with a word missing. Who can fill it in?" },
  { value: "whoAmI", description: "Clues about a Bible person are revealed one at a time. The sooner you guess, the more points." },
  { value: "board", description: "A grid of categories and point levels, like a quiz show. Sides take turns picking a tile." },
];

const MODES: { value: GameMode; description: string }[] = [
  { value: "gender", description: "Two sides, Boys and Girls. Points go to whichever side answers." },
  { value: "teams", description: "Team A vs Team B (up to four teams), with players dealt in or picked." },
  { value: "duel", description: "One youth against another. Either can be a guest." },
  { value: "selected", description: "Pick the youths who play. Each plays for themselves. Guests can join." },
  { value: "random", description: "The app draws youths at random. Each plays for themselves." },
];

const MAX_TEAMS = 4;
const MAX_BOARD_CATEGORIES = 6;

function toPlayer(y: Youth): GamePlayer {
  return { id: y.id, name: formatPersonName(y.name, y.gender), gender: y.gender };
}

export default function GameSetupForm({ youths, questions, saving, onSubmit }: Props) {
  const [title, setTitle] = useState("Game night");
  const [game, setGame] = useState<GameKind>("scramble");
  const [categories, setCategories] = useState<string[]>([]);
  const [roundCount, setRoundCount] = useState(10);
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [showHints, setShowHints] = useState(true);
  const [mode, setMode] = useState<GameMode>("gender");
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [teamCount, setTeamCount] = useState(2);
  const [teamNames, setTeamNames] = useState<string[]>(["Team A", "Team B", "Team C", "Team D"]);
  const [manualTeam, setManualTeam] = useState<Record<string, number>>({});
  const [drawCount, setDrawCount] = useState(4);
  const [search, setSearch] = useState("");
  const [guestName, setGuestName] = useState("");
  const [error, setError] = useState<string | null>(null);

  /* ----- content ----- */

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const q of questions) if (q.game === game) counts.set(q.category, (counts.get(q.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [questions, game]);

  const available = categoryCounts
    .filter(([name]) => categories.includes(name))
    .reduce((sum, [, n]) => sum + n, 0);

  function changeGame(next: GameKind) {
    setGame(next);
    setCategories([]);
  }

  function toggleCategory(name: string) {
    setCategories((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));
  }

  /* ----- players ----- */

  const playerCap = mode === "duel" ? 2 : Infinity;
  const chosen = new Set(players.map((p) => p.id));
  const shownYouths = search ? youths.filter((y) => y.name.toLowerCase().includes(search.toLowerCase())) : youths;

  function changeMode(next: GameMode) {
    setMode(next);
    setPlayers([]);
    setManualTeam({});
    setError(null);
  }

  function toggleYouth(y: Youth) {
    if (chosen.has(y.id)) setPlayers(players.filter((p) => p.id !== y.id));
    else if (players.length < playerCap) setPlayers([...players, toPlayer(y)]);
  }

  function addGuest() {
    const name = guestName.trim();
    if (!name || players.length >= playerCap) return;
    setPlayers([...players, { id: newGuestId(), name: `${name} (guest)`, guest: true }]);
    setGuestName("");
  }

  function removePlayer(id: string) {
    setPlayers(players.filter((p) => p.id !== id));
  }

  function draw() {
    const pool = youths.map(toPlayer);
    const keepGuests = players.filter((p) => p.guest);
    setPlayers([...shuffle(pool).slice(0, Math.max(0, drawCount - keepGuests.length)), ...keepGuests]);
  }

  /* ----- teams ----- */

  // Anyone without a manual choice is spread across the teams in order, so
  // adding players keeps the teams roughly even without extra clicks.
  const teamOf = useMemo(() => {
    const out: Record<string, number> = {};
    const counts = Array<number>(teamCount).fill(0);
    for (const p of players) {
      const m = manualTeam[p.id];
      if (m !== undefined && m < teamCount) {
        out[p.id] = m;
        counts[m]++;
      }
    }
    for (const p of players) {
      if (out[p.id] === undefined) {
        const t = counts.indexOf(Math.min(...counts));
        out[p.id] = t;
        counts[t]++;
      }
    }
    return out;
  }, [players, manualTeam, teamCount]);

  function shuffleTeams() {
    setManualTeam(dealIntoTeams(players, teamCount));
  }

  /* ----- submit ----- */

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) return setError("Give the session a title.");
    if (categories.length === 0) return setError("Pick at least one category to play from.");
    if (game === "board") {
      if (categories.length < 2) return setError("Pick at least two categories for the board.");
      if (categories.length > MAX_BOARD_CATEGORIES) return setError(`Pick at most ${MAX_BOARD_CATEGORIES} categories so the board stays readable.`);
    } else if (roundCount < 1) {
      return setError("Set at least one round.");
    }
    if (!Number.isFinite(timerSeconds) || timerSeconds < 0 || timerSeconds > 3600) {
      return setError("Set the timer between 0 and 3600 seconds, or 0 for no timer.");
    }
    if (mode === "duel" && players.length !== 2) return setError("A 1 vs 1 needs exactly two players.");
    if ((mode === "selected" || mode === "random") && players.length < 2) {
      return setError(mode === "random" ? "Draw at least two players first." : "Pick at least two players.");
    }

    let sides: GameSide[];
    if (mode === "gender") sides = genderSides();
    else if (mode === "teams") sides = teamSides(teamNames.slice(0, teamCount), teamOf, players);
    else sides = individualSides(players);

    onSubmit({
      title: title.trim(),
      game,
      mode,
      sides,
      categories,
      roundCount: game === "board" ? 0 : Math.min(roundCount, Math.max(available, 1)),
      timerSeconds: Math.round(timerSeconds),
      showHints: gameHasHints(game) ? showHints : true,
    });
  }

  const noQuestions = questions.filter((q) => q.game === game).length === 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Field label="Session title">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" required />
      </Field>

      {/* ---------- what to play ---------- */}
      <fieldset className="space-y-3">
        <legend className="label">What are we playing?</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES.map((g) => (
            <label
              key={g.value}
              className={[
                "flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-sm transition-colors",
                game === g.value ? "border-rccg-green-500 bg-rccg-green-50" : "border-line bg-white hover:border-rccg-purple-300",
              ].join(" ")}
            >
              <span className="flex items-center gap-2 font-medium">
                <input
                  type="radio"
                  name="game-kind"
                  checked={game === g.value}
                  onChange={() => changeGame(g.value)}
                  className="accent-rccg-green-600"
                />
                {GAME_LABEL[g.value]}
              </span>
              <span className="text-xs text-muted">{g.description}</span>
            </label>
          ))}
        </div>

        {noQuestions ? (
          <Notice tone="warning">
            There are no {GAME_LABEL[game]} questions yet.{" "}
            <Link href="/games/questions" className="link">
              Open the question bank
            </Link>{" "}
            to load the starter set or add your own.
          </Notice>
        ) : (
          <div className="rounded-lg border border-line bg-white p-3">
            <p className="mb-2 text-sm text-muted">{game === "board" ? "Board categories (pick 2 to 6)" : "Categories to draw from"}</p>
            <div className="flex flex-wrap gap-2">
              {categoryCounts.map(([name, n]) => (
                <label
                  key={name}
                  className={[
                    "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-sm",
                    categories.includes(name) ? "border-rccg-green-500 bg-rccg-green-50" : "border-line hover:border-rccg-purple-300",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    checked={categories.includes(name)}
                    onChange={() => toggleCategory(name)}
                    className="h-3.5 w-3.5 accent-rccg-green-600"
                  />
                  {name} <span className="num text-xs text-muted">{n}</span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {game !== "board" && (
                <Field label="Number of rounds" className="w-40">
                  <input
                    type="number"
                    min={1}
                    max={Math.max(available, 1)}
                    value={roundCount}
                    onChange={(e) => setRoundCount(Number(e.target.value))}
                    className="input"
                  />
                </Field>
              )}
              <Field label={game === "board" ? "Seconds per clue" : "Seconds per round"} className="w-40" hint="0 means no timer.">
                <input
                  type="number"
                  min={0}
                  max={3600}
                  value={timerSeconds}
                  onChange={(e) => setTimerSeconds(Number(e.target.value))}
                  className="input"
                />
              </Field>
              {gameHasHints(game) && (
                <label className="flex cursor-pointer items-center gap-2 pt-5 text-sm">
                  <input
                    type="checkbox"
                    checked={showHints}
                    onChange={(e) => setShowHints(e.target.checked)}
                    className="h-4 w-4 accent-rccg-green-600"
                  />
                  Show hints
                </label>
              )}
              <p className="w-full text-xs text-muted">
                {categories.length === 0
                  ? "Pick a category to see how many questions are available."
                  : game === "board"
                    ? `The board gets one clue for each point level in each category you pick (${available} clues to draw from).`
                    : `${available} question${available === 1 ? "" : "s"} available. Each round is picked at random and never repeats.`}
              </p>
            </div>
          </div>
        )}
      </fieldset>

      {/* ---------- who plays ---------- */}
      <fieldset className="space-y-3">
        <legend className="label">Who is playing?</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((m) => (
            <label
              key={m.value}
              className={[
                "flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-sm transition-colors",
                mode === m.value ? "border-rccg-green-500 bg-rccg-green-50" : "border-line bg-white hover:border-rccg-purple-300",
              ].join(" ")}
            >
              <span className="flex items-center gap-2 font-medium">
                <input
                  type="radio"
                  name="game-mode"
                  checked={mode === m.value}
                  onChange={() => changeMode(m.value)}
                  className="accent-rccg-green-600"
                />
                {MODE_LABEL[m.value]}
              </span>
              <span className="text-xs text-muted">{m.description}</span>
            </label>
          ))}
        </div>

        {mode === "teams" && (
          <div className="rounded-lg border border-line bg-white p-3">
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <Field label="Number of teams" className="w-36">
                <select value={teamCount} onChange={(e) => setTeamCount(Number(e.target.value))} className="input">
                  {Array.from({ length: MAX_TEAMS - 1 }, (_, i) => i + 2).map((n) => (
                    <option key={n} value={n}>
                      {n} teams
                    </option>
                  ))}
                </select>
              </Field>
              {Array.from({ length: teamCount }, (_, i) => (
                <Field key={i} label={`Team ${i + 1} name`} className="w-36">
                  <input
                    value={teamNames[i]}
                    onChange={(e) => setTeamNames(teamNames.map((n, j) => (j === i ? e.target.value : n)))}
                    className="input"
                  />
                </Field>
              ))}
            </div>
            <p className="text-xs text-muted">
              Adding players is optional. Without them, the teams are just names on the scoreboard.
            </p>
          </div>
        )}

        {mode === "random" && (
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-3">
            <Field label="How many players?" className="w-40">
              <input
                type="number"
                min={2}
                max={Math.max(youths.length, 2)}
                value={drawCount}
                onChange={(e) => setDrawCount(Number(e.target.value))}
                className="input"
              />
            </Field>
            <button type="button" onClick={draw} className="btn-secondary" disabled={youths.length === 0}>
              {players.some((p) => !p.guest) ? "Draw again" : "Draw players"}
            </button>
            <p className="pb-2 text-xs text-muted">Drawn from {youths.length} active youths. Guests you add stay in.</p>
          </div>
        )}

        {mode !== "gender" && (
          <div className="rounded-lg border border-line bg-white p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted">
                <span className="num font-semibold text-ink">{players.length}</span>
                {playerCap !== Infinity ? ` of ${playerCap}` : ""} player{players.length === 1 ? "" : "s"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {mode === "teams" && players.length > 1 && (
                  <button type="button" onClick={shuffleTeams} className="btn-secondary btn-sm">
                    Shuffle into teams
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setPlayers([]);
                    setManualTeam({});
                  }}
                  disabled={players.length === 0}
                  className="btn-ghost btn-sm !text-muted"
                >
                  Clear
                </button>
              </div>
            </div>

            {players.length > 0 && (
              <ul className="mb-3 flex flex-wrap gap-2">
                {players.map((p) => (
                  <li key={p.id} className="flex items-center gap-1.5 rounded-full bg-rccg-purple-100 py-1 pl-3 pr-1.5 text-sm text-rccg-purple-800">
                    {p.name}
                    {mode === "teams" && (
                      <select
                        value={teamOf[p.id]}
                        onChange={(e) => setManualTeam({ ...manualTeam, [p.id]: Number(e.target.value) })}
                        aria-label={`Team for ${p.name}`}
                        className="rounded-md border border-line bg-white px-1 py-0.5 text-xs"
                      >
                        {Array.from({ length: teamCount }, (_, i) => (
                          <option key={i} value={i}>
                            {teamNames[i] || `Team ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={() => removePlayer(p.id)}
                      aria-label={`Remove ${p.name}`}
                      className="rounded-full px-1.5 text-rccg-purple-600 hover:bg-white"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {mode !== "random" && (
              <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <div>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search youths…"
                    aria-label="Search youths"
                    className="input mb-2 py-1.5"
                  />
                  <ul className="max-h-56 divide-y divide-line overflow-y-auto rounded-md border border-line text-sm">
                    {shownYouths.map((y) => {
                      const disabled = !chosen.has(y.id) && players.length >= playerCap;
                      return (
                        <li key={y.id}>
                          <label className={`flex items-center gap-3 px-3 py-2 ${disabled ? "opacity-50" : "cursor-pointer hover:bg-mist"}`}>
                            <input
                              type="checkbox"
                              checked={chosen.has(y.id)}
                              disabled={disabled}
                              onChange={() => toggleYouth(y)}
                              className="h-4 w-4 accent-rccg-green-600"
                            />
                            <span className="font-medium">{formatPersonName(y.name, y.gender)}</span>
                            {y.unit && <span className="text-xs text-muted">{y.unit}</span>}
                          </label>
                        </li>
                      );
                    })}
                    {shownYouths.length === 0 && (
                      <li className="px-3 py-4 text-center text-muted">
                        {search ? `No one matches “${search}”.` : "No active youths yet."}
                      </li>
                    )}
                  </ul>
                </div>
                <div className="lg:w-60">
                  <Field label="Add a guest" hint="Someone who isn't on the youths list.">
                    <div className="flex gap-2">
                      <input
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addGuest();
                          }
                        }}
                        placeholder="Guest name"
                        className="input"
                      />
                      <button
                        type="button"
                        onClick={addGuest}
                        disabled={!guestName.trim() || players.length >= playerCap}
                        className="btn-secondary"
                      >
                        Add
                      </button>
                    </div>
                  </Field>
                </div>
              </div>
            )}

            {mode === "random" && (
              <div className="flex flex-wrap items-end gap-2">
                <input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addGuest();
                    }
                  }}
                  placeholder="Add a guest (optional)"
                  className="input w-56"
                />
                <button type="button" onClick={addGuest} disabled={!guestName.trim()} className="btn-secondary">
                  Add guest
                </button>
              </div>
            )}
          </div>
        )}
      </fieldset>

      {error && <Notice tone="error">{error}</Notice>}

      <button disabled={saving || noQuestions} className="btn-primary">
        {saving ? "Starting…" : "Start session"}
      </button>
    </form>
  );
}
