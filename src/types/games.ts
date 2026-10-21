// Game sessions: an admin runs a game night, picks who is playing and how
// they are grouped, and awards points round by round (version 1 is
// admin-scored; youths answering on their own phones is a later feature).

export type GameKind = "scramble" | "bibleOrCap" | "emoji" | "fillBlank" | "whoAmI" | "board" | "bookGuess";

export const GAME_LABEL: Record<GameKind, string> = {
  scramble: "Scrambled words",
  bibleOrCap: "Scripture or Cap",
  emoji: "Emoji Bible Trivia",
  fillBlank: "Fill in the missing word",
  whoAmI: "Who Am I?",
  board: "Quiz board",
  bookGuess: "Guess the Book",
};

/** Has the game been started? Older sessions have no flag and count as started. */
export function hasStarted(session: { started?: boolean }): boolean {
  return session.started === true;
}

/** Games where a question can carry a hint the admin can hide. */
export function gameHasHints(game: GameKind): boolean {
  return game === "scramble" || game === "emoji" || game === "fillBlank";
}

/**
 * How a game's questions are answered.
 * - "free": whoever answers first gets the points, and the admin taps that side.
 * - "turns": one side at a time. If it misses, the admin can pass the question to the
 *   next side for half points, or give it to no one. Sessions made before this
 *   existed have no setting and play as "free" (a quiz board there only tracks who picks).
 */
export type PlayMode = "turns" | "free";

/** Who Am I? and the quiz board are always turn by turn. */
export function gameAlwaysTurns(game: GameKind): boolean {
  return game === "whoAmI" || game === "board";
}

/** The quick-answer games, where the admin chooses between turn by turn and first to answer. */
export function gameCanChoosePlayMode(game: GameKind): boolean {
  return !gameAlwaysTurns(game);
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
// - bookGuess ("Guess the Book"): `emojis` is a picture clue for a book of the Bible, `answer`
//   is the book, `category` is the difficulty (Easy, Medium or Hard) and `reference` says which
//   scene the clue shows (e.g. "Noah and the ark (Genesis 6-9)"), shown on reveal. A book can
//   have several clues: a game picks one of them at random and never uses a book twice.
//   Every clue should show one scene that belongs to one book only.
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
  // False until the admin presses "Start game". Until then the big screen and
  // the OBS overlay show only a tag with the game's name, and no question.
  // Missing on sessions made before this existed, which count as started.
  started?: boolean;
  revealed: boolean; // has the answer been shown for the current round?
  cluesShown?: number; // whoAmI: how many clues of the current round are on screen
  boardCategories?: string[]; // board: column order
  boardValues?: number[]; // board: row order (smallest first)
  playMode?: PlayMode; // see PlayMode. Missing means "free".
  // Turn by turn: index of the side answering right now. On a quiz board it is also the side
  // that picks the next tile. (Older boards without a playMode use it for the picker only.)
  turnIndex?: number;
  turnStart?: number; // turn by turn: the side the current round or tile started with, so the next one moves on from it
  passes?: number; // turn by turn: how many sides have missed the current round. Once above 0, points are halved.
  // The games event this game belongs to (see GameEvent). Missing on a stand-alone session.
  eventId?: string;
  // Private ID of this session's OBS overlay (see /overlay/[key]). A game inside an
  // event has none of its own: only the game on screen holds the event's overlay key.
  overlayKey?: string;
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
  createdBy: string; // uid of the exco who started the session
  // Their name at the time, saved with the session so the list can show who
  // started it. Information only: anyone with permission can still run any
  // session. Missing on sessions made before this existed.
  createdByName?: string;
  createdAt: string;
  finishedAt?: string;
}

/* ------------------------------------------------------------------ */
/* Games events: one occasion (e.g. "Games Day") with one or more games */
/* ------------------------------------------------------------------ */

// An event owns one big-screen page and one OBS overlay for the whole day.
// Each game inside it is an ordinary GameSession with `eventId` set, and each
// game picks its own sides, so Boys vs Girls can play the first game and
// Team A vs Team B the second. Games played by the same sides are added up
// into an overall result (see summarizeEvent in lib/gameEvents.ts).

/** What the event's screen and overlay are showing. */
export type EventView =
  | "cover" // the title screen, with the games to be played
  | "game" // the game in `activeSessionId`
  | "standings" // the overall board so far
  | "final"; // the overall board, with the overall winner

export interface GameEvent {
  id: string;
  title: string; // e.g. "Games Day"
  subtitle?: string; // e.g. "Wednesday · 21 October 2026 · 5:00 PM"
  venue?: string;
  plannedGames: GameKind[]; // the games listed on the cover, in order
  // Who came, taken on the event page. `presentIds` are youth IDs; guests have no youth record.
  // Missing means attendance hasn't been taken, and every active youth can be picked.
  presentIds?: string[];
  guests?: GamePlayer[];
  // The host or hosts. They run the games, so they are never picked to play.
  hosts?: GamePlayer[];
  view: EventView;
  activeSessionId?: string; // the game on screen while view is "game" ("" or missing otherwise)
  overlayKey: string; // private ID of the event's OBS overlay (see /overlay/[key])
  status: GameStatus; // "finished" once the final result has been shown
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

/** One row of an overall table: a side (or player) and what it scored in each game of its lineup. */
export interface LineupRow {
  id: string;
  name: string;
  members?: string;
  total: number;
  perGame: Record<string, number>; // sessionId -> points
  rank: number; // ties share a rank
}

/** Games played by the same sides, added up. */
export interface Lineup {
  key: string;
  label: string; // e.g. "Boys vs Girls"
  games: { id: string; title: string; game: GameKind }[];
  rows: LineupRow[];
  winners: string[]; // everyone tied for first, or none if nobody scored
}

/** How one game ended, for the "game by game" list. */
export interface GameResult {
  id: string;
  game: GameKind;
  lineup: string;
  status: GameStatus;
  winners: string[];
  topPoints: number;
}

export interface EventSummary {
  lineups: Lineup[];
  results: GameResult[];
}

/** What /gameOverlays/{key} holds while the event is not showing a game. */
export interface EventOverlay {
  kind: "event";
  view: "cover" | "standings" | "final";
  title: string;
  subtitle?: string;
  venue?: string;
  plannedGames: GameKind[];
  summary: EventSummary;
}

/** An overlay document is either a game (redacted) or the event's own screen. */
export type OverlayDoc = GameSession | EventOverlay;

export function isEventOverlay(doc: OverlayDoc): doc is EventOverlay {
  return (doc as EventOverlay).kind === "event";
}
