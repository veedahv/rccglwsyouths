import { hasStarted } from "@/types/games";
import type { EventSummary, GameEvent, GamePlayer, GameSession, Lineup, LineupRow } from "@/types/games";

/** One team in a lineup with everyone who played for it. */
export interface TeamRoster {
  lineup: Lineup;
  row: LineupRow;
  members: string[];
}

/** Every player who is on a side in any game that has started. */
export function playedIds(sessions: GameSession[]): Set<string> {
  const ids = new Set<string>();
  for (const s of sessions.filter(hasStarted)) for (const side of s.sides) for (const m of side.members) ids.add(m.id);
  return ids;
}

/**
 * The teams of each lineup that has teams (Boys vs Girls, Team A vs Team B ...) with the
 * names of everyone who played for them in any of its games, plus anyone added afterwards
 * through `lateTeams`. Lineups of single players have no teams to list.
 */
export function teamRosters(
  summary: EventSummary,
  sessions: GameSession[],
  late: Record<string, string>,
  people: GamePlayer[]
): TeamRoster[] {
  const out: TeamRoster[] = [];
  for (const lineup of summary.lineups) {
    const inLineup = sessions.filter((s) => lineup.games.some((g) => g.id === s.id) && (s.mode === "teams" || s.mode === "gender"));
    if (!inLineup.length) continue;
    for (const row of lineup.rows) {
      const names = new Set<string>();
      for (const s of inLineup) for (const side of s.sides) if (side.name === row.name) side.members.forEach((m) => names.add(m.name));
      for (const p of people) if (late[p.id] === row.name) names.add(p.name);
      out.push({ lineup, row, members: [...names].sort((a, b) => a.localeCompare(b)) });
    }
  }
  return out;
}

const MEDAL = ["🥇", "🥈", "🥉"];

function joinNames(names: string[]): string {
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

const pts = (n: number) => `${n} ${n === 1 ? "pt" : "pts"}`;

/** The final standings as a message for the group chat (WhatsApp bold with *stars*). */
export function buildStandingsText(
  event: Pick<GameEvent, "title" | "subtitle" | "venue" | "hosts">,
  summary: EventSummary,
  rosters: TeamRoster[]
): string {
  const lines: string[] = [];
  lines.push(`🏆 *${event.title} · Final standings*`);
  const when = [event.subtitle, event.venue].filter(Boolean).join(" · ");
  if (when) lines.push(when);

  const many = summary.lineups.length > 1;

  // Overall winner
  lines.push("");
  for (const l of summary.lineups) {
    const top = l.rows.filter((r) => r.rank === 1);
    const label = many ? ` (${l.label})` : "";
    if (!l.winners.length) lines.push(`👑 *Overall winner${label}:* nobody scored yet`);
    else lines.push(`👑 *Overall winner${label}:* ${joinNames(l.winners)} with ${pts(top[0].total)}${l.winners.length > 1 ? " (tied)" : ""}`);
  }

  // Games
  lines.push("", "🎮 *Games*");
  let n = 1;
  for (const l of summary.lineups) {
    if (many) lines.push(`_${l.label}_`);
    for (const g of l.games) {
      const scores = l.rows.map((r) => `${r.name} ${r.perGame[g.id] ?? 0}`).join(" · ");
      lines.push(`${n++}. ${g.title}: ${scores}`);
    }
  }

  // Teams
  for (const l of summary.lineups) {
    lines.push("", `📊 *${many ? l.label : "Team points"}*`);
    for (const r of l.rows) {
      const medal = MEDAL[r.rank - 1] ?? "▫️";
      lines.push(`${medal} *${r.name}* — ${pts(r.total)}`);
      const members = rosters.find((t) => t.row === r)?.members ?? [];
      if (members.length) lines.push(members.join(", "));
    }
  }

  const hosts = (event.hosts ?? []).map((h) => h.name);
  if (hosts.length) lines.push("", `🎤 *Host${hosts.length > 1 ? "s" : ""}:* ${joinNames(hosts)}`);
  lines.push("", "Thanks for coming! 🙌");
  return lines.join("\n");
}
