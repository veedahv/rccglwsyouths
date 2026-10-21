import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { deleteSession, newOverlayKey, sideTotal, updateSession, winners, writeOverlay } from "./games";
import { MODE_LABEL, hasStarted } from "@/types/games";
import type {
  EventOverlay,
  EventSummary,
  EventView,
  GameEvent,
  GameKind,
  GameResult,
  GameSession,
  GameSide,
  Lineup,
  LineupRow,
} from "@/types/games";

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

/* ------------------------------------------------------------------ */
/* Overall standings                                                   */
/* ------------------------------------------------------------------ */

/**
 * Which "lineup" a game belongs to, and how to recognise the same side in
 * another game. Boys vs Girls always match each other; teams match by name
 * (so "Team A" in game 2 is the same side as "Team A" in game 1); individual
 * players match by their ID. Games with different lineups are not added
 * together, because points for "Girls" mean nothing next to points for "Team A".
 */
function lineupOf(session: GameSession): { key: string; label: string; identity: (side: GameSide) => string } {
  if (session.mode === "gender") {
    return { key: "gender", label: MODE_LABEL.gender, identity: (side) => side.id };
  }
  if (session.mode === "teams") {
    const names = session.sides.map((s) => s.name.trim().toLowerCase()).sort();
    return {
      key: `teams:${names.join("|")}`,
      label: session.sides.map((s) => s.name).join(" vs "),
      identity: (side) => side.name.trim().toLowerCase(),
    };
  }
  const ids = session.sides.map((s) => s.id).sort();
  const names = session.sides.map((s) => s.name);
  return {
    key: `${session.mode}:${ids.join("|")}`,
    label: names.length <= 3 ? names.join(" vs ") : `${names.length} players`,
    identity: (side) => side.id,
  };
}

function rankRows(rows: Omit<LineupRow, "rank">[]): LineupRow[] {
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  let rank = 0;
  return sorted.map((r, i) => {
    if (i === 0 || r.total !== sorted[i - 1].total) rank = i + 1;
    return { ...r, rank };
  });
}

/** Adds up every game that has been started, grouped by who played. Pass the event's games in the order they were created. */
export function summarizeEvent(sessions: GameSession[]): EventSummary {
  const ordered = sessions.filter(hasStarted).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const lineups = new Map<string, Lineup>();
  const results: GameResult[] = [];

  for (const session of ordered) {
    const { key, label, identity } = lineupOf(session);
    let lineup = lineups.get(key);
    if (!lineup) {
      lineup = { key, label, games: [], rows: [], winners: [] };
      lineups.set(key, lineup);
    }
    lineup.games.push({ id: session.id, title: session.title, game: session.game });
    for (const side of session.sides) {
      const id = identity(side);
      let row = lineup.rows.find((r) => r.id === id);
      if (!row) {
        row = {
          id,
          name: side.name,
          ...(side.members.length > 1 ? { members: side.members.map((m) => m.name).join(", ") } : {}),
          total: 0,
          perGame: {},
          rank: 0,
        };
        lineup.rows.push(row);
      }
      const points = sideTotal(session, side.id);
      row.perGame[session.id] = points;
      row.total += points;
    }

    const won = winners(session);
    results.push({
      id: session.id,
      game: session.game,
      lineup: label,
      status: session.status,
      winners: won.map((w) => w.name),
      topPoints: won.length ? sideTotal(session, won[0].id) : 0,
    });
  }

  const out = [...lineups.values()].map((lineup) => {
    const rows = rankRows(lineup.rows);
    const best = rows[0]?.total ?? 0;
    return { ...lineup, rows, winners: best > 0 ? rows.filter((r) => r.rank === 1).map((r) => r.name) : [] };
  });
  return { lineups: out, results };
}

/** The same sides as an earlier game, so the next game can reuse them without picking players again. */
export function previousLineups(sessions: GameSession[]): { label: string; session: GameSession }[] {
  const seen = new Set<string>();
  const out: { label: string; session: GameSession }[] = [];
  for (const s of [...sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const { key, label } = lineupOf(s);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, session: s });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

export async function listEvents(): Promise<GameEvent[]> {
  const snap = await getDocs(query(collection(db, "gameEvents"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GameEvent, "id">) }));
}

export function subscribeEvent(
  id: string,
  onChange: (event: GameEvent | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "gameEvents", id),
    (snap) => onChange(snap.exists() ? { id: snap.id, ...(snap.data() as Omit<GameEvent, "id">) } : null),
    (err) => onError?.(err)
  );
}

