import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, updateDoc, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";
import { shuffle } from "./games";
import type { ExternalGame, ExternalRound, GamePlayer, GameSide, TeamPick } from "@/types/games";

/** Firestore rejects `undefined` anywhere in a document, so strip it out. */
function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => clean(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = clean(v);
    }
    return out as T;
  }
  return value;
}

const externalCol = (eventId: string) => collection(db, "gameEvents", eventId, "externalGames");

function byCreated(a: ExternalGame, b: ExternalGame) {
  return a.createdAt.localeCompare(b.createdAt);
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

/** Every external game of a games event, oldest first, kept live. */
export function subscribeExternalGames(
  eventId: string,
  onChange: (games: ExternalGame[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    externalCol(eventId),
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExternalGame, "id">) })).sort(byCreated)),
    (err) => onError?.(err)
  );
}

export async function listExternalGames(eventId: string): Promise<ExternalGame[]> {
  const snap = await getDocs(externalCol(eventId));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExternalGame, "id">) })).sort(byCreated);
}

export async function addExternalGame(
  eventId: string,
  data: Pick<ExternalGame, "title" | "format" | "hosts">
): Promise<string> {
  const game: Omit<ExternalGame, "id"> = {
    title: data.title.trim(),
    format: data.format,
    hosts: data.hosts,
    status: "live",
    ...(data.format === "rounds" ? { rounds: [] } : {}),
    createdAt: new Date().toISOString(),
  };
  const ref = await addDoc(externalCol(eventId), clean(game));
  return ref.id;
}

export async function updateExternalGame(eventId: string, id: string, patch: Partial<Omit<ExternalGame, "id">>): Promise<void> {
  await updateDoc(doc(db, "gameEvents", eventId, "externalGames", id), clean(patch));
}

export async function deleteExternalGame(eventId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, "gameEvents", eventId, "externalGames", id));
}

/* ------------------------------------------------------------------ */
/* Ids                                                                 */
/* ------------------------------------------------------------------ */

export function newLocalId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

/** Everyone who can play this game: the pool, minus this game's hosts. */
export function playersFor(pool: GamePlayer[], game: Pick<ExternalGame, "hosts">): GamePlayer[] {
  const hostIds = new Set(game.hosts.map((h) => h.id));
  return pool.filter((p) => !hostIds.has(p.id));
}

/** A host who is in the lists of people playing is taken out of them. Used when someone becomes a host. */
export function withoutHosts(game: ExternalGame, hosts: GamePlayer[]): Partial<ExternalGame> {
  const hostIds = new Set(hosts.map((h) => h.id));
  const patch: Partial<ExternalGame> = { hosts };
  if (game.sides) {
    patch.sides = game.sides.map((s) => ({ ...s, members: s.members.filter((m) => !hostIds.has(m.id)) }));
  }
  if (game.rounds) {
    patch.rounds = game.rounds.map((r) => ({
      ...r,
      players: r.players.filter((p) => !hostIds.has(p.id)),
      placings: r.placings.filter((id) => !hostIds.has(id)),
    }));
  }
  return patch;
}

/* ------------------------------------------------------------------ */
/* Teams                                                               */
/* ------------------------------------------------------------------ */

export const MAX_EXTERNAL_TEAMS = 6;

