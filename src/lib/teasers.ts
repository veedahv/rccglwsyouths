import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { BIBLE_BOOKS, booksWhere } from "./bibleBooks";
import type { Teaser, TeaserAnswer, TeaserFlash, TeaserRun, TeaserSlot } from "@/types/teasers";

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
/* Matching what the host picks or types                               */
/* ------------------------------------------------------------------ */

/** Lower case, no accents or punctuation, single spaces, so "Self-control" and "self control" match. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matches(answer: TeaserAnswer, input: string): boolean {
  const want = normalize(input);
  return !!want && [answer.name, ...(answer.aliases ?? [])].some((n) => normalize(n) === want);
}

export type PickResult =
  | { kind: "hit"; answer: TeaserAnswer }
  | { kind: "dup"; answer: TeaserAnswer } // already named
  | { kind: "miss" }; // not one of the answers

/**
 * Looks an answer up. An answer that is still free wins over one already
 * named, so two answers with the same alias (the two Jameses) fill in turn.
 * No spelling tolerance is needed: the host taps from a list.
 */
export function matchPick(run: Pick<TeaserRun, "answers" | "slots">, input: string): PickResult {
  const named = new Set(run.slots.map((s) => s.answer).filter(Boolean));
  const free = run.answers.find((a) => !named.has(a.name) && matches(a, input));
  if (free) return { kind: "hit", answer: free };
  const dup = run.answers.find((a) => named.has(a.name) && matches(a, input));
  return dup ? { kind: "dup", answer: dup } : { kind: "miss" };
}

/**
 * What to save when the host picks an answer: the next slot is filled, or a
 * "dup" or "miss" message is sent so every screen can nudge or shake. When the
 * last slot is filled the game finishes and the clock stops.
 */
export function pickUpdate(run: TeaserRun, input: string, remaining: number): Partial<Omit<TeaserRun, "id">> {
  const result = matchPick(run, input);
  const seq = (run.flash?.seq ?? 0) + 1;
  const next = run.slots.findIndex((s) => !s.answer);

  if (result.kind === "hit" && next >= 0) {
    const slots = run.slots.map((s, i) => (i === next ? { ...s, answer: result.answer.name } : s));
    const flash: TeaserFlash = { kind: "hit", text: result.answer.name, seq };
    if (slots.every((s) => s.answer)) {
      return {
        slots,
        flash,
        status: "finished",
        timerState: run.timerState === "idle" ? "idle" : "paused",
        timerRemaining: Math.round(remaining * 10) / 10,
        timerSeq: run.timerSeq + 1,
      };
    }
    return { slots, flash };
  }
  if (result.kind === "dup") return { flash: { kind: "dup", text: result.answer.name, seq } };
  return { flash: { kind: "miss", text: input.trim(), seq } };
}

/** One numbered slot as it is drawn: empty, named, or (once the game is over) revealed as missed. */
export interface SlotView {
  n: number;
  state: "empty" | "named" | "missed";
  text: string;
  by: string;
}

/** Every slot as shown. Once `ended`, the slots nobody named are filled with answers that were left. */
export function slotViews(run: Pick<TeaserRun, "answers" | "slots">, ended: boolean): SlotView[] {
  const named = new Set(run.slots.map((s) => s.answer).filter(Boolean));
  const left = run.answers.filter((a) => !named.has(a.name));
  let k = 0;
  return run.slots.map((s, i) => {
    if (s.answer) return { n: i + 1, state: "named", text: s.answer, by: s.by };
    if (ended && left[k]) return { n: i + 1, state: "missed", text: left[k++].name, by: "" };
    return { n: i + 1, state: "empty", text: "", by: "" };
  });
}

/** What the picker offers: every right answer, plus any wrong options, in alphabetical order. */
export function listChoices(run: Pick<TeaserRun, "answers" | "distractors">): string[] {
  return [...run.answers.map((a) => a.name), ...(run.distractors ?? [])].sort((a, b) => a.localeCompare(b));
}

/* ------------------------------------------------------------------ */
/* Teasers                                                             */
/* ------------------------------------------------------------------ */

export function slotCountOf(teaser: Pick<Teaser, "answers" | "count">): number {
  const all = teaser.answers.length;
  return teaser.count && teaser.count > 0 ? Math.min(teaser.count, all) : all;
}

export async function listTeasers(): Promise<Teaser[]> {
  const snap = await getDocs(query(collection(db, "gameTeasers"), orderBy("createdAt", "asc")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Teaser, "id">) }));
}

export async function addTeaser(data: Omit<Teaser, "id" | "createdAt">): Promise<string> {
  const ref = await addDoc(collection(db, "gameTeasers"), clean({ ...data, createdAt: new Date().toISOString() }));
  return ref.id;
}

export async function updateTeaser(id: string, data: Partial<Omit<Teaser, "id" | "createdAt">>): Promise<void> {
  await updateDoc(doc(db, "gameTeasers", id), clean(data));
}

export async function deleteTeaser(id: string): Promise<void> {
  await deleteDoc(doc(db, "gameTeasers", id));
}

/** Turns "Peter | Simon | Simon Peter" lines into answers. */
export function parseAnswerLines(text: string): TeaserAnswer[] {
  return text
    .split("\n")
    .map((line) => line.split("|").map((p) => p.trim()).filter(Boolean))
    .filter((parts) => parts.length > 0)
    .map(([name, ...aliases]) => ({ name, ...(aliases.length ? { aliases } : {}) }));
}

