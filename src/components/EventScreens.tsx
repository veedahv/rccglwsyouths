"use client";

import type { CSSProperties, ReactNode } from "react";
import Logo from "@/components/Logo";
import HowToPlay from "@/components/HowToPlay";
import CoupleGrid from "@/components/CoupleGrid";
import { GameTag, QuizBoard, RoundView, Scoreboard } from "@/components/GameBoard";
import { GameResult } from "@/components/ResultCard";
import { GAME_LABEL, hasStarted } from "@/types/games";
import { turnSide } from "@/lib/games";
import type { RoundTimer } from "@/lib/useRoundTimer";
import type { EventSummary, GameKind, GameSession, Lineup } from "@/types/games";

const GOLD = "#E8B04A";

/* ------------------------------------------------------------------ */
/* Cover                                                               */
/* ------------------------------------------------------------------ */

type Decor = { x: number; y: number; size: number; rotate: number; kind: string };

// Scattered, faded shapes behind the cover: letter tiles, smileys, question
// marks, dice, a book, a trophy, a grid and sparkles. Positions are
// percentages of the screen so it works on a phone, a TV or a projector.
const DECOR: Decor[] = [
  { x: 5, y: 8, size: 9, rotate: -12, kind: "M" },
  { x: 14, y: 20, size: 7, rotate: 8, kind: "E" },
  { x: 20, y: 6, size: 8, rotate: 6, kind: "G" },
  { x: 86, y: 7, size: 9, rotate: 0, kind: "smile" },
  { x: 76, y: 20, size: 7, rotate: 10, kind: "?" },
  { x: 3, y: 46, size: 4, rotate: 0, kind: "spark" },
  { x: 95, y: 40, size: 4, rotate: 0, kind: "spark" },
  { x: 6, y: 62, size: 9, rotate: -8, kind: "dice" },
  { x: 88, y: 58, size: 10, rotate: 6, kind: "book" },
  { x: 7, y: 86, size: 9, rotate: -6, kind: "trophy" },
  { x: 24, y: 91, size: 8, rotate: 0, kind: "frame" },
  { x: 40, y: 88, size: 8, rotate: 0, kind: "grid" },
  { x: 62, y: 90, size: 7, rotate: 14, kind: "S" },
  { x: 74, y: 84, size: 7, rotate: -8, kind: "?" },
  { x: 88, y: 88, size: 9, rotate: 0, kind: "smile" },
  { x: 71, y: 91, size: 3, rotate: 0, kind: "spark" },
];

function DecorShape({ kind }: { kind: string }) {
  const fill = "currentColor";
  switch (kind) {
    case "smile":
      return (
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <circle cx="50" cy="50" r="48" fill={fill} />
          <circle cx="35" cy="40" r="6" fill="var(--decor-cut)" />
          <circle cx="65" cy="40" r="6" fill="var(--decor-cut)" />
          <path d="M28 60 Q50 82 72 60" stroke="var(--decor-cut)" strokeWidth="7" strokeLinecap="round" fill="none" />
        </svg>
      );
    case "dice":
      return (
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <rect x="6" y="6" width="88" height="88" rx="16" fill={fill} />
          {[[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="8" fill="var(--decor-cut)" />
          ))}
        </svg>
      );
    case "book":
      return (
        <svg viewBox="0 0 100 80" className="h-full w-full">
          <path d="M4 10 Q28 2 48 12 V74 Q28 64 4 72 Z" fill={fill} />
          <path d="M96 10 Q72 2 52 12 V74 Q72 64 96 72 Z" fill={fill} />
        </svg>
      );
    case "trophy":
      return (
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <path d="M28 8 H72 V40 Q72 62 50 64 Q28 62 28 40 Z" fill={fill} />
          <path d="M28 16 H10 Q10 40 30 46 M72 16 H90 Q90 40 70 46" stroke={fill} strokeWidth="7" fill="none" />
          <rect x="44" y="62" width="12" height="18" fill={fill} />
          <rect x="28" y="80" width="44" height="12" rx="4" fill={fill} />
        </svg>
      );
    case "grid":
      return (
        <svg viewBox="0 0 100 100" className="h-full w-full">
          {[0, 1, 2].flatMap((r) =>
            [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={4 + c * 32} y={4 + r * 32} width="28" height="28" rx="6" fill={fill} />)
          )}
        </svg>
      );
    case "frame":
      return (
        <svg viewBox="0 0 100 70" className="h-full w-full">
          <rect x="4" y="4" width="92" height="62" rx="10" fill="none" stroke={fill} strokeWidth="5" strokeDasharray="12 8" />
          <rect x="30" y="32" width="40" height="7" rx="3" fill={fill} />
        </svg>
      );
    case "spark":
      return (
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <path d="M50 0 C54 36 64 46 100 50 C64 54 54 64 50 100 C46 64 36 54 0 50 C36 46 46 36 50 0 Z" fill={fill} />
        </svg>
      );
    default:
      // A letter tile or a question-mark disc.
      return (
        <div
          className="flex h-full w-full items-center justify-center bg-current font-display font-black"
          style={{ borderRadius: kind === "?" ? "9999px" : "18%" }}
        >
          <span className="text-[var(--decor-cut)]" style={{ fontSize: "min(5vw, 5vh)", lineHeight: 1 }}>
            {kind}
          </span>
        </div>
      );
  }
}

