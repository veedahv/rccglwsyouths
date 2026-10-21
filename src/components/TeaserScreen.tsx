"use client";

import Link from "next/link";
import { TimerBadge } from "@/components/GameBoard";
import { TeaserSlots, useFlash } from "@/components/TeaserParts";
import { useRoundTimer } from "@/lib/useRoundTimer";
import type { TeaserRun } from "@/types/teasers";

/** Is the game over? Finished by the host, filled up, or out of time. */
export function teaserEnded(run: TeaserRun, timer: { enabled: boolean; state: string; remaining: number }): boolean {
  return run.status === "finished" || (timer.enabled && timer.state !== "idle" && timer.remaining <= 0);
}

/**
 * The big screen for a teaser: the prompt, one timer for the whole game and the
 * numbered slots. Unnamed answers stay hidden until the game is over.
 */
export default function TeaserScreen({ run, exitHref }: { run: TeaserRun; exitHref: string }) {
  const timer = useRoundTimer(run);
  const flash = useFlash(run);
  const ended = teaserEnded(run, timer);
  const named = run.slots.filter((s) => s.answer).length;
  const all = named === run.slotCount;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-mist">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-6 px-6 py-6 sm:px-10">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-rccg-green-700">Teaser · {run.title}</p>
            <h1 className="mt-1 font-display text-4xl font-black leading-tight text-rccg-purple-800 sm:text-6xl">{run.prompt}</h1>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {timer.enabled && <TimerBadge timer={timer} large inline />}
            <Link href={exitHref} className="btn-ghost !text-muted">
              Exit
            </Link>
          </div>
        </header>

        <div className="flex items-center justify-between text-xl text-muted">
          <p>
            <span className="num font-display text-3xl font-bold text-rccg-purple-700">{named}</span> of{" "}
            <span className="num font-semibold">{run.slotCount}</span> named
          </p>
          {flash?.kind === "dup" && (
            <p role="status" className="rounded-full bg-amber-100 px-5 py-1.5 font-display text-2xl font-semibold text-amber-900">
              Already named: {flash.text}
            </p>
          )}
          {run.status === "ready" && !ended && <p className="font-display text-2xl font-semibold text-rccg-purple-600">Get ready…</p>}
          {ended && (
            <p className={`font-display text-3xl font-bold ${all ? "text-rccg-green-700" : "text-rccg-red-600"}`}>
              {all ? "All found! Well done!" : "Time's up!"}
            </p>
          )}
        </div>

        <div className="flex-1">
          <TeaserSlots run={run} ended={ended} large flash={flash} />
        </div>
      </div>
    </div>
  );
}