export function defaultTeamNames(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Team ${String.fromCharCode(65 + i)}`);
}

/** Boys and Girls. People with no gender recorded (guests) are left for the host to place. */
export function genderTeams(players: GamePlayer[]): GameSide[] {
  return [
    { id: "boys", name: "Boys", members: players.filter((p) => p.gender === "male") },
    { id: "girls", name: "Girls", members: players.filter((p) => p.gender === "female") },
  ];
}

/** Empty teams for the host to fill by hand. */
export function emptyTeams(names: string[]): GameSide[] {
  return names.map((name, i) => ({ id: `team-${i + 1}`, name: name.trim() || `Team ${String.fromCharCode(65 + i)}`, members: [] }));
}

/**
 * Deals the players into teams at random, as evenly as possible. With `spreadGender`, boys and girls
 * are dealt separately so every team gets a similar mix.
 */
export function randomTeams(players: GamePlayer[], names: string[], spreadGender: boolean): GameSide[] {
  const sides = emptyTeams(names);
  const order = spreadGender
    ? [
        ...shuffle(players.filter((p) => p.gender === "male")),
        ...shuffle(players.filter((p) => p.gender === "female")),
        ...shuffle(players.filter((p) => !p.gender)),
      ]
    : shuffle(players);
  // Start dealing where the previous group stopped, so team sizes never differ by more than one.
  order.forEach((p, i) => sides[i % sides.length].members.push(p));
  return sides;
}

/** Makes the teams for a chosen way of picking. */
export function makeTeams(pick: TeamPick, players: GamePlayer[], names: string[], spreadGender: boolean): GameSide[] {
  if (pick === "gender") return genderTeams(players);
  if (pick === "random") return randomTeams(players, names, spreadGender);
  return emptyTeams(names);
}

/** People who can play but are not on any team yet. */
export function unplacedPlayers(players: GamePlayer[], sides: GameSide[]): GamePlayer[] {
  const placed = new Set(sides.flatMap((s) => s.members.map((m) => m.id)));
  return players.filter((p) => !placed.has(p.id));
}

/** Moves a person to another team, or off every team when `toSideId` is empty. */
export function moveToTeam(sides: GameSide[], person: GamePlayer, toSideId: string): GameSide[] {
  return sides.map((s) => {
    const rest = s.members.filter((m) => m.id !== person.id);
    return { ...s, members: s.id === toSideId ? [...rest, person] : rest };
  });
}

export interface RankedTeam {
  side: GameSide;
  score: number;
  rank: number; // ties share a rank
}

export function rankTeams(game: Pick<ExternalGame, "sides" | "scores">): RankedTeam[] {
  const rows = (game.sides ?? []).map((side) => ({ side, score: game.scores?.[side.id] ?? 0, rank: 0 }));
  rows.sort((a, b) => b.score - a.score);
  let rank = 0;
  rows.forEach((r, i) => {
    if (i === 0 || r.score !== rows[i - 1].score) rank = i + 1;
    r.rank = rank;
  });
  return rows;
}

/** The teams in front. Empty until something has been scored, so 0-0 isn't a "win". */
export function leadingTeams(game: Pick<ExternalGame, "sides" | "scores">): GameSide[] {
  const ranked = rankTeams(game);
  if (!ranked.length || ranked[0].score <= 0) return [];
  return ranked.filter((r) => r.rank === 1).map((r) => r.side);
}

/* ------------------------------------------------------------------ */
/* Rounds                                                              */
/* ------------------------------------------------------------------ */

export function nextRoundName(rounds: ExternalRound[]): string {
  return `Round ${rounds.length + 1}`;
}

/** Everyone who has already been in a round of this game. */
export function playedInRounds(rounds: ExternalRound[]): Set<string> {
  return new Set(rounds.flatMap((r) => r.players.map((p) => p.id)));
}

/** Draws `count` people at random. */
export function drawPlayers(candidates: GamePlayer[], count: number): GamePlayer[] {
  return shuffle(candidates).slice(0, Math.max(0, count));
}

/** The first-placed person of every round that has a winner, for a final. */
export function roundWinners(rounds: ExternalRound[], players: GamePlayer[]): GamePlayer[] {
  const out: GamePlayer[] = [];
  for (const r of rounds) {
    const first = r.placings[0];
    const person = first ? r.players.find((p) => p.id === first) ?? players.find((p) => p.id === first) : undefined;
    if (person && !out.some((o) => o.id === person.id)) out.push(person);
  }
  return out;
}

/** Puts a person at the next free place, or takes them out of the places if they already have one. */
export function togglePlacing(round: ExternalRound, personId: string): ExternalRound {
  const placings = round.placings.includes(personId)
    ? round.placings.filter((id) => id !== personId)
    : [...round.placings, personId];
  return { ...round, placings };
}

export function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

/** The podium: the places from the last round that has any. A final goes last, so it decides. */
export function podium(game: Pick<ExternalGame, "rounds">): { round: ExternalRound; places: { place: number; player: GamePlayer }[] } | null {
  const rounds = game.rounds ?? [];
  for (let i = rounds.length - 1; i >= 0; i--) {
    const round = rounds[i];
    if (round.placings.length === 0) continue;
    const places = round.placings
      .map((id, idx) => {
        const player = round.players.find((p) => p.id === id);
        return player ? { place: idx + 1, player } : null;
      })
      .filter((x): x is { place: number; player: GamePlayer } => !!x);
    return { round, places };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* One-line result, for lists                                          */
/* ------------------------------------------------------------------ */

export function resultLine(game: ExternalGame): string {
  if (game.format === "teams") {
    const ranked = rankTeams(game);
    if (ranked.length === 0) return "Teams not made yet";
    const scoreLine = ranked.map((r) => `${r.side.name} ${r.score}`).join(" – ");
    const lead = leadingTeams(game);
    if (ranked.every((r) => r.score === 0)) return `${ranked.map((r) => r.side.name).join(" vs ")} · no score yet`;
    if (lead.length > 1) return `${scoreLine} · Draw`;
    return `${scoreLine} · ${lead[0]?.name ?? ""} ${game.status === "finished" ? "won" : "leading"}`.trim();
  }
  const rounds = game.rounds ?? [];
  if (rounds.length === 0) return "No rounds yet";
  const top = podium(game);
  if (!top) return `${rounds.length} round${rounds.length === 1 ? "" : "s"}, no places yet`;
  const places = top.places
    .slice(0, 3)
    .map((p) => `${ordinal(p.place)} ${p.player.name}`)
    .join(", ");
  return `${top.round.name}: ${places}`;
}
