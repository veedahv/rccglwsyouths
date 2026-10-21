"use client";

import type { GameSession } from "@/types/games";

interface Props {
  session: GameSession;
  large?: boolean;
  /** The run screen uses this to flip a card when the host taps it. */
  onFlip?: (index: number) => void;
}

/**
 * The cards of Bible Couples. A card is face down (its number), face up (a name) or part of a
 * matched couple (a name and who it goes with). The overlay only receives the names of cards
 * that are face up, so a face-down card can't be read from the link.
 */
export default function CoupleGrid({ session, large, onFlip }: Props) {
  const cards = session.cards ?? [];
  const flipped = session.flipped ?? [];
  const cols = cards.length <= 12 ? "grid-cols-3 sm:grid-cols-4" : cards.length <= 16 ? "grid-cols-4" : "grid-cols-4 sm:grid-cols-5";
  // Two cards face up that are not a couple: the host shows them, then turns them back.
  const missed = flipped.length === 2 && session.cards?.[flipped[0]]?.r !== session.cards?.[flipped[1]]?.r;

  return (
    <ul className={`grid gap-3 ${cols}`}>
      {cards.map((card, i) => {
        const round = session.rounds[card.r];
        const matched = !!round?.played;
        const up = matched || flipped.includes(i);
        const name = card.s === 0 ? round?.prompt : round?.answer;
        const partner = card.s === 0 ? round?.answer : round?.prompt;
        const base = [
          "flex w-full flex-col items-center justify-center rounded-2xl border-2 px-2 text-center transition-colors",
          large ? "min-h-[7.5rem] py-4" : "min-h-[5rem] py-3",
        ].join(" ");

        const content = up ? (
          <>
            <span className={`font-display font-bold ${large ? "text-3xl" : "text-lg"} ${matched ? "text-rccg-green-700" : "text-rccg-purple-800"}`}>{name}</span>
            {matched && partner && <span className={`text-muted ${large ? "text-lg" : "text-xs"}`}>with {partner}</span>}
          </>
        ) : (
          <span className={`num font-display font-bold text-white/90 ${large ? "text-5xl" : "text-2xl"}`}>{i + 1}</span>
        );
        const tone = matched
          ? "border-rccg-green-500 bg-rccg-green-50"
          : up
            ? missed
              ? "border-amber-400 bg-amber-50"
              : "border-rccg-purple-400 bg-white"
            : "border-rccg-purple-800 bg-rccg-purple-700";

        // Only a face-down card can be flipped, and only while fewer than two are up.
        const flippable = !!onFlip && !up && flipped.length < 2;
        return (
          <li key={i}>
            {onFlip ? (
              <button
                type="button"
                disabled={!flippable}
                onClick={() => onFlip(i)}
                aria-label={up ? `Card ${i + 1}: ${name}` : `Flip card ${i + 1}`}
                className={`${base} ${tone} ${flippable ? "hover:border-rccg-green-500" : ""}`}
              >
                {content}
              </button>
            ) : (
              <div className={`${base} ${tone}`}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
