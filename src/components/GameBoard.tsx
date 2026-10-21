"use client";

import { isTurnBased, rankSides, turnSide, whoAmIPoints, winners } from "@/lib/games";
import { Badge } from "@/components/ui";
import { BLANK, GAME_LABEL, gameHasHints } from "@/types/games";
import type { RoundTimer } from "@/lib/useRoundTimer";
import type { GameRound, GameSession } from "@/types/games";

/**
 * What the big screen and the overlay show before a game starts: just a tag
 * with the game's name. The first question appears once the admin starts the game.
 */
export function GameTag({ game, large }: { game: GameSession["game"]; large?: boolean }) {
  return (
    <p
      role="status"
      className={[
        "inline-block max-w-full rounded-md text-rccg-purple-700 text-center font-display font-bold bg-white shadow-lg capitalize",
        large ? "px-8 py-6 text-10xl sm:px-12 sm:py-8 sm:text-6xl" : "px-5 py-3 text-2xl sm:text-3xl",
      ].join(" ")}
    >
      {GAME_LABEL[game]}
    </p>
  );
}

/** The scrambled letters, spaced out so each tile is easy to read from across a room. */
function LetterTiles({ text, large }: { text: string; large?: boolean }) {
  const words = text.split(" ");
  return (
    <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
      {words.map((word, wi) => (
        <div key={wi} className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
          {word.split("").map((ch, i) => (
            <span
              key={i}
              className={[
                "flex items-center justify-center rounded-lg bg-rccg-purple-700 font-display font-bold text-white shadow-sm",
                large ? "h-14 w-14 text-3xl sm:h-20 sm:w-20 sm:text-5xl" : "h-11 w-11 text-2xl sm:h-14 sm:w-14 sm:text-3xl",
              ].join(" ")}
            >
              {ch}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The countdown, shown in the corner of the round. */
export function TimerBadge({ timer, large, inline }: { timer: RoundTimer; large?: boolean; inline?: boolean }) {
  const over = timer.state !== "idle" && timer.remaining <= 0;
  const idle = timer.state === "idle";
  const low = !idle && timer.remaining <= 10;
  const tone = over
    ? "border-rccg-red-600 bg-rccg-red-600 text-white"
    : low
      ? "border-amber-400 bg-amber-50 text-amber-900"
      : idle
        ? "border-line bg-white text-muted"
        : "border-rccg-purple-300 bg-rccg-purple-50 text-rccg-purple-800";
  return (
    <div
      role="timer"
      aria-label={over ? "Time is up" : `${formatClock(timer.remaining)} left`}
      className={[
        inline ? "inline-block" : "absolute right-0 top-0",
        "rounded-xl border font-display font-bold tabular-nums",
        large ? "px-5 py-2 text-5xl" : "px-3 py-1 text-xl",
        tone,
        timer.state === "paused" ? "opacity-70" : "",
      ].join(" ")}
    >
      {over ? "Time's up" : formatClock(timer.remaining)}
    </div>
  );
}

interface RoundProps {
  session: GameSession;
  round: GameRound;
  large?: boolean;
  /** The admin always sees the answer; the projector only once it's revealed. */
  showAnswer: boolean;
  /** Whether a scramble's hint is shown. Defaults to the session's setting. */
  showHint?: boolean;
  timer?: RoundTimer;
  /** Bible Relay: keep the verse hidden. The big screen holds it back until the host calls it. */
  hold?: boolean;
}

/** Who Am I?: the clues shown so far, with the rest locked until the admin reveals them. */
function WhoAmIClues({ session, round, large }: { session: GameSession; round: GameRound; large?: boolean }) {
  const clues = round.clues ?? [];
  const shown = Math.min(Math.max(session.cluesShown ?? 1, 1), clues.length);
  const worth = whoAmIPoints(session, round);
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <p className={`font-display font-bold text-rccg-purple-800 ${large ? "text-5xl" : "text-3xl"}`}>Who am I?</p>
      <ol className="space-y-2 text-left">
        {clues.map((clue, i) => {
          const visible = i < shown;
          const newest = i === shown - 1;
          return (
            <li
              key={i}
              className={[
                "flex gap-3 rounded-xl border px-4",
                large ? "py-4 text-2xl" : "py-2.5 text-base",
                visible
                  ? newest
                    ? "border-rccg-green-500 bg-rccg-green-50 text-ink"
                    : "border-line bg-white text-ink"
                  : "border-dashed border-line text-muted",
              ].join(" ")}
            >
              <span className="num w-6 shrink-0 font-semibold text-rccg-purple-700">{i + 1}</span>
              <span>{visible ? clue : "Locked"}</span>
            </li>
          );
        })}
      </ol>
      <p className={`font-medium text-rccg-green-700 ${large ? "text-2xl" : "text-sm"}`}>
        Worth {worth} point{worth === 1 ? "" : "s"} right now
      </p>
    </div>
  );
}

/** A verse with each missing word shown as a blank box. */
function VerseWithBlanks({ text, large }: { text: string; large?: boolean }) {
  const parts = text.split(BLANK);
  return (
    <p className={`mx-auto max-w-4xl font-display font-semibold leading-relaxed text-rccg-purple-800 ${large ? "text-3xl sm:text-5xl" : "text-xl sm:text-2xl"}`}>
      &ldquo;
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <span
              aria-label="missing word"
              className={`mx-1 inline-block rounded-md border-b-4 border-rccg-green-600 bg-rccg-green-50 align-baseline ${large ? "w-32" : "w-20"}`}
            >
              &nbsp;
            </span>
          )}
        </span>
      ))}
      &rdquo;
    </p>
  );
}

/** Whose turn it is, and a reminder that a passed question is worth half. Shown above the question. */
function TurnBanner({ session, large }: { session: GameSession; large?: boolean }) {
  const side = turnSide(session);
  if (!side) return null;
  const passed = (session.passes ?? 0) > 0;
  return (
    <p className={`flex flex-wrap items-center justify-center gap-2 font-display font-semibold text-rccg-purple-700 ${large ? "text-3xl" : "text-lg"}`}>
      <span aria-hidden="true">▶</span>
      {side.name}&rsquo;s turn
      {passed && <Badge tone="amber">Passed on · half points</Badge>}
    </p>
  );
}

/** What is on screen for the current round. Used by both the run screen and the projector. */
export function RoundView({ session, round, large, showAnswer, showHint, timer, hold }: RoundProps) {
  const game = session.game;
  const hasHints = gameHasHints(game);
  const hintOn = showHint ?? session.showHints !== false;
  // Older sessions stored "Bible" for a true quote; anything that isn't Cap is Scripture.
  const isCap = game === "bibleOrCap" && round.answer === "Cap";
  const answerTone = isCap ? "text-rccg-red-600" : "text-rccg-green-700";
  // Scripture shows its verse; Cap shows where the saying really comes from.
  const note = isCap ? round.explanation : round.reference;
  // Bible Relay: who found the verse first, and whether the verse is still being kept back.
  const found = game === "relay" ? session.sides.filter((s) => (round.awards[s.id] ?? 0) > 0).map((s) => s.name) : [];
  const waiting = game === "relay" && (!!hold || !round.prompt);
  const answerText =
    game === "relay"
      ? found.length > 0
        ? `Found first by ${found.join(" and ")}`
        : "Nobody found it"
      : game === "spouseQuiz"
        ? round.answer.split(",").map((a) => a.trim()).filter(Boolean).join(" or ")
        : game === "scramble"
      ? round.answer.toUpperCase()
      : game === "bibleOrCap"
        ? isCap
          ? "CAP ✗"
          : "SCRIPTURE ✓"
        : round.answer;

  return (
    <div className="space-y-5 text-center">
      {/* The timer has its own row above the content, so it can never sit on top of the text. */}
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-left text-xs font-semibold uppercase tracking-wide text-muted">
          {game === "board"
            ? `${round.category} · ${round.value ?? 0} points`
            : `Round ${session.currentRound + 1} of ${session.rounds.length} · ${round.category}`}
        </p>
        {timer?.enabled && <TimerBadge timer={timer} large={large} inline />}
      </div>

      {isTurnBased(session) && <TurnBanner session={session} large={large} />}

      {game === "relay" &&
        (waiting ? (
          <p className={`font-display font-bold text-rccg-purple-700 ${large ? "text-6xl" : "text-3xl"}`}>Get ready…</p>
        ) : (
          <p className={`font-display font-black text-rccg-purple-800 ${large ? "text-8xl" : "text-5xl"}`}>{round.prompt}</p>
        ))}

      {game === "spouseQuiz" && (
        <p className={`mx-auto max-w-4xl font-display font-semibold text-rccg-purple-800 ${large ? "text-5xl sm:text-6xl" : "text-2xl sm:text-3xl"}`}>
          Who was <span className="text-rccg-green-700">{round.prompt}</span> married to?
        </p>
      )}

      {game === "scramble" && <LetterTiles text={round.prompt} large={large} />}

      {game === "bookGuess" && (
        <p className={`font-display font-semibold text-rccg-green-700 ${large ? "text-3xl" : "text-lg"}`}>Which book of the Bible?</p>
      )}

      {(game === "emoji" || game === "bookGuess") && (
        <p
          className={`mx-auto max-w-4xl break-words leading-tight ${large ? "text-7xl sm:text-9xl" : "text-5xl sm:text-7xl"}`}
          aria-label="Emoji clue"
        >
          {round.prompt}
        </p>
      )}

      {game === "fillBlank" && <VerseWithBlanks text={round.prompt} large={large} />}

      {game === "whoAmI" && <WhoAmIClues session={session} round={round} large={large} />}

      {game === "board" && (
        <p className={`mx-auto max-w-4xl font-display font-semibold leading-snug text-rccg-purple-800 ${large ? "text-3xl sm:text-5xl" : "text-xl sm:text-2xl"}`}>
          {round.prompt}
        </p>
      )}

      {game === "bibleOrCap" && (
        <p className={`mx-auto max-w-3xl font-display font-semibold text-rccg-purple-800 ${large ? "text-3xl sm:text-5xl" : "text-xl sm:text-2xl"}`}>
          &ldquo;{round.prompt}&rdquo;
        </p>
      )}

      {hasHints && hintOn && round.hint && (
        <p className={`mx-auto max-w-xl text-muted ${large ? "text-xl" : "text-sm"}`}>Hint: {round.hint}</p>
      )}

      {showAnswer && (
        <div className={`mx-auto max-w-3xl rounded-xl border border-line bg-white px-5 py-4 ${large ? "py-6" : ""}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{game === "relay" ? "Result" : "Answer"}</p>
          <p
            className={[
              "font-display font-bold",
              game === "bibleOrCap" ? answerTone : "text-rccg-green-700",
              large ? "text-4xl sm:text-6xl" : "text-2xl sm:text-3xl",
            ].join(" ")}
          >
            {answerText}
          </p>
          {round.completed && (
            <p className={`mt-2 text-ink ${large ? "text-2xl" : "text-sm"}`}>&ldquo;{round.completed}&rdquo;</p>
          )}
          {note && <p className={`mt-1 text-muted ${large ? "text-xl" : "text-sm"}`}>{note}</p>}
        </div>
      )}
    </div>
  );
}

interface ScoreProps {
  session: GameSession;
  large?: boolean;
  /** Called when a side is tapped (the run screen uses this to award points). */
  onSideClick?: (sideId: string) => void;
  awardedThisRound?: Record<string, number>;
  /** The side whose turn it is: to pick the next tile on a quiz board, or to answer. */
  pickerId?: string;
  /** What the badge on that side says. Defaults to "Picks next". */
  pickerLabel?: string;
}

export function Scoreboard({ session, large, onSideClick, awardedThisRound, pickerId, pickerLabel = "Picks next" }: ScoreProps) {
  const ranked = rankSides(session);
  // Keep sides in their set-up order while playing so cards don't jump around;
  // the ranking number is still shown.
  const rankOf = new Map(ranked.map((r) => [r.side.id, r]));
  const leaderPoints = ranked[0]?.points ?? 0;

  return (
    <ul className={`grid gap-3 ${session.sides.length > 2 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"}`}>
      {session.sides.map((side) => {
        const r = rankOf.get(side.id);
        const points = r?.points ?? 0;
        const leading = leaderPoints > 0 && points === leaderPoints;
        const won = awardedThisRound?.[side.id] ?? 0;
        const content = (
          <>
            <div className="flex items-start justify-between gap-2">
              <p className={`min-w-0 truncate font-display font-semibold text-rccg-purple-800 ${large ? "text-2xl" : "text-base"}`}>
                {side.name}
              </p>
              <span className="flex shrink-0 gap-1">
                {pickerId === side.id && <Badge tone="purple">{pickerLabel}</Badge>}
                {leading && <Badge tone="green">Leading</Badge>}
              </span>
            </div>
            <p className={`num font-display font-bold text-rccg-purple-700 ${large ? "mt-2 text-7xl" : "mt-1 text-4xl"}`}>{points}</p>
            {side.members.length > 1 && (
              <p className={`mt-1 truncate text-muted ${large ? "text-base" : "text-xs"}`}>
                {side.members.map((m) => m.name).join(", ")}
              </p>
            )}
            {won !== 0 && (
              <p className={`mt-1 text-xs font-medium ${won > 0 ? "text-rccg-green-700" : "text-rccg-red-600"}`}>
                {won > 0 ? "+" : ""}
                {won} this round
              </p>
            )}
          </>
        );
        const base = `card ${leading ? "!border-rccg-green-500" : ""}`;
        return (
          <li key={side.id}>
            {onSideClick ? (
              <button
                type="button"
                onClick={() => onSideClick(side.id)}
                className={`${base} block w-full text-left transition-colors hover:border-rccg-green-500 hover:bg-rccg-green-50`}
              >
                {content}
              </button>
            ) : (
              <div className={base}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** The result shown when a session is finished. */
export function FinalResult({ session, large }: { session: GameSession; large?: boolean }) {
  const ranked = rankSides(session);
  const won = winners(session);
  const headline =
    won.length === 0 ? "No points were scored" : won.length === 1 ? `${won[0].name} wins!` : `It's a tie: ${won.map((w) => w.name).join(" and ")}`;

  return (
    <div className="space-y-5 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Final result</p>
      <p className={`font-display font-bold text-rccg-purple-800 ${large ? "text-5xl sm:text-7xl" : "text-3xl"}`}>{headline}</p>
      <ol className="mx-auto max-w-md divide-y divide-line rounded-xl border border-line bg-white text-left">
        {ranked.map((r) => (
          <li key={r.side.id} className={`flex items-center gap-3 px-4 ${large ? "py-4 text-2xl" : "py-3 text-base"}`}>
            <span className="num w-6 text-muted">{r.rank}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{r.side.name}</span>
            <span className="num font-display font-bold text-rccg-purple-700">{r.points}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The quiz board: categories across the top, point levels down the side. */
export function QuizBoard({
  session,
  large,
  onPick,
  showRound = true
}: {
  session: GameSession;
  large?: boolean;
  /** Called with a round index when a tile is chosen. Omit for a read-only board. */
  onPick?: (roundIndex: number) => void;
  showRound?: boolean
}) {
  const categories = session.boardCategories ?? [];
  const values = session.boardValues ?? [];
  const columns = { gridTemplateColumns: `repeat(${Math.max(categories.length, 1)}, minmax(${large ? "8rem" : "5.5rem"}, 1fr))` };

  return (
    <div className="overflow-x-auto">
      <div className="grid gap-2" style={columns}>
        {categories.map((category) => (
          <div
            key={category}
            className={`flex items-center justify-center rounded-lg bg-rccg-purple-800 px-2 text-center font-display font-semibold text-white ${
              large ? "min-h-24 py-3 text-2xl" : "min-h-14 py-2 text-sm"
            }`}
          >
            {category}
          </div>
        ))}
        {values.flatMap((value) =>
          categories.map((category) => {
            const index = session.rounds.findIndex((r) => r.category === category && r.value === value);
            const tile = session.rounds[index];
            const base = `flex items-center justify-center rounded-lg font-display font-bold ${large ? "min-h-24 text-5xl" : "min-h-14 text-2xl"}`;
            if (!tile) return <div key={`${category}-${value}`} className={`${base} border border-dashed border-line`} aria-hidden="true" />;
            if (tile.played) {
              return (
                <div key={tile.questionId} className={`${base} bg-mist text-muted`} aria-label={`${category} ${value}, already played`}>
                  &mdash;
                </div>
              );
            }
            return onPick ? (
              <button
                key={tile.questionId}
                type="button"
                onClick={() => onPick(index)}
                aria-label={`${category} for ${value}`}
                className={`${base} num bg-rccg-purple-700 text-white transition-colors hover:bg-rccg-purple-600`}
              >
                {value}
              </button>
            ) : (
              <div key={tile.questionId} className={`${base} num bg-rccg-purple-700 text-white`}>
                {value}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/** A slim row of score pills, made for sitting along the edge of a video. */
export function ScoreStrip({ session, large }: { session: GameSession; large?: boolean }) {
  const ranked = rankSides(session);
  const best = ranked[0]?.points ?? 0;
  const pointsOf = new Map(ranked.map((r) => [r.side.id, r.points]));
  const pickerId = turnSide(session)?.id;

  return (
    <ul className="flex flex-wrap justify-center gap-3">
      {session.sides.map((side) => {
        const points = pointsOf.get(side.id) ?? 0;
        const leading = best > 0 && points === best;
        return (
          <li
            key={side.id}
            className={[
              "flex items-center gap-3 rounded-full bg-rccg-purple-800 text-white shadow-md",
              large ? "px-6 py-2.5 text-3xl" : "px-4 py-1.5 text-lg",
              leading ? "ring-4 ring-rccg-green-500" : "",
            ].join(" ")}
          >
            {pickerId === side.id && <span aria-label="Their turn">▶</span>}
            <span className="max-w-[14ch] truncate font-display font-semibold">{side.name}</span>
            <span className="num rounded-full bg-white px-3 font-display font-bold text-rccg-purple-800">{points}</span>
          </li>
        );
      })}
    </ul>
  );
}
