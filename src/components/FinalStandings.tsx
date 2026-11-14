"use client";

import { useMemo, useState } from "react";
import { buildStandingsText, playedIds, teamRosters } from "@/lib/standingsText";
import StandingsImage from "@/components/StandingsImage";
import { Card } from "@/components/ui";
import type { EventSummary, GameEvent, GamePlayer, GameSession } from "@/types/games";
import type { Youth } from "@/types";

/**
 * The final standings as a message for the group chat. People who arrived partway through
 * and were only marked present are listed here so they can be put on the team they played with.
 */
export default function FinalStandings({
  event,
  sessions,
  summary,
  youths,
  canEdit,
  onSaveLate,
}: {
  event: GameEvent;
  sessions: GameSession[];
  summary: EventSummary;
  youths: Youth[];
  canEdit: boolean;
  onSaveLate: (late: Record<string, string>) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showImage, setShowImage] = useState(false);
  // Team names as they should appear on this picture and message only. Nothing is saved: the games keep their real names.
  const [rename, setRename] = useState<Record<string, string>>({});
  const late = event.lateTeams ?? {};
  const hostIds = new Set((event.hosts ?? []).map((h) => h.id));

  // Present, not hosting, and not on a side in any game.
  const people: GamePlayer[] = useMemo(() => {
    const onSide = playedIds(sessions);
    const fromYouths = (event.presentIds ?? [])
      .map((id) => youths.find((y) => y.id === id))
      .filter((y): y is Youth => !!y)
      .map((y) => ({ id: y.id, name: y.name }));
    return [...fromYouths, ...(event.guests ?? [])].filter((p) => !hostIds.has(p.id) && !onSide.has(p.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, youths, event.presentIds, event.guests, event.hosts]);

  const rosters = useMemo(() => teamRosters(summary, sessions, late, people), [summary, sessions, late, people]);
  const teamNames = [...new Set(rosters.map((t) => t.row.name))];
  // The same standings under the display names, for the picture and the message.
  const shown = useMemo(() => {
    const nm = (n: string) => rename[n]?.trim() || n;
    const view = {
      ...summary,
      lineups: summary.lineups.map((l) => ({
        ...l,
        label: l.label
          .split(" vs ")
          .map(nm)
          .join(" vs "),
        winners: l.winners.map(nm),
        rows: l.rows.map((r) => ({ ...r, name: nm(r.name) })),
      })),
    };
    const rs = rosters.map((t) => {
      const lineup = view.lineups.find((l) => l.key === t.lineup.key)!;
      return { ...t, lineup, row: lineup.rows.find((r) => r.id === t.row.id)! };
    });
    return { summary: view, rosters: rs };
  }, [summary, rosters, rename]);
  const text = useMemo(() => buildStandingsText(event, shown.summary, shown.rosters), [event, shown]);

  function assign(personId: string, team: string) {
    const next = { ...late };
    if (team) next[personId] = team;
    else delete next[personId];
    onSaveLate(next);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The text is selectable in the box below.
    }
  }

  if (!summary.lineups.length) return null;

  return (
    <Card title="Final standings message" description="Ready to post in the group chat: the overall winner, each game's points, every team's points and players, and the host.">
      {people.length > 0 && teamNames.length > 0 && (
        <div className="mb-5 rounded-xl border border-line bg-mist/60 p-4">
          <p className="text-sm font-medium">Came partway through? Pick the team they played with.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {people.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-sm">{p.name}</span>
                <select
                  className="input w-40 shrink-0"
                  value={late[p.id] ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => assign(p.id, e.target.value)}
                  aria-label={`Team for ${p.name}`}
                >
                  <option value="">Didn&apos;t play</option>
                  {teamNames.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="mb-4 rounded-xl border border-line p-4">
        <summary className="cursor-pointer text-sm font-medium">Show different team names on the picture and message</summary>
        <p className="mt-2 text-sm text-muted">Only changes what is shown here. The games keep their real team names, so the real standings stay as they are.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {teamNames.map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm">
              <span className="w-24 shrink-0 truncate text-muted">{t}</span>
              <input
                className="input flex-1"
                placeholder={t}
                value={rename[t] ?? ""}
                onChange={(e) => setRename((r) => ({ ...r, [t]: e.target.value }))}
              />
            </label>
          ))}
        </div>
      </details>

      <textarea readOnly value={text} rows={Math.min(30, text.split("\n").length + 1)} className="input w-full font-mono text-sm" onFocus={(e) => e.currentTarget.select()} />
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => setShowImage(true)} className="btn-primary">
          View as picture
        </button>
        <button onClick={copy} className="btn-secondary">
          {copied ? "Copied" : "Copy message"}
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="btn-secondary">
          Open in WhatsApp
        </a>
      </div>
      {showImage && <StandingsImage onClose={() => setShowImage(false)} event={event} summary={shown.summary} rosters={shown.rosters} />}
    </Card>
  );
}
