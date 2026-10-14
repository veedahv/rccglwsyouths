// Game sessions: an admin runs a game night, picks who is playing and how
// they are grouped, and awards points round by round (version 1 is
// admin-scored; youths answering on their own phones is a later feature).

export type GameKind = "scramble" | "bibleOrCap" | "emoji" | "fillBlank" | "whoAmI" | "board";

export const GAME_LABEL: Record<GameKind, string> = {
  scramble: "Scrambled words",
  bibleOrCap: "Scripture or Cap",
  emoji: "Emoji Bible Trivia",
  fillBlank: "Fill in the missing word",
  whoAmI: "Who Am I?",
  board: "Quiz board",
};

/** Games where a question can carry a hint the admin can hide. */
export function gameHasHints(game: GameKind): boolean {
  return game === "scramble" || game === "emoji" || game === "fillBlank";
}

/** In a fill-in-the-missing-word verse, each missing word is marked with this. */
export const BLANK = "___";

// /gameQuestions/{id} — the editable question bank.
// - scramble: `answer` is the word (or words) to unscramble, `hint` is optional.
// - bibleOrCap ("Scripture or Cap"): `statement` is a quote that is shown.
//   `isTrue` true means it really is Scripture (`reference` is the book,
//   chapter and verse shown on reveal); false means Cap, a saying that is
//   not in the Bible (`explanation` says where it really comes from).
// - emoji: `emojis` is the clue (e.g. "🐋🚢"), `answer` is the story or
//   character, `hint` and `reference` are optional.
// - fillBlank: `statement` is a verse with each missing word replaced by
//   "___", `answer` lists the missing words in order, separated by commas,
//   and `reference` is the verse.
// - whoAmI: `answer` is the person, `clues` are read one at a time, hardest
//   first and easiest last, and `reference` is optional.
// - board ("Quiz board", a Jeopardy-style grid): `category` is a column,
//   `value` is the points and row, `statement` is the clue, `answer` is the
//   response and `reference` is optional.
export interface GameQuestion {
  id: string;
  game: GameKind;
  category: string; // e.g. "Bible characters"
  answer?: string; // scramble, emoji and fillBlank
  hint?: string; // scramble, emoji and fillBlank (optional)
  emojis?: string; // emoji only
  clues?: string[]; // whoAmI only, hardest first
  value?: number; // board only (e.g. 100 to 500)
  statement?: string; // bibleOrCap and fillBlank
  isTrue?: boolean; // bibleOrCap only
  reference?: string; // bibleOrCap (Scripture only), emoji and fillBlank (e.g. "Philippians 4:13")
  explanation?: string; // bibleOrCap, Cap only (where the saying really comes from)
  createdAt: string;
}

// How the players are grouped for a session.
export type GameMode =
  | "gender" // Boys vs Girls
  | "teams" // Team A vs Team B (2 to 4 teams)
  | "duel" // one youth vs another (either can be a guest)
  | "selected" // picked youths (plus guests), each playing for themselves
  | "random"; // youths drawn at random, each playing for themselves

export const MODE_LABEL: Record<GameMode, string> = {
  gender: "Boys vs Girls",
  teams: "Team vs Team",
  duel: "1 vs 1",
  selected: "Selected youths",
  random: "Random draw",
};

export interface GamePlayer {
  id: string; // youth ID, or a generated ID for a guest
  name: string;
  gender?: "male" | "female";
  guest?: boolean;
}

// A "side" is whoever the points go to: a team, or a single player.
export interface GameSide {
  id: string;
  name: string;
  members: GamePlayer[];
}

// A frozen copy of the question as it was when the session was created, so
// editing the bank later never changes a game night that already happened.
export interface GameRound {
  questionId: string;
  prompt: string; // scramble: the scrambled letters. bibleOrCap: the quote. emoji: the emojis. fillBlank: the verse with blanks.
  answer: string; // scramble: the word. bibleOrCap: "Scripture" or "Cap" (older sessions may say "Bible"). emoji: the answer. fillBlank: the missing words.
  completed?: string; // fillBlank: the verse with the missing words filled in
  clues?: string[]; // whoAmI: every clue, hardest first
  value?: number; // board: what the tile is worth
  played?: boolean; // board: the tile has been used
  hint?: string;
  reference?: string;
  explanation?: string;
  category: string;
  awards: Record<string, number>; // sideId -> points won this round
}

export type GameStatus = "live" | "finished";

export type TimerState = "idle" | "running" | "paused";

export interface GameSession {
  id: string;
  title: string;
  game: GameKind;
  mode: GameMode;
  sides: GameSide[];
  rounds: GameRound[];
  currentRound: number; // index into rounds. On a quiz board, -1 means "showing the board".
  revealed: boolean; // has the answer been shown for the current round?
  cluesShown?: number; // whoAmI: how many clues of the current round are on screen
  boardCategories?: string[]; // board: column order
  boardValues?: number[]; // board: row order (smallest first)
  turnIndex?: number; // board: index of the side that picks the next tile
  overlayKey?: string; // private ID of this session's OBS overlay (see /overlay/[key])
  showHints?: boolean; // show each round's hint on screen where a game has hints (default true)
  // Round timer. timerSeconds is the limit set when the session was started
  // (0 or missing means no timer). The rest is the live state: the seconds
  // left as of the last change, and a counter so every screen restarts its
  // own countdown only when the admin actually touches the timer.
  timerSeconds?: number;
  timerState?: TimerState;
  timerRemaining?: number;
  timerSeq?: number;
  status: GameStatus;
  createdBy: string; // uid
  createdAt: string;
  finishedAt?: string;
}
