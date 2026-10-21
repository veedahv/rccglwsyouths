// Teasers: quick warm-up games with no rounds, no sides and no question bank.
// A teaser is a prompt with a set of answers ("Name 9 books of the Bible with
// only 4 letters"). People shout answers and the host taps each one in a
// picker; it fills the next numbered slot on the big screen.

import type { TimerState } from "@/types/games";

/** Which picker the host uses: the 66 books of the Bible, or a plain list of answers. */
export type PickerKind = "books" | "list";

export const PICKER_LABEL: Record<PickerKind, string> = {
  books: "Books of the Bible",
  list: "Pick from a list",
};

export interface TeaserAnswer {
  name: string; // for the books picker, exactly the book's name (e.g. "1 John")
  aliases?: string[]; // other accepted names, e.g. "Thomas" with "Didymus"
}

// /gameTeasers/{id} — the teasers themselves. New ones need no new code.
export interface Teaser {
  id: string;
  title: string; // e.g. "4-letter books"
  prompt: string; // e.g. "Name 9 books of the Bible with only 4 letters"
  picker: PickerKind;
  answers: TeaserAnswer[]; // every accepted answer
  // How many answers must be named. Leave out when all of them are needed. Open-ended
  // teasers ("Name 5 miracles of Jesus") list many accepted answers and set this lower.
  count?: number;
  distractors?: string[]; // list picker: wrong options shown among the right ones
  seconds: number; // one timer for the whole game (0 means no timer)
  createdAt: string;
}

export interface TeaserSlot {
  answer: string; // the answer that filled it ("" while empty)
  by: string; // who named it (optional, "" if not recorded)
}

/** A short message every screen reacts to: a shake, or an "already named" nudge. */
export interface TeaserFlash {
  kind: "hit" | "dup" | "miss";
  text: string;
  seq: number; // goes up on every pick so screens react to each one
}

export type TeaserStatus = "ready" | "live" | "finished";

// /gameRuns/{id} — one play of a game. `kind` decides which big-screen view and which host
// controls load, so other kinds of game can plug in later with their own views.
export interface TeaserRun {
  id: string;
  kind: "teaser";
  teaserId: string;
  title: string;
  prompt: string;
  picker: PickerKind;
  answers: TeaserAnswer[]; // a frozen copy, so editing the teaser never changes a game being played
  distractors?: string[];
  slotCount: number;
  slots: TeaserSlot[];
  status: TeaserStatus;
  timerSeconds: number;
  timerState: TimerState;
  timerRemaining: number;
  timerSeq: number;
  flash?: TeaserFlash;
  /** The private key of its public big-screen link (/screen/[key]). */
  overlayKey?: string;
  createdBy: string;
  createdAt: string;
}

export type GameRun = TeaserRun;
