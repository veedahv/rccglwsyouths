"use client";

import { turnSide } from "@/lib/games";
import type { GameSession } from "@/types/games";

/*
 * Views made for the OBS overlay. The overlay is mostly recorded in portrait,
 * where a grid of tiles is too small to read, so the games that are played on
 * tiles tell what is happening instead: which card was picked, whether it was
 * a match, and who is up. The big screen (/present) keeps the full tiles.
 */

/** Bible Couples on video: the cards picked, the result, and the couples found so far. */
export function CoupleOverlay({ session, large }: { session: GameSession; large?: boolean }) {
  const cards = session.cards ?? [];
  const flipped = session.flipped ?? [];
  const side = turnSide(session);
  const found = session.rounds.filter((r) => r.played);

  const picks = flipped.map((i) => {
    const card = cards[i];
    const round = card ? session.rounds[card.r] : undefined;
    return { number: i + 1, name: card ? (card.s === 0 ? round?.prompt : round?.answer) ?? "" : "", round: card?.r };
  });
  const result: "match" | "miss" | null = picks.length === 2 ? (picks[0].round === picks[1].round ? "match" : "miss") : null;
  const matchedRound = result === "match" ? session.rounds[picks[0].round ?? -1] : undefined;
  const winner = matchedRound ? session.sides.find((s) => (matchedRound.awards[s.id] ?? 0) > 0) : undefined;

  const text = {
    chip: large ? "text-3xl px-5 py-2" : "text-lg px-4 py-1",
    label: large ? "text-xl" : "text-xs",
    number: large ? "text-6xl" : "text-4xl",
    name: large ? "text-5xl" : "text-2xl",
    banner: large ? "text-5xl py-5" : "text-2xl py-3",
    found: large ? "text-2xl" : "text-sm",
  };

  return (
    <div className="space-y-4 text-center">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {side && <span className={`rounded-full bg-rccg-purple-700 font-display font-semibold text-white ${text.chip}`}>▶ {side.name}</span>}
        <span className={`num font-display font-semibold text-muted ${large ? "text-3xl" : "text-base"}`}>
          {found.length} of {session.rounds.length} couples found
        </span>
      </div>

      {/* The two cards being turned over. */}
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((slot) => {
          const pick = picks[slot];
          return pick ? (
            <div
              key={`${slot}-${pick.number}`}
              className={`animate-pop rounded-2xl border-2 px-2 py-4 ${
                result === "match" ? "border-rccg-green-500 bg-rccg-green-50" : result === "miss" ? "border-rccg-red-600 bg-rccg-red-50" : "border-rccg-purple-400 bg-white"
              }`}
            >
              <p className={`font-semibold uppercase tracking-wide text-muted ${text.label}`}>Card</p>
              <p className={`num font-display font-black text-rccg-purple-700 ${text.number}`}>{pick.number}</p>
              <p className={`break-words font-display font-bold text-rccg-purple-800 ${text.name}`}>{pick.name}</p>
            </div>
          ) : (
            <div key={`${slot}-empty`} className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line px-2 py-4 text-muted">
              <p className={`font-semibold uppercase tracking-wide ${text.label}`}>Card</p>
              <p className={`font-display font-black ${text.number}`}>?</p>
              <p className={text.label}>{slot === 0 && picks.length === 0 ? "pick a card" : "pick another"}</p>
            </div>
          );
        })}
      </div>

      {result === "match" && (
        <div key={`match-${flipped.join("-")}`} className={`animate-pop rounded-2xl bg-rccg-green-600 px-3 font-display font-black text-white ${text.banner}`}>
          <p>✓ It&rsquo;s a match!</p>
          <p className={`font-bold ${large ? "text-4xl" : "text-xl"}`}>
            {picks[0].name} &amp; {picks[1].name}
          </p>
          {winner && <p className={`mt-1 font-semibold text-white/90 ${large ? "text-3xl" : "text-base"}`}>+1 for {winner.name}</p>}
        </div>
      )}
      {result === "miss" && (
        <div key={`miss-${flipped.join("-")}`} className={`animate-shake rounded-2xl bg-rccg-red-600 px-3 font-display font-black text-white ${text.banner}`}>
          ✗ No match
        </div>
      )}

      {found.length > 0 && (
        <div>
          <p className={`mb-1 font-semibold uppercase tracking-wide text-muted ${text.label}`}>Couples found</p>
          <ul className="flex flex-wrap justify-center gap-1.5">
            {found.map((r) => (
              <li key={r.questionId} className={`rounded-full bg-rccg-green-50 px-3 py-0.5 font-medium text-rccg-green-700 ${text.found}`}>
                {r.prompt} &amp; {r.answer}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** The quiz board on video, between tiles: whose pick it is and what is left, as a short list instead of a grid. */
export function BoardOverlay({ session, large }: { session: GameSession; large?: boolean }) {
  const categories = session.boardCategories ?? [];
  const side = turnSide(session);
  const left = session.rounds.filter((r) => !r.played).length;

  return (
    <div className="space-y-3 text-center">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {side && (
          <span className={`rounded-full bg-rccg-purple-700 font-display font-semibold text-white ${large ? "px-5 py-2 text-3xl" : "px-4 py-1 text-lg"}`}>
            ▶ {side.name} picks
          </span>
        )}
        <span className={`num font-display font-semibold text-muted ${large ? "text-3xl" : "text-base"}`}>
          {left} tile{left === 1 ? "" : "s"} left
        </span>
      </div>
      <ul className="space-y-1.5 text-left">
        {categories.map((category) => {
          const tiles = session.rounds.filter((r) => r.category === category);
          return (
            <li key={category} className="flex items-center gap-3 rounded-xl bg-mist px-3 py-2">
              <span className={`min-w-0 flex-1 truncate font-display font-semibold text-rccg-purple-800 ${large ? "text-3xl" : "text-base"}`}>{category}</span>
              <span className="flex shrink-0 gap-1.5">
                {tiles.map((t) => (
                  <span
                    key={t.questionId}
                    className={`num rounded-lg px-2.5 py-0.5 text-center font-display font-bold ${large ? "min-w-[4.5rem] text-3xl" : "min-w-[2.75rem] text-base"} ${
                      t.played ? "bg-white text-muted/60 line-through" : "bg-rccg-purple-700 text-white"
                    }`}
                  >
                    {t.value}
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
