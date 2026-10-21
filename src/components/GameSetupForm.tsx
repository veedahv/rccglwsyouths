"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatPersonName } from "@/lib/formatName";
import { dealIntoTeams, genderSides, individualSides, newGuestId, shuffle, teamSides } from "@/lib/games";
import { Field, Notice } from "@/components/ui";
import { GAME_LABEL, MODE_LABEL, gameAlwaysTurns, gameCanChoosePlayMode, gameHasHints } from "@/types/games";
import type { GameKind, GameMode, GamePlayer, GameQuestion, GameSide, PlayMode } from "@/types/games";
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
  playMode: PlayMode; // Who Am I? and the quiz board are always "turns"
  firstTurn: number; // index into `sides` of the side that goes first (used when playMode is "turns")
}

/** The sides of a game already played in this event, offered so the next game can reuse them. */
export interface ReusableLineup {
  label: string; // e.g. "Boys vs Girls"
  mode: GameMode;
  sides: GameSide[];
}

interface Props {
  youths: Youth[]; // active youths
  questions: GameQuestion[]; // the whole question bank
  saving: boolean;
  onSubmit: (draft: GameDraft) => void;
  // Inside a games event: the game to start on, and the sides of earlier games in the event.
  defaultGame?: GameKind;
  reuse?: ReusableLineup[];
  submitLabel?: string;
  // Inside a games event: the hosts, who are never picked, and who is present. With `attendance`
  // set, players are picked only from the people present (and guests who came); without it,
  // from every active youth.
  hosts?: GamePlayer[];
  attendance?: { presentIds: string[]; guests: GamePlayer[] } | null;
}

/** Someone who can be picked to play. */
interface Candidate {
  player: GamePlayer;
  unit?: string;
}