/** The faded icons only. Put it behind content inside a `relative overflow-hidden` box. */
export function CoverDecor({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${tone === "dark" ? "text-white/[0.05]" : "text-rccg-purple-700/[0.045]"}`}
      // The cut-outs (eyes, dots, letters) take the page colour, so they melt into it instead of standing out.
      style={{ ["--decor-cut" as string]: tone === "dark" ? "#180C62" : "#F6F5FA" }}
      aria-hidden="true"
    >
      {DECOR.map((d, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: `${d.x}%`,
            top: `${d.y}%`,
            width: `${d.size}vmin`,
            height: `${d.size}vmin`,
            transform: `translate(-50%, -50%) rotate(${d.rotate}deg)`,
          }}
        >
          <DecorShape kind={d.kind} />
        </div>
      ))}
    </div>
  );
}

interface CoverEvent {
  title: string;
  subtitle?: string;
  venue?: string;
  plannedGames: GameKind[];
  hosts?: { name: string }[];
}

/**
 * The cover screen: title, when it is, the games to be played and the faded
 * icons, on the navy of the poster. Fills whatever box it is put in.
 */
export function EventCover({ event }: { event: CoverEvent }) {
  const games = event.plannedGames;
  const titleStyle: CSSProperties = {
    fontSize: "clamp(3rem, 13vmin, 11rem)",
    lineHeight: 0.95,
    textShadow: `0.05em 0.05em 0 ${GOLD}`,
  };
  return (
    <div className="relative flex h-full min-h-full w-full flex-col overflow-hidden bg-rccg-purple-700 text-white">
      {/* The green, gold and red stripe from the poster. */}
      <div className="flex h-2 w-full shrink-0">
        <span className="flex-1 bg-rccg-green-500" />
        <span className="flex-1" style={{ background: GOLD }} />
        <span className="flex-1 bg-rccg-red-600" />
      </div>
      <CoverDecor />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-[3vmin] px-6 py-8 text-center">
        <div className="rounded-2xl bg-white/95 px-4 py-2 shadow-lg">
          <Logo size={64} />
        </div>

        <h1 className="max-w-[92vw] break-words font-display font-black uppercase" style={titleStyle}>
          {event.title}
        </h1>

        {event.subtitle && (
          <p
            className="rounded-full px-[4vmin] py-[1.4vmin] font-display font-bold uppercase tracking-wide text-rccg-purple-700"
            style={{ background: GOLD, fontSize: "clamp(1rem, 3.4vmin, 2.5rem)" }}
          >
            {event.subtitle}
          </p>
        )}

        {games.length > 0 && (
          <div className="w-full max-w-5xl">
            <p
              className="mb-[1.6vmin] font-display font-semibold uppercase tracking-[0.3em] text-rccg-green-200"
              style={{ fontSize: "clamp(0.8rem, 2.2vmin, 1.5rem)" }}
            >
              {games.length === 1 ? "One game to play" : `${games.length} games to play`}
            </p>
            <ol className={`grid gap-[1.4vmin] text-left ${games.length === 1 ? "" : "sm:grid-cols-2"}`}>
              {games.map((game, i) => (
                <li
                  key={`${game}-${i}`}
                  className="flex items-center gap-[2vmin] rounded-2xl border border-white/10 bg-white/10 px-[2.4vmin] py-[1.8vmin]"
                >
                  <span className="num font-display font-bold" style={{ color: GOLD, fontSize: "clamp(1.5rem, 5vmin, 3.5rem)" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-display font-semibold" style={{ fontSize: "clamp(1rem, 3vmin, 2.2rem)" }}>
                    {GAME_LABEL[game]}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div
        className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-[4vmin] pb-[3vmin]"
        style={{ fontSize: "clamp(0.9rem, 2.4vmin, 1.7rem)" }}
      >
        <span className="text-white/70">
          {[event.venue ? `Venue: ${event.venue}` : "", event.hosts?.length ? `Hosted by ${event.hosts.map((h) => h.name).join(" and ")}` : ""]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <span className="font-display font-semibold">Come ready to play.</span>
      </div>
    </div>
  );
}

/** What the overlay shows on the cover: just the event's title (and when), as a tag. */
export function EventTag({ title, subtitle, large }: { title: string; subtitle?: string; large?: boolean }) {
  return (
    <div role="status" className="inline-block max-w-full rounded-md bg-white text-center shadow-lg">
      <p className={`font-display font-bold uppercase text-rccg-purple-700 ${large ? "px-8 py-6 text-6xl" : "px-5 py-3 text-2xl sm:text-3xl"}`}>
        {title}
      </p>
      {subtitle && <p className={`border-t border-line text-muted ${large ? "px-8 py-3 text-2xl" : "px-5 py-1.5 text-sm"}`}>{subtitle}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overall board                                                       */
/* ------------------------------------------------------------------ */

function headline(lineup: Lineup, final: boolean): string {
  if (lineup.winners.length === 0) return final ? "No points were scored" : "No points yet";
  if (lineup.winners.length > 1) return `${final ? "It's a tie" : "Tied"}: ${lineup.winners.join(" and ")}`;
  return final ? `${lineup.winners[0]} wins overall!` : `${lineup.winners[0]} leads`;
}

function LineupTable({ lineup, large, final, showTitle, bare }: { lineup: Lineup; large?: boolean; final: boolean; showTitle: boolean; bare?: boolean }) {
  const byGame = lineup.games.length > 1 && lineup.games.length <= 6;
  const cell = large ? "px-4 py-3" : "px-3 py-2";
  return (
    <section className="space-y-3 text-center">
      {showTitle && <p className="text-xs font-semibold uppercase tracking-wide text-muted">{lineup.label}</p>}
      {!bare && (
        <p className={`font-display font-bold text-rccg-purple-800 ${large ? "text-5xl sm:text-6xl" : "text-2xl sm:text-3xl"}`}>
          {headline(lineup, final)}
        </p>
      )}
      <div className="mx-auto max-w-4xl overflow-x-auto rounded-xl border border-line bg-white text-left">
        <table className={`w-full ${large ? "text-2xl" : "text-sm"}`}>
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <th className={`${cell} w-10 font-semibold`}>#</th>
              <th className={`${cell} font-semibold`}>Side</th>
              {byGame &&
                lineup.games.map((g) => (
                  <th key={g.id} className={`${cell} text-right font-semibold normal-case tracking-normal`}>
                    {GAME_LABEL[g.game]}
                  </th>
                ))}
              <th className={`${cell} text-right font-semibold`}>Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lineup.rows.map((row) => (
              <tr key={row.id} className={row.rank === 1 && row.total > 0 ? "bg-rccg-green-50" : ""}>
                <td className={`${cell} num text-muted`}>{row.rank}</td>
                <td className={`${cell} font-medium`}>
                  {row.name}
                  {row.members && <span className="block truncate text-xs font-normal text-muted">{row.members}</span>}
                </td>
                {byGame &&
                  lineup.games.map((g) => (
                    <td key={g.id} className={`${cell} num text-right text-muted`}>
                      {row.perGame[g.id] ?? "–"}
                    </td>
                  ))}
                <td className={`${cell} num text-right font-display font-bold text-rccg-purple-700`}>{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * The overall board: for each group of games played by the same sides, one
 * table (a column per game, then the total) with the overall winner on top,
 * then who won each game on its own.
 */
/** `bare` leaves out the "Final result" label and the winner's headline, for use under a result card that already says it. */
export function OverallBoard({ summary, large, final, bare }: { summary: EventSummary; large?: boolean; final?: boolean; bare?: boolean }) {
  const { lineups, results } = summary;
  if (results.length === 0) {
    return <p className={`text-center text-muted ${large ? "text-3xl" : "text-sm"}`}>No games have been played yet.</p>;
  }
  // A lineup that played only once is just that game's result, so it is listed below
  // instead, unless it is the only lineup there is.
  const tables = lineups.filter((l) => l.games.length > 1 || lineups.length === 1);
  const isFinal = !!final;

  return (
    <div className="space-y-6">
      {!bare && (
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted">
          {isFinal ? "Final result" : "Standings so far"}
        </p>
      )}
      {tables.map((l) => (
        <LineupTable key={l.key} lineup={l} large={large} final={isFinal} showTitle={lineups.length > 1} bare={bare} />
      ))}

      {(results.length > 1 || tables.length === 0) && (
        <section className="mx-auto max-w-4xl">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-muted">Game by game</p>
          <ul className="divide-y divide-line rounded-xl border border-line bg-white">
            {results.map((r) => (
              <li key={r.id} className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 ${large ? "py-4 text-2xl" : "py-2.5 text-sm"}`}>
                <span className="min-w-0 flex-1 font-medium">
                  {GAME_LABEL[r.game]}
                  <span className="ml-2 text-xs font-normal text-muted">{r.lineup}</span>
                </span>
                <span className={r.winners.length ? "font-display font-semibold text-rccg-green-700" : "text-muted"}>
                  {r.status !== "finished"
                    ? "In progress"
                    : r.winners.length === 0
                      ? "No winner"
                      : r.winners.length > 1
                        ? `Tie: ${r.winners.join(" and ")}`
                        : `${r.winners[0]} won`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One game on the big screen                                          */
/* ------------------------------------------------------------------ */

/** A game as the big screen shows it: the tag before it starts, then the round or board with the scores, then the result. */
export function SessionBigScreen({ session, timer }: { session: GameSession; timer: RoundTimer }): ReactNode {
  const round = session.currentRound >= 0 ? session.rounds[session.currentRound] : undefined;
  const onBoard = session.game === "board" && session.currentRound < 0;
  const onGrid = session.game === "spouses";

  if (session.status === "finished") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <GameResult session={session} large />
      </div>
    );
  }
  if (!hasStarted(session)) {
    // Not started: only the game's name. The first question follows once the admin starts the game.
    // The players read the rules here while the host explains them. The overlay shows only the tag.
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <GameTag game={session.game} large />
        <HowToPlay session={session} large />
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col justify-between gap-8">
      <div className="flex flex-1 items-center justify-center">
        {onGrid ? (
          <div className="w-full">
            <CoupleGrid session={session} large />
          </div>
        ) : onBoard ? (
          <div className="w-full">
            <QuizBoard session={session} large />
          </div>
        ) : (
          round && <RoundView session={session} round={round} large showAnswer={session.revealed} timer={timer} hold={session.game === "relay" && !session.called} />
        )}
      </div>
      <Scoreboard session={session} large pickerId={turnSide(session)?.id} pickerLabel={onBoard ? "Picks next" : "Their turn"} />
    </div>
  );
}
