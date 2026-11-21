"use client";

import { useState } from "react";
import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";
import GamesTabs from "@/components/GamesTabs";
import { Page, PageHeader, Card, Badge } from "@/components/ui";
import type { Tone } from "@/components/ui";
import { formatClock } from "@/components/WarmupTracker";
import {
  LIBRARY_EXERCISE_COUNT,
  LIBRARY_SECTIONS,
  WARMUP_INTRO,
  WARMUP_SECTIONS,
  WARMUP_TIPS,
  WARMUP_TITLE,
  WARMUP_TOTAL,
  moveMatches,
  type Difficulty,
  type WarmupMove,
  type WarmupTracker,
} from "@/lib/warmups";

/** What leader mode adds under a move, in a few words. */
function trackerLabel(t: WarmupTracker): string {
  if (t.kind === "timer") return t.goalSeconds ? `⏱ Timer, goal ${formatClock(t.goalSeconds)}` : "⏱ Timer";
  if (t.kind === "countdown") {
    const n = t.holds?.length ?? 1;
    return n > 1 ? `⏳ ${n} countdowns of ${t.seconds} seconds` : `⏳ ${t.seconds} second countdown`;
  }
  return "🔢 Counter";
}

const DIFFICULTY_TONE: Record<Difficulty, Tone> = { Beginner: "green", Intermediate: "amber", Advanced: "red" };

function MoveRow({ move, number }: { move: WarmupMove; number?: number }) {
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      {number !== undefined && (
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rccg-purple-100 text-sm font-bold text-rccg-purple-700"
          aria-hidden="true"
        >
          {number}
        </span>
      )}
      <div className="min-w-0">
        <p className="font-semibold text-ink">{move.name}</p>
        <p className="text-sm font-medium text-rccg-green-700">{move.dose}</p>
        <p className="mt-0.5 text-sm text-muted">{move.how}</p>
        {(move.tracker || move.difficulty) && (
          <p className="mt-1 flex flex-wrap gap-1.5">
            {move.difficulty && <Badge tone={DIFFICULTY_TONE[move.difficulty]}>{move.difficulty}</Badge>}
            {move.tracker && <Badge tone="gray">{trackerLabel(move.tracker)}</Badge>}
          </p>
        )}
      </div>
    </li>
  );
}

function Library() {
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
  const filtering = query.trim() !== "" || difficulty !== "all";

  const shown = LIBRARY_SECTIONS.map((section) => ({
    section,
    moves: section.moves.filter((m) => moveMatches(m, section, query, difficulty)),
  })).filter((x) => x.moves.length > 0);
  const total = shown.reduce((n, x) => n + x.moves.length, 0);

  return (
    <Card
      title="Exercise library"
      description={`${LIBRARY_EXERCISE_COUNT} more exercises in ${LIBRARY_SECTIONS.length} categories. Pick from them, along with the routine above, when you build a fitness session in a games event.`}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises, e.g. shoulder, lunge, neck"
          aria-label="Search the exercise library"
          className="input min-w-[12rem] flex-1"
        />
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty | "all")}
          aria-label="Difficulty"
          className="input !w-auto"
        >
          <option value="all">Any difficulty</option>
          <option value="Beginner">Beginner</option>
          <option value="Intermediate">Intermediate</option>
          <option value="Advanced">Advanced</option>
        </select>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted">No exercises match. Try a different word or difficulty.</p>
      ) : (
        <div className="space-y-2">
          {filtering && <p className="text-xs text-muted">{total === 1 ? "1 exercise" : `${total} exercises`} found</p>}
          {shown.map(({ section, moves }) => (
            <details key={section.id} open={filtering ? true : undefined} className="group rounded-xl border border-line bg-white/70">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold text-ink">
                <span className="flex items-center gap-2">
                  <span aria-hidden="true">{section.emoji}</span>
                  {section.title}
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone="purple">{moves.length === 1 ? "1 exercise" : `${moves.length} exercises`}</Badge>
                  <span className="text-muted transition group-open:rotate-180" aria-hidden="true">
                    ⌄
                  </span>
                </span>
              </summary>
              <ul className="divide-y divide-line border-t border-line px-4 py-3">
                {moves.map((move) => (
                  <MoveRow key={move.id} move={move} />
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </Card>
  );
}

function WarmupsInner() {
  let count = 0; // numbers the routine's moves 1, 2, 3… straight through the sections

  return (
    <Page size="md">
      <PageHeader
        title={WARMUP_TITLE}
        description={WARMUP_INTRO}
        actions={
          <Link href="/games/warm-ups/lead" className="btn-primary">
            Leader mode
          </Link>
        }
      />

      <GamesTabs />

      <p className="mb-4 text-sm text-muted">
        The routine below takes about <strong className="text-ink">{WARMUP_TOTAL}</strong>. <strong className="text-ink">Leader mode</strong>{" "}
        shows one move at a time in big letters, with a timer, a countdown or a counter where the move needs one. Further down is a
        library of more exercises to mix in.
      </p>

      <div className="space-y-4">
        {WARMUP_SECTIONS.map((section) => (
          <Card
            key={section.id}
            title={
              <span className="flex items-center gap-2">
                <span aria-hidden="true">{section.emoji}</span>
                {section.title}
              </span>
            }
            action={<Badge tone="purple">{section.minutes}</Badge>}
          >
            <ol className="divide-y divide-line">
              {section.moves.map((move) => {
                count += 1;
                return <MoveRow key={move.id} move={move} number={count} />;
              })}
            </ol>
          </Card>
        ))}

        <Card title="Tips for the leader">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink">
            {WARMUP_TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </Card>

        <Library />
      </div>
    </Page>
  );
}

export default function WarmupsPage() {
  return (
    <RequireAuth>
      <WarmupsInner />
    </RequireAuth>
  );
}
