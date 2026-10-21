"use client";

import { TimerBadge } from "@/components/GameBoard";
import Confetti from "@/components/Confetti";
import PresentFrame from "@/components/PresentFrame";
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
export default function TeaserScreen({ run, exitHref }: { run: TeaserRun; exitHref?: string }) {
  const timer = useRoundTimer(run);
  const flash = useFlash(run);
  const ended = teaserEnded(run, timer);
  const named = run.slots.filter((s) => s.answer).length;
  const all = named === run.slotCount;

  return (
    <PresentFrame
      title={run.prompt}
      subtitle={`Teaser · ${run.title}`}
      exitHref={exitHref}
      right={timer.enabled ? <TimerBadge timer={timer} large inline /> : undefined}
    >
      {ended && all && <Confetti />}
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex items-center justify-between text-xl text-muted">
          <p>
            <span className="num font-display text-4xl font-bold text-rccg-purple-700">{named}</span> of{" "}
            <span className="num font-semibold">{run.slotCount}</span> named
          </p>
          {flash?.kind === "dup" && (
            <p role="status" className="animate-pop rounded-full bg-amber-100 px-5 py-1.5 font-display text-2xl font-semibold text-amber-900">
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
    </PresentFrame>
  );
}