/** Every game in an event, oldest first, kept live. */
export function subscribeEventSessions(
  eventId: string,
  onChange: (sessions: GameSession[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "gameSessions"), where("eventId", "==", eventId)),
    (snap) =>
      onChange(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<GameSession, "id">) }))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      ),
    (err) => onError?.(err)
  );
}

async function fetchEventSessions(eventId: string): Promise<GameSession[]> {
  const snap = await getDocs(query(collection(db, "gameSessions"), where("eventId", "==", eventId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<GameSession, "id">) }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function overlayFor(event: GameEvent, view: "cover" | "standings" | "final", sessions: GameSession[]): EventOverlay {
  return {
    kind: "event",
    view,
    title: event.title,
    subtitle: event.subtitle,
    venue: event.venue,
    plannedGames: event.plannedGames,
    hosts: event.hosts?.map((h) => h.name),
    summary: summarizeEvent(sessions),
  };
}

export async function createEvent(data: {
  title: string;
  subtitle?: string;
  venue?: string;
  plannedGames: GameKind[];
  createdBy: string;
  createdByName: string;
}): Promise<string> {
  const overlayKey = newOverlayKey();
  const event: Omit<GameEvent, "id"> = {
    ...data,
    view: "cover",
    overlayKey,
    status: "live",
    createdAt: new Date().toISOString(),
  };
  const ref = await addDoc(collection(db, "gameEvents"), clean(event));
  try {
    await setDoc(doc(db, "gameOverlays", overlayKey), clean(overlayFor({ id: ref.id, ...event }, "cover", [])));
  } catch {
    // The event page has a "Resync overlay" button if this didn't go through.
  }
  return ref.id;
}

export async function updateEvent(id: string, data: Partial<Omit<GameEvent, "id">>): Promise<void> {
  await updateDoc(doc(db, "gameEvents", id), clean(data));
}

/**
 * Changes what the big screen and the overlay show. Only the game on screen
 * holds the event's overlay link (see GameSession.eventId), so every other
 * game's link is cleared here and the chosen game's is set.
 * The event itself always saves; the overlay is written separately so a
 * problem with it (e.g. undeployed Firestore rules) never blocks the game.
 */
export async function setEventView(
  event: GameEvent,
  view: EventView,
  activeSessionId?: string
): Promise<{ overlayOk: boolean }> {
  const sessions = await fetchEventSessions(event.id);
  const active = view === "game" ? sessions.find((s) => s.id === activeSessionId) : undefined;
  const next: GameEvent = {
    ...event,
    view: view === "game" && !active ? "cover" : view,
    activeSessionId: active?.id,
    status: view === "final" ? "finished" : "live",
  };
  await updateEvent(event.id, { view: next.view, activeSessionId: next.activeSessionId ?? "", status: next.status });

  for (const s of sessions) {
    const want = active && s.id === active.id ? event.overlayKey : "";
    if ((s.overlayKey ?? "") !== want) await updateSession(s.id, { overlayKey: want });
  }
  return writeEventOverlay(next, sessions);
}

/** Re-sends whatever is on screen to the overlay (also used by "Resync overlay"). */
export async function writeEventOverlay(event: GameEvent, sessions?: GameSession[]): Promise<{ overlayOk: boolean }> {
  try {
    const all = sessions ?? (await fetchEventSessions(event.id));
    const active = event.view === "game" ? all.find((s) => s.id === event.activeSessionId) : undefined;
    if (active) {
      await writeOverlay(event.overlayKey, { ...active, overlayKey: event.overlayKey, eventTitle: event.title });
    } else {
      const view = event.view === "standings" || event.view === "final" ? event.view : "cover";
      await setDoc(doc(db, "gameOverlays", event.overlayKey), clean(overlayFor(event, view, all)));
    }
    return { overlayOk: true };
  } catch {
    return { overlayOk: false };
  }
}

/** Deletes the event, all its games, and turns its overlay link off. */
export async function deleteEvent(event: GameEvent): Promise<void> {
  const sessions = await fetchEventSessions(event.id);
  for (const s of sessions) await deleteSession({ id: s.id, overlayKey: undefined });
  await deleteDoc(doc(db, "gameEvents", event.id));
  try {
    await deleteDoc(doc(db, "gameOverlays", event.overlayKey));
  } catch {
    // Not worth failing the delete over.
  }
}
