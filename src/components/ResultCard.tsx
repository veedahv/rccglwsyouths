"use client";

import Confetti from "@/components/Confetti";
import type { EventSummary, GameSession } from "@/types/games";
import { rankSides } from "@/lib/games";

export interface ResultRow {
  id: string;
  name: string;
  points: number;
  rank: number;
  members?: string;
}

const GOLD = "#E8B04A";
const MEDAL = ["#E8B04A", "#C9CED6", "#CD8B5A"]; // gold, silver, bronze

function Trophy({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <path d="M28 8 H72 V40 Q72 62 50 64 Q28 62 28 40 Z" fill={GOLD} />
      <path d="M28 16 H10 Q10 40 30 46 M72 16 H90 Q90 40 70 46" stroke={GOLD} strokeWidth="7" fill="none" />
      <rect x="44" y="62" width="12" height="18" fill={GOLD} />
      <rect x="28" y="80" width="44" height="12" rx="4" fill={GOLD} />
    </svg>
  );
}

interface Props {
  rows: ResultRow[];
  /** True for the final result (a winner, a trophy, confetti); false for standings so far. */
  final: boolean;
  /** Small line above the heading, e.g. "Boys vs Girls" when an event has several sets of sides. */
  label?: string;
  large?: boolean;
  /** Confetti falls behind the card. Only for a final result with a winner. */
  confetti?: boolean;
}

/**
 * One result, drawn once: the winner, then every side ranked with a bar for its points. Used
 * for a finished game and for the overall result of a games event, on the big screen and in
 * the overlay (where it is narrow enough for portrait video).
 */
export default function ResultCard({ rows, final, label, large, confetti = true }: Props) {
  const best = rows[0]?.points ?? 0;
  const winners = best > 0 ? rows.filter((r) => r.rank === 1) : [];
  const tie = winners.length > 1;
  const top = Math.max(best, 1);

  const heading =
    winners.length === 0
      ? final
        ? "No points were scored"
        : "No points yet"
      : final
        ? winners.map((w) => w.name).join(" & ")
        : `${winners.map((w) => w.name).join(" & ")} ${tie ? "are level" : "leads"}`;
  const kicker = final ? (winners.length === 0 ? "Final result" : tie ? "It's a tie!" : "Winner") : "Standings so far";

  return (
    <section
      className="relative mx-auto w-full overflow-hidden rounded-3xl text-white shadow-2xl"
      style={{ background: "radial-gradient(120% 90% at 50% 0%, #2F1C86 0%, #180C62 55%, #110949 100%)" }}
    >
      {final && winners.length > 0 && confetti && <Confetti />}
      <div className={`flex h-1.5 w-full`} aria-hidden="true">
        <span className="flex-1 bg-rccg-green-500" />
        <span className="flex-1" style={{ background: GOLD }} />
        <span className="flex-1 bg-rccg-red-600" />
      </div>

      <div className={`text-center ${large ? "px-10 py-10" : "px-5 py-5"}`}>
        {label && <p className={`mb-1 font-semibold uppercase tracking-[0.2em] text-white/60 ${large ? "text-xl" : "text-xs"}`}>{label}</p>}
        {final && winners.length > 0 && (
          <div className="mx-auto mb-1 w-fit">
            <Trophy size={large ? 120 : 56} />
          </div>
        )}
        <p className={`font-display font-semibold uppercase tracking-[0.3em] ${large ? "text-2xl" : "text-xs"}`} style={{ color: GOLD }}>
          {kicker}
        </p>
        <h2
          className={`mt-1 break-words font-display font-black leading-tight ${large ? "text-7xl" : "text-3xl"}`}
          style={final && winners.length > 0 ? { color: "#fff", textShadow: `0.05em 0.05em 0 ${GOLD}` } : undefined}
        >
          {heading}
        </h2>

        <ol className={`mx-auto text-left ${large ? "mt-10 max-w-3xl space-y-3" : "mt-4 max-w-md space-y-2"}`}>
          {rows.map((r) => {
            const lead = r.rank === 1 && r.points > 0;
            return (
              <li
                key={r.id}
                className={`relative overflow-hidden rounded-xl bg-white/10 ${lead ? "ring-2" : ""} ${large ? "px-5 py-3" : "px-3 py-2"}`}
                style={lead ? { boxShadow: `0 0 0 2px ${GOLD}` } : undefined}
              >
                <span
                  className="absolute inset-y-0 left-0 bg-white/10"
                  style={{ width: `${Math.round((r.points / top) * 100)}%` }}
                  aria-hidden="true"
                />
                <div className="relative flex items-center gap-3">
                  <span
                    className={`num flex shrink-0 items-center justify-center rounded-full font-display font-bold text-rccg-purple-800 ${large ? "h-12 w-12 text-2xl" : "h-7 w-7 text-sm"}`}
                    style={{ background: MEDAL[r.rank - 1] ?? "rgba(255,255,255,0.7)" }}
                  >
                    {r.rank}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate font-display font-semibold ${large ? "text-3xl" : "text-lg"}`}>{r.name}</span>
                    {r.members && <span className={`block truncate text-white/60 ${large ? "text-lg" : "text-xs"}`}>{r.members}</span>}
                  </span>
                  <span className={`num font-display font-black ${large ? "text-5xl" : "text-2xl"}`} style={{ color: lead ? GOLD : "#fff" }}>
                    {r.points}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/** A finished (or in-progress) game as a result card. */
export function GameResult({ session, ...rest }: { session: GameSession } & Omit<Props, "rows" | "final">) {
  const rows = rankSides(session).map((r) => ({
    id: r.side.id,
    name: r.side.name,
    points: r.points,
    rank: r.rank,
    members: r.side.members.length > 1 ? r.side.members.map((m) => m.name).join(", ") : undefined,
  }));
  return <ResultCard rows={rows} final={session.status === "finished"} {...rest} />;
}

/** A games event's overall result: one card for each group of games played by the same sides. */
export function EventResult({ summary, final, large, confetti = true }: { summary: EventSummary; final: boolean; large?: boolean; confetti?: boolean }) {
  if (summary.lineups.length === 0) {
    return <p className={`text-center text-muted ${large ? "text-3xl" : "text-sm"}`}>No games have been played yet.</p>;
  }
  return (
    <div className="space-y-4">
      {summary.lineups.map((l, i) => (
        <ResultCard
          key={l.key}
          rows={l.rows.map((r) => ({ id: r.id, name: r.name, points: r.total, rank: r.rank, members: r.members }))}
          final={final}
          label={summary.lineups.length > 1 ? l.label : undefined}
          large={large}
          confetti={confetti && i === 0}
        />
      ))}
    </div>
  );
}