export function answersToLines(answers: TeaserAnswer[]): string {
  return answers.map((a) => [a.name, ...(a.aliases ?? [])].join(" | ")).join("\n");
}

/* ------------------------------------------------------------------ */
/* Starter set                                                         */
/* ------------------------------------------------------------------ */

const asAnswers = (names: string[]): TeaserAnswer[] => names.map((name) => ({ name }));

// Lists people argue about carry aliases: the disciples have more than one name each, and the
// fruit of the Spirit is worded differently from one translation to the next.
const STARTER: Omit<Teaser, "id" | "createdAt">[] = [
  {
    title: "4-letter books",
    prompt: "Name 9 books of the Bible with only 4 letters",
    picker: "books",
    answers: asAnswers(booksWhere((b) => b.name.length === 4)),
    seconds: 60,
  },
  {
    title: "Books starting with J",
    prompt: "Name 9 books of the Bible that start with J",
    picker: "books",
    answers: asAnswers(booksWhere((b) => b.name.startsWith("J"))),
    seconds: 60,
  },
  {
    title: "Minor prophets",
    prompt: "Name the 12 minor prophets",
    picker: "books",
    answers: asAnswers(booksWhere((b) => b.group === "Minor prophets")),
    seconds: 90,
  },
  {
    title: "The 12 disciples",
    prompt: "Name the 12 disciples of Jesus",
    picker: "list",
    answers: [
      { name: "Peter", aliases: ["Simon Peter", "Cephas"] },
      { name: "Andrew" },
      { name: "James (son of Zebedee)", aliases: ["James", "James son of Zebedee", "James the Great"] },
      { name: "John" },
      { name: "Philip" },
      { name: "Bartholomew", aliases: ["Nathanael"] },
      { name: "Matthew", aliases: ["Levi"] },
      { name: "Thomas", aliases: ["Didymus"] },
      { name: "James (son of Alphaeus)", aliases: ["James", "James son of Alphaeus", "James the Less"] },
      { name: "Thaddaeus", aliases: ["Thaddeus", "Judas son of James", "Lebbaeus", "Jude"] },
      { name: "Simon the Zealot", aliases: ["Simon the Canaanite", "Simon Zelotes"] },
      { name: "Judas Iscariot", aliases: ["Judas"] },
    ],
    distractors: ["Paul", "Barnabas", "Matthias", "Mark", "Luke", "Timothy"],
    seconds: 90,
  },
  {
    title: "Fruit of the Spirit",
    prompt: "Name the 9 fruit of the Spirit",
    picker: "list",
    answers: [
      { name: "Love" },
      { name: "Joy" },
      { name: "Peace" },
      { name: "Patience", aliases: ["Longsuffering", "Long-suffering"] },
      { name: "Kindness" },
      { name: "Goodness" },
      { name: "Faithfulness", aliases: ["Faith"] },
      { name: "Gentleness", aliases: ["Meekness"] },
      { name: "Self-control", aliases: ["Temperance", "Self control"] },
    ],
    distractors: ["Hope", "Wisdom", "Humility", "Courage"],
    seconds: 60,
  },
];

/** Adds the starter teasers that aren't there yet (matched by title). Returns how many were added. */
export async function seedStarterTeasers(existing: Teaser[]): Promise<number> {
  const have = new Set(existing.map((t) => t.title.trim().toLowerCase()));
  let added = 0;
  for (const t of STARTER) {
    if (have.has(t.title.toLowerCase())) continue;
    await addTeaser(t);
    added++;
  }
  return added;
}

/* ------------------------------------------------------------------ */
/* Runs                                                                */
/* ------------------------------------------------------------------ */

/** Starts a game of a teaser. The answers are copied, so editing the teaser later changes nothing already started. */
export async function createTeaserRun(teaser: Teaser, createdBy: string): Promise<string> {
  const slotCount = slotCountOf(teaser);
  const slots: TeaserSlot[] = Array.from({ length: slotCount }, () => ({ answer: "", by: "" }));
  const run: Omit<TeaserRun, "id"> = {
    kind: "teaser",
    teaserId: teaser.id,
    title: teaser.title,
    prompt: teaser.prompt,
    picker: teaser.picker,
    answers: teaser.answers,
    distractors: teaser.distractors,
    slotCount,
    slots,
    status: "ready",
    timerSeconds: teaser.seconds,
    timerState: "idle",
    timerRemaining: teaser.seconds,
    timerSeq: 0,
    createdBy,
    createdAt: new Date().toISOString(),
  };
  const ref = await addDoc(collection(db, "gameRuns"), clean(run));
  return ref.id;
}

export function subscribeRun(
  id: string,
  onChange: (run: TeaserRun | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "gameRuns", id),
    (snap) => onChange(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<TeaserRun, "id">) } as TeaserRun) : null),
    (err) => onError?.(err)
  );
}

export async function updateRun(id: string, data: Partial<Omit<TeaserRun, "id">>): Promise<void> {
  await updateDoc(doc(db, "gameRuns", id), clean(data));
}

export async function deleteRun(id: string): Promise<void> {
  await deleteDoc(doc(db, "gameRuns", id));
}

export { BIBLE_BOOKS };
