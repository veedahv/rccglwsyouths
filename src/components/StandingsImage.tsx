"use client";

import { useEffect } from "react";
import FullscreenButton from "@/components/FullscreenButton";
import type { EventSummary, GameEvent } from "@/types/games";
import type { TeamRoster } from "@/lib/standingsText";

const NAVY = "#180C62";
const GOLD = "#E8B04A";
const MEDAL = ["🥇", "🥈", "🥉"];

/**
 * The final standings as a picture, sized for a phone chat. It is only shown on screen so it can be
 * screenshotted or snipped: there is nothing to download.
 */
export function StandingsCard({
  event,
  summary,
  rosters,
}: {
  event: Pick<GameEvent, "title" | "subtitle" | "venue" | "hosts">;
  summary: EventSummary;
  rosters: TeamRoster[];
}) {
  const many = summary.lineups.length > 1;
  const hosts = (event.hosts ?? []).map((h) => h.name);
  const when = [event.subtitle, event.venue].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto w-[min(100%,38rem)] overflow-hidden rounded-xs bg-white shadow-2xl" style={{ color: NAVY }}>
      <div className="flex h-2" aria-hidden="true">
        <span className="flex-1" style={{ background: "#2E9E5B" }} />
        <span className="flex-1" style={{ background: GOLD }} />
        <span className="flex-1" style={{ background: "#D23B3B" }} />
      </div>

      <div className="px-6 pb-7 pt-6 text-center text-white" style={{ background: `linear-gradient(160deg, ${NAVY}, #2B1B8A)` }}>
        {/* <p className="text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: GOLD }}>
          Final standings
        </p> */}
        <h2 className="mt-1 font-display text-3xl font-black leading-tight">{event.title}</h2>
        {when && <p className="mt-1 text-sm text-white/70">{when}</p>}

        {summary.lineups.map((l) => {
          const top = l.rows.find((r) => r.rank === 1);
          return (
            <div key={l.key} className="mt-5 rounded-2xl bg-white/10 px-4 py-4">
              {many && <p className="text-xs uppercase tracking-widest text-white/60">{l.label}</p>}
              <p className="text-4xl leading-none">👑</p>
              {l.winners.length ? (
                <>
                  <p className="mt-2 font-display text-3xl font-black" style={{ color: GOLD }}>
                    {l.winners.join(" & ")}
                  </p>
                  <p className="text-sm text-white/80">
                    {l.winners.length > 1 ? "tied at the top" : "overall winner"} · {top?.total} {top?.total === 1 ? "pt" : "pts"}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-white/80">Nobody has scored yet</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-6 px-5 py-6">
        {summary.lineups.map((l) => (
          <section key={l.key}>
            {many && <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest opacity-60">{l.label}</p>}
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(l.rows.length, 2)}, minmax(0, 1fr))` }}>
              {l.rows.map((r) => {
                const members = rosters.find((t) => t.row === r)?.members ?? [];
                const first = r.rank === 1 && r.total > 0;
                return (
                  <div key={r.id} className="rounded-2xl border p-4" style={{ borderColor: first ? GOLD : "#E4E1F0", background: first ? "#FFF9EC" : "#FAF9FD" }}>
                    <p className="text-lg">{MEDAL[r.rank - 1] ?? "▫️"}</p>
                    <p className="font-display text-xl font-extrabold leading-tight">{r.name}</p>
                    <p className="font-display text-4xl font-black leading-none" style={{ color: first ? "#B77E10" : NAVY }}>
                      {r.total}
                      <span className="ml-1 text-sm font-semibold opacity-60">pts</span>
                    </p>
                    {members.length > 0 && (
                      <ul className="mt-3 opacity-80 flex flex-wrap gap-1">
                        {members.map((m) => (
                          <li key={m} className="text-nowrap rounded-xl bg-[#2B1B8A] text-white text-xs capitalize px-2">{m.toLowerCase()}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border" style={{ borderColor: "#E4E1F0" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "#F1EFF9" }}>
                    <th className="px-3 py-2 text-left font-semibold">Game</th>
                    {l.rows.map((r) => (
                      <th key={r.id} className="px-2 py-2 text-right font-semibold">
                        {r.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {l.games.map((g) => (
                    <tr key={g.id} className="border-t" style={{ borderColor: "#EEEAF7" }}>
                      <td className="px-3 py-2">{g.title}</td>
                      {l.rows.map((r) => (
                        <td key={r.id} className="num px-2 py-2 text-right font-semibold">
                          {r.perGame[g.id] ?? 0}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        {hosts.length > 0 && (
          <p className="text-center text-sm">
            🎤 Hosted by <span className="font-semibold">{hosts.join(" & ")}</span>
          </p>
        )}
      </div>
    </div>
  );
}

/** The picture on a dark backdrop, full window, ready for a screenshot. Esc or the button closes it. */
export default function StandingsImage({
  onClose,
  ...card
}: {
  onClose: () => void;
  event: Pick<GameEvent, "title" | "subtitle" | "venue" | "hosts">;
  summary: EventSummary;
  rosters: TeamRoster[];
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0E0740]/95 px-4 py-6">
      <div className="mx-auto mb-4 flex max-w-xl items-center justify-between text-white/70">
        <p className="text-sm">Screenshot or snip this picture.</p>
        <div className="flex items-center gap-2">
          <FullscreenButton />
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-white/80 hover:bg-white/10">
            Close
          </button>
        </div>
      </div>
      <StandingsCard {...card} />
    </div>
  );
}
