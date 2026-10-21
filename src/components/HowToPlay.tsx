"use client";

import { howToPlay } from "@/lib/gameRules";
import type { GameSession } from "@/types/games";

/**
 * The rules of a game, for the players to read before it starts. It is shown
 * on the big screen and on the run screen, but never on the OBS overlay.
 */
export default function HowToPlay({ session, large }: { session: GameSession; large?: boolean }) {
  const { summary, steps } = howToPlay(session);
  return (
    <section className={`mx-auto w-full rounded-2xl border border-line bg-white text-left shadow-sm ${large ? "max-w-5xl px-10 py-8" : "max-w-2xl px-5 py-4"}`}>
      <p className={`font-semibold uppercase tracking-wide text-rccg-green-700 ${large ? "text-lg" : "text-xs"}`}>How to play</p>
      <p className={`mt-1 font-display font-bold text-rccg-purple-800 ${large ? "text-4xl" : "text-lg"}`}>{summary}</p>
      <ol className={`mt-4 space-y-2 ${large ? "text-2xl" : "text-sm"}`}>
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className={`num shrink-0 rounded-full bg-rccg-purple-700 text-center font-display font-bold text-white ${large ? "h-9 w-9 text-xl leading-9" : "h-6 w-6 text-xs leading-6"}`}>
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