const GAMES: { value: GameKind; description: string }[] = [
  { value: "scramble", description: "Unscramble the letters. Characters, Bible words, books, places and more." },
  { value: "bibleOrCap", description: "A quote is shown. Is it Scripture, or is it cap (a saying that is not in the Bible)?" },
  { value: "emoji", description: "A few emojis are shown. Guess the Bible story, character or miracle." },
  { value: "bookGuess", description: "Emojis show one scene from a book of the Bible. Which book is it? Easy, medium and hard." },
  { value: "relay", description: "In person. Teams race to find a called verse in the Bible. The first team to find it wins the points." },
  { value: "spouseQuiz", description: "A Bible person is named. Who was their husband or wife? Some had more than one." },
  { value: "spouses", description: "A memory game. Flip two cards at a time to find Bible couples. Sides take turns." },
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

export default function GameSetupForm({ youths, questions, saving, onSubmit, defaultGame, reuse = [], submitLabel, hosts = [], attendance = null }: Props) {
  const inEvent = defaultGame !== undefined;
  const [title, setTitle] = useState(defaultGame ? GAME_LABEL[defaultGame] : "Game night");
  const [game, setGame] = useState<GameKind>(defaultGame ?? "scramble");
  // Same sides as an earlier game in the event, instead of picking players again.
  const [reused, setReused] = useState<ReusableLineup | null>(null);
  const [chosenPlayMode, setChosenPlayMode] = useState<PlayMode>("free");
  const [firstTurn, setFirstTurn] = useState<number | "random">("random");
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
  // People left out of picking, e.g. someone who is helping run the game or doesn't want to play.
  const [excluded, setExcluded] = useState<string[]>([]);
  const [guestName, setGuestName] = useState("");
  const [error, setError] = useState<string | null>(null);

  /* ----- content ----- */

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (game === "bookGuess") {
      // Several clues for one book count once: a game uses each book only once.
      const books = new Map<string, Set<string>>();
      for (const q of questions)
        if (q.game === game) books.set(q.category, (books.get(q.category) ?? new Set()).add((q.answer ?? "").trim().toLowerCase()));
      for (const [category, set] of books) counts.set(category, set.size);
    } else {
      for (const q of questions) if (q.game === game) counts.set(q.category, (counts.get(q.category) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [questions, game]);

  const questionCount = categoryCounts
    .filter(([name]) => categories.includes(name))
    .reduce((sum, [, n]) => sum + n, 0);

  function changeGame(next: GameKind) {
    // Inside an event the title is just the game's name, so keep it in step until it is edited.
    if (inEvent && title === GAME_LABEL[game]) setTitle(GAME_LABEL[next]);
    setGame(next);
    setCategories([]);
  }

  function toggleCategory(name: string) {
    setCategories((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));
  }

  /* ----- players ----- */

  const playerCap = mode === "duel" ? 2 : Infinity;
  const chosen = new Set(players.map((p) => p.id));

  // Who can be picked: the people present (or every active youth when attendance wasn't taken),
  // never the hosts.
  const pool = useMemo<Candidate[]>(() => {
    const hostIds = new Set(hosts.map((h) => h.id));
    const here = attendance ? new Set(attendance.presentIds) : null;
    const fromYouths = youths
      .filter((y) => !hostIds.has(y.id) && (!here || here.has(y.id)))
      .map((y) => ({ player: toPlayer(y), unit: y.unit }));
    const guests = (attendance?.guests ?? []).filter((g) => !hostIds.has(g.id)).map((g) => ({ player: g }));
    return [...fromYouths, ...guests];
  }, [youths, hosts, attendance]);
  // Excluded people are left out of every pick: by hand, drawn at random, or shuffled into teams.
  const available = pool.filter((c) => !excluded.includes(c.player.id));
  const shownPool = search ? available.filter((c) => c.player.name.toLowerCase().includes(search.toLowerCase())) : available;

  function toggleExcluded(id: string) {
    setExcluded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    // Someone already picked who is now left out comes off the list.
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  }

  function changeMode(next: GameMode) {
    setMode(next);
    setPlayers([]);
    setManualTeam({});
    setError(null);
  }

  function togglePlayer(c: Candidate) {
    if (chosen.has(c.player.id)) setPlayers(players.filter((p) => p.id !== c.player.id));
    else if (players.length < playerCap) setPlayers([...players, c.player]);
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
    // Guests added by hand stay in; the rest are drawn from whoever is available.
    const keepGuests = players.filter((p) => p.guest && !pool.some((c) => c.player.id === p.id));
    const drawn = shuffle(available.map((c) => c.player)).slice(0, Math.max(0, drawCount - keepGuests.length));
    setPlayers([...drawn, ...keepGuests]);
  }

  /** Teams: take everyone available and deal them into the teams at random. */
  function everyoneIntoTeams() {
    const kept = players.filter((p) => p.guest && !pool.some((c) => c.player.id === p.id));
    const everyone = shuffle([...available.map((c) => c.player), ...kept]);
    setPlayers(everyone);
    setManualTeam(dealIntoTeams(everyone, teamCount));
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

  /* ----- how it is played ----- */

  const playMode: PlayMode = gameAlwaysTurns(game) ? "turns" : game === "relay" ? "free" : chosenPlayMode;
  // The sides as they will be, so "who goes first" can list them before the game is created.
  const sidePreview: string[] = reused
    ? reused.sides.map((s) => s.name)
    : mode === "gender"
      ? genderSides().map((s) => s.name)
      : mode === "teams"
        ? teamNames.slice(0, teamCount).map((n, i) => n.trim() || `Team ${String.fromCharCode(65 + i)}`)
        : players.map((p) => p.name);

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
    if (game === "spouses" && (roundCount < 2 || roundCount > 10)) return setError("Choose between 2 and 10 couples.");
    if (!Number.isFinite(timerSeconds) || timerSeconds < 0 || timerSeconds > 3600) {
      return setError("Set the timer between 0 and 3600 seconds, or 0 for no timer.");
    }
    if (!reused && mode === "duel" && players.length !== 2) return setError("A 1 vs 1 needs exactly two players.");
    if (!reused && (mode === "selected" || mode === "random") && players.length < 2) {
      return setError(mode === "random" ? "Draw at least two players first." : "Pick at least two players.");
    }

    let sides: GameSide[];
    if (reused) sides = reused.sides;
    else if (mode === "gender") sides = genderSides();
    else if (mode === "teams") sides = teamSides(teamNames.slice(0, teamCount), teamOf, players);
    else sides = individualSides(players);

    // "Random" is settled here, once the sides are known. A choice that no longer exists (fewer
    // teams than before) falls back to a random side too.
    const first =
      typeof firstTurn === "number" && firstTurn < sides.length ? firstTurn : Math.floor(Math.random() * Math.max(sides.length, 1));

    onSubmit({
      title: title.trim(),
      game,
      mode: reused ? reused.mode : mode,
      sides,
      categories,
      roundCount: game === "board" ? 0 : Math.min(roundCount, Math.max(questionCount, 1)),
      timerSeconds: game === "spouses" ? 0 : Math.round(timerSeconds), // a memory game has no countdown
      showHints: gameHasHints(game) ? showHints : true,
      playMode,
      firstTurn: first,
    });
  }

  const noQuestions = questions.filter((q) => q.game === game).length === 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Field label={inEvent ? "Game title" : "Session title"}>
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
                <Field label={game === "spouses" ? "Number of couples" : "Number of rounds"} className="w-40">
                  <input
                    type="number"
                    min={1}
                    max={Math.max(questionCount, 1)}
                    value={roundCount}
                    onChange={(e) => setRoundCount(Number(e.target.value))}
                    className="input"
                  />
                </Field>
              )}
              {game !== "spouses" && (
              <Field
                label={game === "board" ? "Seconds per clue" : game === "relay" ? "Seconds to find it" : "Seconds per round"}
                className="w-40"
                hint="0 means no timer."
              >
                <input
                  type="number"
                  min={0}
                  max={3600}
                  value={timerSeconds}
                  onChange={(e) => setTimerSeconds(Number(e.target.value))}
                  className="input"
                />
              </Field>
              )}
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
                    ? `The board gets one clue for each point level in each category you pick (${questionCount} clues to draw from).`
                    : `${questionCount} question${questionCount === 1 ? "" : "s"} available. Each round is picked at random and never repeats.`}
              </p>
            </div>
          </div>
        )}
      </fieldset>

      {/* ---------- who plays ---------- */}
      <fieldset className="space-y-3">
        <legend className="label">Who is playing?</legend>

        {reuse.length > 0 && (
          <div className="rounded-lg border border-line bg-white p-3">
            <p className="mb-2 text-sm text-muted">Same sides as a game already in this event? Their points are added up into one overall result.</p>
            <div className="flex flex-wrap gap-2">
              {reuse.map((r) => (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => setReused(reused?.label === r.label ? null : r)}
                  className={reused?.label === r.label ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
                >
                  {r.label}
                </button>
              ))}
              {reused && (
                <button type="button" onClick={() => setReused(null)} className="btn-ghost btn-sm !text-muted">
                  Choose different sides
                </button>
              )}
            </div>
          </div>
        )}

        {reused ? (
          <Notice tone="info">
            Playing as <span className="font-semibold">{reused.label}</span>, the same sides as before.
          </Notice>
        ) : (
        <>
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
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={everyoneIntoTeams} disabled={available.length === 0} className="btn-secondary btn-sm">
                {attendance ? "Add everyone present and shuffle into teams" : "Add everyone and shuffle into teams"}
              </button>
              <p className="text-xs text-muted">
                Or pick players yourself below. Adding players is optional. Without them, the teams are just names on the scoreboard.
              </p>
            </div>
          </div>
        )}

        {mode === "random" && (
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-3">
            <Field label="How many players?" className="w-40">
              <input
                type="number"
                min={2}
                max={Math.max(available.length, 2)}
                value={drawCount}
                onChange={(e) => setDrawCount(Number(e.target.value))}
                className="input"
              />
            </Field>
            <button type="button" onClick={draw} className="btn-secondary" disabled={available.length === 0}>
              {players.some((p) => !p.guest) ? "Draw again" : "Draw players"}
            </button>
            <p className="pb-2 text-xs text-muted">Drawn from {available.length} {attendance ? "people present" : "active youths"}. Guests you add stay in.</p>
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
                    {shownPool.map((c) => {
                      const disabled = !chosen.has(c.player.id) && players.length >= playerCap;
                      return (
                        <li key={c.player.id}>
                          <label className={`flex items-center gap-3 px-3 py-2 ${disabled ? "opacity-50" : "cursor-pointer hover:bg-mist"}`}>
                            <input
                              type="checkbox"
                              checked={chosen.has(c.player.id)}
                              disabled={disabled}
                              onChange={() => togglePlayer(c)}
                              className="h-4 w-4 accent-rccg-green-600"
                            />
                            <span className="font-medium">{c.player.name}</span>
                            {c.unit && <span className="text-xs text-muted">{c.unit}</span>}
                          </label>
                        </li>
                      );
                    })}
                    {shownPool.length === 0 && (
                      <li className="px-3 py-4 text-center text-muted">
                        {search ? `No one matches “${search}”.` : attendance ? "No one is marked present yet." : "No active youths yet."}
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
        </>
        )}

        {mode !== "gender" && (
          <div className="rounded-lg border border-line bg-white p-3">
            <p className="text-sm text-muted">
              Picking from <span className="num font-semibold text-ink">{available.length}</span>{" "}
              {attendance ? "people marked present" : "active youths"}
              {hosts.length > 0 && <>, not counting the {hosts.length === 1 ? "host" : "hosts"} ({hosts.map((h) => h.name).join(", ")})</>}
              {excluded.length > 0 && <>, with {excluded.length} left out</>}.
            </p>
            {pool.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-medium">Leave some people out of the picking{excluded.length > 0 ? ` (${excluded.length})` : ""}</summary>
                <ul className="mt-2 flex max-h-44 flex-wrap gap-2 overflow-y-auto">
                  {pool.map((c) => {
                    const out = excluded.includes(c.player.id);
                    return (
                      <li key={c.player.id}>
                        <label
                          className={[
                            "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-sm",
                            out ? "border-rccg-red-600 bg-rccg-red-50 text-rccg-red-700 line-through" : "border-line hover:border-rccg-purple-300",
                          ].join(" ")}
                        >
                          <input type="checkbox" checked={out} onChange={() => toggleExcluded(c.player.id)} className="h-3.5 w-3.5 accent-rccg-red-600" />
                          {c.player.name}
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-1 text-xs text-muted">Tick someone to leave them out. They won&rsquo;t be drawn, shuffled into a team or listed for picking.</p>
              </details>
            )}
          </div>
        )}
      </fieldset>

      {/* ---------- how it is played ---------- */}
      <fieldset className="space-y-3">
        <legend className="label">How are questions answered?</legend>
        {gameCanChoosePlayMode(game) ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { value: "free", title: "First to answer", description: "Whoever answers first gets the points. You tap that side." },
                { value: "turns", title: "Turn by turn", description: "One side answers at a time. A miss can be passed on for half points, or to no one." },
              ] as const
            ).map((m) => (
              <label
                key={m.value}
                className={[
                  "flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-sm transition-colors",
                  chosenPlayMode === m.value ? "border-rccg-green-500 bg-rccg-green-50" : "border-line bg-white hover:border-rccg-purple-300",
                ].join(" ")}
              >
                <span className="flex items-center gap-2 font-medium">
                  <input
                    type="radio"
                    name="play-mode"
                    checked={chosenPlayMode === m.value}
                    onChange={() => setChosenPlayMode(m.value)}
                    className="accent-rccg-green-600"
                  />
                  {m.title}
                </span>
                <span className="text-xs text-muted">{m.description}</span>
              </label>
            ))}
          </div>
        ) : game === "relay" ? (
          <p className="text-sm text-muted">The Bible Relay is a race. The first team to find the verse wins the points, so there are no turns.</p>
        ) : (
          <p className="text-sm text-muted">
            {GAME_LABEL[game]} is always turn by turn. A side that misses can pass the question on for half points, or give it to no one.
          </p>
        )}

        {playMode === "turns" && (
          <Field
            label={game === "board" ? "Who picks the first tile?" : "Who goes first?"}
            hint="The next question moves on to the following side each time."
            className="max-w-xs"
          >
            <select
              value={firstTurn}
              onChange={(e) => setFirstTurn(e.target.value === "random" ? "random" : Number(e.target.value))}
              className="input"
            >
              <option value="random">Pick at random</option>
              {sidePreview.map((name, i) => (
                <option key={i} value={i}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </fieldset>

      {error && <Notice tone="error">{error}</Notice>}

      <button disabled={saving || noQuestions} className="btn-primary">
        {saving ? "Starting…" : (submitLabel ?? "Start session")}
      </button>
    </form>
  );
}
