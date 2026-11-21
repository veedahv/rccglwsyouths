"use client";

import { useCallback, useEffect, useState } from "react";
import PresentFrame from "@/components/PresentFrame";
import WarmupTrackerView from "@/components/WarmupTracker";
import type { WarmupStep } from "@/lib/warmups";

/**
 * Leader mode: one warm-up move at a time in big letters, for reading from a phone or showing on a
 * screen. Arrow keys, space, or the buttons move through the moves; the last card is the water break.
 * Used for the whole routine and for a fitness session in a games event (a chosen set of moves).
 */
export default function WarmupLeader({
  title,
  context,
  steps,
  exitHref,
}: {
  title: string;
  /** Shown before the move's section in the header, e.g. the games event's name. */
  context?: string;
  steps: WarmupStep[];
  exitHref: string;
}) {
  const [index, setIndex] = useState(0);
  const total = steps.length;
  const done = index >= total; // the card after the last move
  const step = done ? null : steps[index];

  const next = useCallback(() => setIndex((i) => Math.min(total, i + 1)), [total]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Keep the screen awake while leading, so a timer isn't cut off by the phone dimming. (Not every browser can.)
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    async function hold() {
      try {
        if (!cancelled && document.visibilityState === "visible") lock = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        // Refused (low battery, or not supported). The screen may dim; nothing else is lost.
      }
    }
    void hold();
    document.addEventListener("visibilitychange", hold);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", hold);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const subtitle = [context, step ? `${step.section.title} · move ${index + 1} of ${total}` : total > 0 ? "All done" : undefined]
    .filter(Boolean)
    .join(" · ");

  return (
    <PresentFrame title={title} subtitle={subtitle || undefined} exitHref={exitHref}>
      {total === 0 ? (
        <div className="flex flex-1 items-center justify-center text-center text-xl text-ink/80 sm:text-3xl">
          There are no moves picked for this session yet.
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-between gap-6">
          <div className="flex flex-1 items-center justify-center">
            {step ? (
              <div key={step.id} className="w-full max-w-4xl text-center">
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-bold uppercase tracking-[0.14em] text-rccg-purple-700 shadow sm:text-base">
                  <span aria-hidden="true">{step.section.emoji}</span>
                  {step.section.title}
                  {step.section.minutes ? ` · ${step.section.minutes}` : ""}
                </span>
                <h2 className="mt-6 font-title text-4xl leading-tight text-rccg-purple-800 sm:text-6xl">{step.name}</h2>
                <p className="mx-auto mt-6 inline-block rounded-2xl bg-rccg-green-500 px-6 py-3 text-2xl font-bold text-white shadow-lg sm:text-4xl">
                  {step.dose}
                </p>
                <p className="mx-auto mt-6 max-w-3xl text-xl leading-snug text-ink/80 sm:text-3xl">{step.how}</p>
                {step.tracker && (
                  <div className="mt-8">
                    <WarmupTrackerView tracker={step.tracker} />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <p className="text-7xl" aria-hidden="true">
                  💧
                </p>
                <h2 className="mt-4 font-title text-5xl text-rccg-purple-800 sm:text-7xl">Water break!</h2>
                <p className="mt-4 text-xl text-ink/80 sm:text-3xl">Great work, everyone. Drink some water, then it&apos;s game time.</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            <button type="button" onClick={prev} disabled={index === 0} className="btn-secondary px-6 py-3 text-lg disabled:opacity-40">
              ‹ Back
            </button>
            <div className="flex flex-wrap items-center justify-center gap-1.5" aria-hidden="true">
              {Array.from({ length: total + 1 }, (_, i) => (
                <span
                  key={i}
                  className="h-2.5 rounded-full transition-all"
                  style={{ width: i === index ? 26 : 10, background: i === index ? "#028A2C" : i < index ? "#92CDA4" : "#CBC4E7" }}
                />
              ))}
            </div>
            <button type="button" onClick={next} disabled={done} className="btn-primary px-6 py-3 text-lg disabled:opacity-40">
              Next ›
            </button>
          </div>
        </div>
      )}
    </PresentFrame>
  );
}
