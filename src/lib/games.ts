import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  BIBLE_OR_CAP_STARTER,
  BOARD_STARTER,
  EMOJI_STARTER,
  FILL_BLANK_STARTER,
  SCRAMBLE_STARTER,
  WHO_AM_I_STARTER,
} from "./gameStarterBank";
import { BLANK } from "@/types/games";
import type {
  GameKind,
  GameMode,
  GamePlayer,
  GameQuestion,
  GameRound,
  GameSession,
  GameSide,
} from "@/types/games";

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

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

export function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Scrambles each word's letters on its own (so a two-word answer keeps its
 * word breaks), making sure the result is never the original when it can be
 * avoided. Shown in capitals, spaced out by the display.
 */
export function scrambleText(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .map((word) => {
      const letters = word.toUpperCase().split("");
      if (letters.length < 2 || new Set(letters).size < 2) return letters.join("");
      let out = letters;
      for (let tries = 0; tries < 20 && out.join("") === word.toUpperCase(); tries++) {
        out = shuffle(letters);
      }
      return out.join("");
    })
    .join(" ");
}

export function newGuestId(): string {
  return `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** How many missing words a fill-in-the-blank verse has. */
export function countBlanks(statement: string): number {
  return statement.split(BLANK).length - 1;
}

/** The missing words of a fill-in-the-blank answer, in order ("hope, love" gives two). */
export function splitAnswerWords(answer: string): string[] {
  return answer
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);
}

/** The verse with each blank filled in with its word, in order. */
export function fillBlanks(statement: string, answer: string): string {
  const words = splitAnswerWords(answer);
  let i = 0;
  return statement.split(BLANK).reduce((out, part, idx) => (idx === 0 ? part : out + (words[i++] ?? BLANK) + part), "");
}

/** Why a fill-in-the-blank verse can't be saved, or null if it is fine. */
export function blankProblem(statement: string, answer: string): string | null {
  const blanks = countBlanks(statement);
  if (blanks === 0) return `Mark each missing word in the verse with ${BLANK}.`;
  const words = splitAnswerWords(answer).length;
  if (words !== blanks) {
    return `The verse has ${blanks} blank${blanks === 1 ? "" : "s"} but ${words} missing word${words === 1 ? "" : "s"} listed. Separate the missing words with commas, in order.`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Question bank                                                       */
/* ------------------------------------------------------------------ */

export async function listQuestions(): Promise<GameQuestion[]> {
  const snap = await getDocs(collection(db, "gameQuestions"));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<GameQuestion, "id">) }))
    .sort(
      (a, b) => a.category.localeCompare(b.category) || (a.value ?? 0) - (b.value ?? 0) || a.createdAt.localeCompare(b.createdAt)
    );
}

export async function addQuestion(data: Omit<GameQuestion, "id" | "createdAt">): Promise<string> {
  const ref = await addDoc(collection(db, "gameQuestions"), clean({ ...data, createdAt: new Date().toISOString() }));
  return ref.id;
}

export async function updateQuestion(id: string, data: Partial<Omit<GameQuestion, "id" | "createdAt">>): Promise<void> {
  await updateDoc(doc(db, "gameQuestions", id), clean(data));
}

export async function deleteQuestion(id: string): Promise<void> {
  await deleteDoc(doc(db, "gameQuestions", id));
}

/** Deletes many questions at once (used by "Clear questions"). Past sessions keep their own copies. */
export async function deleteQuestions(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + 400)) batch.delete(doc(db, "gameQuestions", id));
    await batch.commit();
  }
}

function questionKey(q: Pick<GameQuestion, "game" | "category" | "answer" | "statement" | "emojis" | "value">): string {
  const body =
    q.game === "scramble" || q.game === "whoAmI"
      ? q.answer ?? ""
      : q.game === "emoji"
        ? `${q.emojis ?? ""}${q.answer ?? ""}`
        : q.game === "board"
          ? `${q.value ?? ""}${q.statement ?? ""}`
          : q.statement ?? "";
  return `${q.game}|${q.category.trim().toLowerCase()}|${body.trim().toLowerCase()}`;
}

/** Loads the starter questions, skipping any that are already in the bank. Returns how many were added. */
export async function seedStarterQuestions(existing: GameQuestion[]): Promise<number> {
  const have = new Set(existing.map(questionKey));
  const now = new Date().toISOString();
  const toAdd: Omit<GameQuestion, "id">[] = [];

  for (const [category, entries] of Object.entries(SCRAMBLE_STARTER)) {
    for (const [answer, hint] of entries) {
      const q = { game: "scramble" as const, category, answer, hint, createdAt: now };
      if (!have.has(questionKey(q))) toAdd.push(q);
    }
  }
  for (const [category, entries] of Object.entries(BIBLE_OR_CAP_STARTER)) {
    for (const [statement, isTrue, note] of entries) {
      // The note is the verse for Scripture, or where a Cap saying really comes from.
      const q = {
        game: "bibleOrCap" as const,
        category,
        statement,
        isTrue,
        ...(isTrue ? { reference: note } : { explanation: note }),
        createdAt: now,
      };
      if (!have.has(questionKey(q))) toAdd.push(q);
    }
  }

  for (const [category, entries] of Object.entries(EMOJI_STARTER)) {
    for (const [emojis, answer, hint, reference] of entries) {
      const q = { game: "emoji" as const, category, emojis, answer, hint, reference, createdAt: now };
      if (!have.has(questionKey(q))) toAdd.push(q);
    }
  }
  for (const [category, entries] of Object.entries(FILL_BLANK_STARTER)) {
    for (const [statement, answer, reference] of entries) {
      const q = { game: "fillBlank" as const, category, statement, answer, reference, createdAt: now };
      if (!have.has(questionKey(q))) toAdd.push(q);
    }
  }

  for (const [category, entries] of Object.entries(WHO_AM_I_STARTER)) {
    for (const [answer, clues, reference] of entries) {
      const q = { game: "whoAmI" as const, category, answer, clues, reference, createdAt: now };
      if (!have.has(questionKey(q))) toAdd.push(q);
    }
  }
  for (const [category, entries] of Object.entries(BOARD_STARTER)) {
    for (const [value, statement, answer, reference] of entries) {
      const q = { game: "board" as const, category, value, statement, answer, reference, createdAt: now };
      if (!have.has(questionKey(q))) toAdd.push(q);
    }
  }

  // A batch holds up to 500 writes; chunk to stay well inside that.
  for (let i = 0; i < toAdd.length; i += 400) {
    const batch = writeBatch(db);
    for (const q of toAdd.slice(i, i + 400)) {
      batch.set(doc(collection(db, "gameQuestions")), clean(q));
    }
    await batch.commit();
  }
  return toAdd.length;
}

/**
 * Splits pasted text into questions, one per line, fields separated by "|":
 * - Scrambled words: "word | hint"
 * - Scripture or Cap: "quote | scripture or cap | note", where the note is the
 *   verse for Scripture or where a Cap saying really comes from
 * - Emoji Bible Trivia: "emojis | answer | hint | reference" (hint and reference optional)
 * - Fill in the missing word: "verse with ___ | missing words | reference",
 *   with several missing words separated by commas, in order
 * - Who Am I?: "answer | clue 1 | clue 2 | clue 3 ..." (hardest clue first,
 *   at least two clues)
 * - Quiz board: "clue | answer | points | reference" (reference optional)
 */
export function parseBulk(
  game: GameKind,
  category: string,
  text: string
): { questions: Omit<GameQuestion, "id" | "createdAt">[]; skipped: number } {
  const questions: Omit<GameQuestion, "id" | "createdAt">[] = [];
  let skipped = 0;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split("|").map((p) => p.trim());
    if (game === "scramble") {
      if (!parts[0]) {
        skipped++;
        continue;
      }
      questions.push({ game, category, answer: parts[0], hint: parts[1] || undefined });
    } else if (game === "emoji") {
      if (!parts[0] || !parts[1]) {
        skipped++;
        continue;
      }
      questions.push({ game, category, emojis: parts[0], answer: parts[1], hint: parts[2] || undefined, reference: parts[3] || undefined });
    } else if (game === "whoAmI") {
      const clues = parts.slice(1).filter(Boolean);
      if (!parts[0] || clues.length < 2) {
        skipped++;
        continue;
      }
      questions.push({ game, category, answer: parts[0], clues });
    } else if (game === "board") {
      const value = Number(parts[2]);
      if (!parts[0] || !parts[1] || !Number.isInteger(value) || value <= 0) {
        skipped++;
        continue;
      }
      questions.push({ game, category, statement: parts[0], answer: parts[1], value, reference: parts[3] || undefined });
    } else if (game === "fillBlank") {
      if (!parts[0] || !parts[1] || blankProblem(parts[0], parts[1])) {
        skipped++;
        continue;
      }
      questions.push({ game, category, statement: parts[0], answer: parts[1], reference: parts[2] || undefined });
    } else {
      const verdict = (parts[1] ?? "").toLowerCase();
      const isTrue = ["scripture", "bible", "true", "t", "yes"].includes(verdict)
        ? true
        : ["cap", "false", "f", "no"].includes(verdict)
          ? false
          : null;
      if (!parts[0] || isTrue === null) {
        skipped++;
        continue;
      }
      questions.push({
        game,
        category,
        statement: parts[0],
        isTrue,
        ...(isTrue ? { reference: parts[2] || undefined } : { explanation: parts[2] || undefined }),
      });
    }
  }
  return { questions, skipped };
}

export async function addQuestions(questions: Omit<GameQuestion, "id" | "createdAt">[]): Promise<void> {
  const now = new Date().toISOString();
  for (let i = 0; i < questions.length; i += 400) {
    const batch = writeBatch(db);
    for (const q of questions.slice(i, i + 400)) {
      batch.set(doc(collection(db, "gameQuestions")), clean({ ...q, createdAt: now }));
    }
    await batch.commit();
  }
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

export async function listSessions(): Promise<GameSession[]> {
  const snap = await getDocs(query(collection(db, "gameSessions"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GameSession, "id">) }));
}

export async function getSession(id: string): Promise<GameSession | null> {
  const snap = await getDoc(doc(db, "gameSessions", id));
  return snap.exists() ? { id: snap.id, ...(snap.data() as Omit<GameSession, "id">) } : null;
}

/** Live updates, so a second screen (e.g. a projector) follows the admin's phone. */
export function subscribeSession(
  id: string,
  onChange: (session: GameSession | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "gameSessions", id),
    (snap) => onChange(snap.exists() ? { id: snap.id, ...(snap.data() as Omit<GameSession, "id">) } : null),
    (err) => onError?.(err)
  );
}

/** Freezes one question into a round. */
export function questionToRound(q: GameQuestion): GameRound {
  switch (q.game) {
    case "scramble":
      return {
        questionId: q.id,
        prompt: scrambleText(q.answer ?? ""),
        answer: (q.answer ?? "").trim(),
        hint: q.hint,
        category: q.category,
        awards: {},
      };
    case "emoji":
      return {
        questionId: q.id,
        prompt: q.emojis ?? "",
        answer: (q.answer ?? "").trim(),
        hint: q.hint,
        reference: q.reference,
        category: q.category,
        awards: {},
      };
    case "fillBlank":
      return {
        questionId: q.id,
        prompt: q.statement ?? "",
        answer: splitAnswerWords(q.answer ?? "").join(", "),
        completed: fillBlanks(q.statement ?? "", q.answer ?? ""),
        hint: q.hint,
        reference: q.reference,
        category: q.category,
        awards: {},
      };
    case "whoAmI":
      return {
        questionId: q.id,
        prompt: "Who am I?",
        answer: (q.answer ?? "").trim(),
        clues: (q.clues ?? []).map((c) => c.trim()).filter(Boolean),
        reference: q.reference,
        category: q.category,
        awards: {},
      };
    case "board":
      return {
        questionId: q.id,
        prompt: q.statement ?? "",
        answer: (q.answer ?? "").trim(),
        reference: q.reference,
        category: q.category,
        value: q.value ?? 0,
        played: false,
        awards: {},
      };
    default:
      return {
        questionId: q.id,
        prompt: q.statement ?? "",
        answer: q.isTrue ? "Scripture" : "Cap",
        reference: q.isTrue ? q.reference : undefined,
        explanation: q.isTrue ? undefined : q.explanation,
        category: q.category,
        awards: {},
      };
  }
}

/** Picks `count` distinct questions at random and freezes them into rounds. */
export function buildRounds(questions: GameQuestion[], count: number): GameRound[] {
  return shuffle(questions).slice(0, count).map(questionToRound);
}

/**
 * Builds a quiz board: a column for each chosen category and a row for each
 * point level, with one randomly chosen clue per cell. A cell is left empty
 * when a category has no clue at that level.
 */
export function buildBoard(
  questions: GameQuestion[],
  categories: string[]
): { rounds: GameRound[]; categories: string[]; values: number[] } {
  const usable = questions.filter((q) => categories.includes(q.category) && (q.value ?? 0) > 0);
  const values = [...new Set(usable.map((q) => q.value as number))].sort((a, b) => a - b);
  const rounds: GameRound[] = [];
  for (const category of categories) {
    for (const value of values) {
      const options = usable.filter((q) => q.category === category && q.value === value);
      if (options.length > 0) rounds.push(questionToRound(shuffle(options)[0]));
    }
  }
  return { rounds, categories: categories.filter((c) => rounds.some((r) => r.category === c)), values };
}

export async function createSession(data: {
  title: string;
  game: GameKind;
  mode: GameMode;
  sides: GameSide[];
  rounds: GameRound[];
  createdBy: string;
  timerSeconds: number; // 0 means no timer
  showHints: boolean;
  board?: { categories: string[]; values: number[] }; // quiz board only
}): Promise<string> {
  const { board, ...rest } = data;
  const overlayKey = newOverlayKey();
  const session: Omit<GameSession, "id"> = {
    ...rest,
    overlayKey,
    // A quiz board opens on the board itself (-1); every other game opens on round 1.
    currentRound: board ? -1 : 0,
    ...(board ? { boardCategories: board.categories, boardValues: board.values, turnIndex: 0 } : {}),
    // Who Am I? starts each round with its first clue showing.
    ...(data.game === "whoAmI" ? { cluesShown: 1 } : {}),
    revealed: false,
    timerState: "idle",
    timerRemaining: data.timerSeconds,
    timerSeq: 0,
    status: "live",
    createdAt: new Date().toISOString(),
  };
  const ref = await addDoc(collection(db, "gameSessions"), clean(session));
  try {
    await writeOverlay(overlayKey, { id: ref.id, ...session });
  } catch {
    // The run screen has a "Resync overlay" button if this didn't go through.
  }
  return ref.id;
}

export async function updateSession(id: string, data: Partial<Omit<GameSession, "id">>): Promise<void> {
  await updateDoc(doc(db, "gameSessions", id), clean(data));
}

export async function deleteSession(session: Pick<GameSession, "id" | "overlayKey">): Promise<void> {
  await deleteDoc(doc(db, "gameSessions", session.id));
  // The overlay link stops working as soon as its session is deleted.
  if (session.overlayKey) {
    try {
      await deleteDoc(doc(db, "gameOverlays", session.overlayKey));
    } catch {
      // Not worth failing the delete over.
    }
  }
}

/* ------------------------------------------------------------------ */
/* OBS overlay                                                         */
/* ------------------------------------------------------------------ */

/**
 * A copy of the session that is safe to show to anyone holding the overlay
 * link: only what is on screen right now. Upcoming questions and answers are
 * blanked, and the current answer, hint and unrevealed clues stay hidden until
 * the admin reveals them. It keeps the shape of a session so the same display
 * components can draw it.
 */
export function redactForDisplay(session: GameSession): GameSession {
  const cluesShown = session.cluesShown ?? 1;
  const rounds: GameRound[] = session.rounds.map((r, i) => {
    const out: GameRound = {
      questionId: r.questionId,
      category: r.category,
      prompt: "",
      answer: "",
      awards: r.awards,
      value: r.value,
      played: r.played,
    };
    if (i !== session.currentRound || session.status === "finished") return out;
    out.prompt = r.prompt;
    if (session.showHints !== false) out.hint = r.hint;
    if (r.clues) out.clues = r.clues.map((c, idx) => (idx < cluesShown ? c : ""));
    if (session.revealed) {
      out.answer = r.answer;
      out.completed = r.completed;
      out.reference = r.reference;
      out.explanation = r.explanation;
    }
    return out;
  });
  return { ...session, rounds, createdBy: "", overlayKey: undefined };
}

export function newOverlayKey(): string {
  // An auto-generated Firestore ID is 20 random characters, so it can't be guessed.
  return doc(collection(db, "gameOverlays")).id;
}

async function writeOverlay(key: string, session: GameSession): Promise<void> {
  await setDoc(doc(db, "gameOverlays", key), clean(redactForDisplay(session)));
}

/**
 * Saves a change to a session, then refreshes its overlay. The overlay is
 * written separately on purpose: if it fails (for example the new Firestore
 * rules aren't deployed yet) the game itself keeps working.
 */
export async function saveSessionChange(
  current: GameSession,
  data: Partial<Omit<GameSession, "id">>
): Promise<{ overlayOk: boolean }> {
  await updateSession(current.id, data);
  if (!current.overlayKey) return { overlayOk: true };
  try {
    await writeOverlay(current.overlayKey, { ...current, ...data });
    return { overlayOk: true };
  } catch {
    return { overlayOk: false };
  }
}

/** Creates the overlay for a session that doesn't have one yet, or re-sends the current state. Returns its key. */
export async function syncOverlay(session: GameSession): Promise<string> {
  const key = session.overlayKey ?? newOverlayKey();
  if (!session.overlayKey) await updateSession(session.id, { overlayKey: key });
  await writeOverlay(key, { ...session, overlayKey: key });
  return key;
}

/** Live updates for the overlay page. It needs no sign-in. */
export function subscribeOverlay(
  key: string,
  onChange: (session: GameSession | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "gameOverlays", key),
    (snap) => onChange(snap.exists() ? (snap.data() as GameSession) : null),
    (err) => onError?.(err)
  );
}

/** Saves a session's rounds (points awarded live inside each round). */
export async function saveRounds(id: string, rounds: GameRound[]): Promise<void> {
  await updateDoc(doc(db, "gameSessions", id), { rounds: clean(rounds) });
}

/** Who Am I?: an earlier correct answer is worth more, so points fall as clues are shown. */
export function whoAmIPoints(session: Pick<GameSession, "cluesShown">, round: Pick<GameRound, "clues">): number {
  const total = round.clues?.length ?? 1;
  const shown = Math.min(Math.max(session.cluesShown ?? 1, 1), total);
  return Math.max(1, total - shown + 1);
}

/* ------------------------------------------------------------------ */
/* Sides                                                               */
/* ------------------------------------------------------------------ */

export function genderSides(): GameSide[] {
  return [
    { id: "boys", name: "Boys", members: [] },
    { id: "girls", name: "Girls", members: [] },
  ];
}

export function teamSides(names: string[], assignments: Record<string, number>, players: GamePlayer[]): GameSide[] {
  return names.map((name, i) => ({
    id: `team-${i + 1}`,
    name: name.trim() || `Team ${String.fromCharCode(65 + i)}`,
    members: players.filter((p) => assignments[p.id] === i),
  }));
}

/** One side per player, named after the player. */
export function individualSides(players: GamePlayer[]): GameSide[] {
  return players.map((p) => ({ id: p.id, name: p.name, members: [p] }));
}

/** Deals players into `teamCount` teams as evenly as possible, in random order. */
export function dealIntoTeams(players: GamePlayer[], teamCount: number): Record<string, number> {
  const out: Record<string, number> = {};
  shuffle(players).forEach((p, i) => {
    out[p.id] = i % teamCount;
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

export function sideTotal(session: Pick<GameSession, "rounds">, sideId: string): number {
  return session.rounds.reduce((sum, r) => sum + (r.awards[sideId] ?? 0), 0);
}

export interface RankedSide {
  side: GameSide;
  points: number;
  rank: number; // ties share a rank
}

export function rankSides(session: Pick<GameSession, "rounds" | "sides">): RankedSide[] {
  const scored = session.sides
    .map((side) => ({ side, points: sideTotal(session, side.id) }))
    .sort((a, b) => b.points - a.points);
  let rank = 0;
  return scored.map((s, i) => {
    if (i === 0 || s.points !== scored[i - 1].points) rank = i + 1;
    return { ...s, rank };
  });
}

/** Who is winning at the end: every side tied for first, or none if nobody has scored. */
export function winners(session: Pick<GameSession, "rounds" | "sides">): GameSide[] {
  const ranked = rankSides(session);
  if (ranked.length === 0 || ranked[0].points === 0) return [];
  return ranked.filter((r) => r.rank === 1).map((r) => r.side);
}
