import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { listEvents as listChurchEvents } from "./events";
import { listProgrammes } from "./programmes";
import { listContributionsWithStats } from "./contributions";
import { contributionStartDate } from "./contributionStatus";
import { listEvents as listGamesEvents, summarizeEvent } from "./gameEvents";
import { listSessions } from "./games";
import { listExternalGames } from "./externalGames";
import { generateYearlyReport } from "./reports";
import { listYouths } from "./youths";
import { todayISO } from "./format";
import { MEMORY_PHOTOS, type MemoryPhoto } from "./yearReviewPhotos";
import { GAME_LABEL, hasStarted } from "@/types/games";

/* ------------------------------------------------------------------ */
/* What the exco types in: /yearReviews/{year}                         */
/* ------------------------------------------------------------------ */

/** Something worth celebrating that isn't an event in the app (or never got added). */
export interface ReviewHighlight {
  id: string;
  title: string;
  date?: string; // ISO date, optional; undated ones come last
  note?: string; // the event's summary: a few sentences about how it went
  hadGames?: boolean; // there were games at it (shown on its card, and on the games slide)
  games?: string; // which games, separated by commas, e.g. "Race, egg race, football"
  outdoorGames?: boolean; // the games were played outdoors
  order?: string[]; // the order of events: what happened, step by step
}

/** "Race, egg race; football" becomes ["Race", "egg race", "football"]. */
export function splitList(text: string | undefined, max = 8): string[] {
  return (text ?? "")
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max);
}

/** The longest order of events a hand-added event can have (it has to fit on one slide). */
export const MAX_ORDER_STEPS = 8;

export interface YearReviewExtras {
  tagline?: string; // shown under the title on the first slide
  highlights: ReviewHighlight[];
}

export async function getYearReviewExtras(year: number): Promise<YearReviewExtras> {
  const snap = await getDoc(doc(db, "yearReviews", String(year)));
  const data = snap.exists() ? (snap.data() as Partial<YearReviewExtras>) : {};
  return { tagline: data.tagline ?? "", highlights: data.highlights ?? [] };
}

export async function saveYearReviewExtras(year: number, extras: YearReviewExtras, uid: string): Promise<void> {
  const highlights = extras.highlights
    .map((h) => ({
      id: h.id,
      title: h.title.trim(),
      ...(h.date ? { date: h.date } : {}),
      ...(h.note?.trim() ? { note: h.note.trim() } : {}),
      ...(h.hadGames ? { hadGames: true } : {}),
      ...(h.hadGames && h.games?.trim() ? { games: h.games.trim() } : {}),
      ...(h.hadGames && h.outdoorGames ? { outdoorGames: true } : {}),
      ...(h.order && h.order.some((s) => s.trim())
        ? { order: h.order.map((s) => s.trim()).filter(Boolean).slice(0, MAX_ORDER_STEPS) }
        : {}),
    }))
    .filter((h) => h.title);
  await setDoc(doc(db, "yearReviews", String(year)), {
    year,
    ...(extras.tagline?.trim() ? { tagline: extras.tagline.trim() } : {}),
    highlights,
    updatedBy: uid,
    updatedAt: new Date().toISOString(),
  });
}

/* ------------------------------------------------------------------ */
/* What the slideshow shows                                            */
/* ------------------------------------------------------------------ */

export interface ReviewEvent {
  key: string;
  title: string;
  date?: string;
  venue?: string;
  theme?: string;
  summary?: string; // the start of the after-event report (or the typed-in summary), tidied up
  hadGames?: boolean;
  outdoorGames?: boolean; // the games were outdoors
  order?: string[]; // the order of events, step by step (shown on its card)
  isToday?: boolean; // happening today, so it is in the review even though it isn't over yet
  time?: string; // "HH:mm", kept for today's event
}

export interface ReviewGameDay {
  title: string;
  date: string;
  champion?: string; // e.g. "Boys vs Girls: Girls"
  gamesPlayed: number;
  note?: string; // for a game day typed in by hand: a line about it
  outdoor?: boolean; // for a game day typed in by hand: the games were outdoors
}

export interface ReviewGames {
  // False when there are no recorded games at all and this is only the game days typed in by hand.
  recorded: boolean;
  gameDays: number;
  gamesPlayed: number;
  outdoorGames: number;
  mostPlayed?: { label: string; count: number };
  teamWins: { name: string; wins: number }[];
  recent: ReviewGameDay[];
}

export interface ReviewDrive {
  title: string;
  pledged: number;
  redeemed: number;
  percent: number | null;
}

export interface ReviewContributions {
  drives: number;
  totalPledged: number;
  totalRedeemed: number;
  itemsPledged: number;
  itemsRedeemed: number;
  top: ReviewDrive[];
}

export interface ReviewFinance {
  openingBalance: number;
  dues: number;
  otherIncome: number;
  income: number;
  spending: number;
  closingBalance: number;
}

export interface ReviewPlan {
  key: string;
  title: string;
  month?: number;
  timeNote?: string;
  budget?: number;
}

export interface ReviewPlans {
  year: number;
  approved: boolean; // false means these are ideas that haven't been approved yet
  items: ReviewPlan[];
  totalBudget: number;
}

export interface YearReviewData {
  year: number;
  tagline?: string;
  youths: number | null;
  events: ReviewEvent[];
  games: ReviewGames | null;
  contributions: ReviewContributions | null;
  finance: ReviewFinance | null;
  plans: ReviewPlans | null;
  // Pictures for the two memories slides (see lib/yearReviewPhotos.ts). Empty means placeholders show.
  memoryPhotos?: MemoryPhoto[];
}

/** The first couple of sentences of a report, with any markdown dressing stripped. */
export function snippet(text: string | undefined, max = 190): string | undefined {
  if (!text) return undefined;
  const plain = text
    .replace(/[#*_>`~]/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return undefined;
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 40)).replace(/[,;:.\-–]+$/, "")}…`;
}

async function section<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (err) {
    console.warn("Year in review: a section couldn't be loaded", err);
    return null;
  }
}

async function loadGames(year: number, churchEvents: Awaited<ReturnType<typeof listChurchEvents>>): Promise<ReviewGames | null> {
  const prefix = `${year}-`;
  const [gameEvents, sessions] = await Promise.all([listGamesEvents(), listSessions()]);

  const dateOf = (e: (typeof gameEvents)[number]) =>
    (e.churchEventId ? churchEvents.find((c) => c.id === e.churchEventId)?.date : undefined) ?? e.createdAt.slice(0, 10);
  const finished = gameEvents.filter((e) => e.status === "finished" && dateOf(e).startsWith(prefix));
  const played = sessions.filter((s) => hasStarted(s) && s.status === "finished" && s.createdAt.startsWith(prefix));

  let outdoor = 0;
  const wins = new Map<string, number>();
  const recent: ReviewGameDay[] = [];

  for (const event of finished) {
    const eventSessions = sessions.filter((s) => s.eventId === event.id);
    const summary = summarizeEvent(eventSessions);
    outdoor += (await listExternalGames(event.id)).filter((g) => g.status === "finished").length;

    let champion: string | undefined;
    for (const l of summary.lineups) {
      // Boys vs Girls and named teams are celebrated; one-youth-per-side games just count.
      if (!(l.key === "gender" || l.key.startsWith("teams:")) || l.winners.length === 0) continue;
      for (const name of l.winners) wins.set(name, (wins.get(name) ?? 0) + 1);
      champion ??= `${l.label}: ${l.winners.join(" & ")}`;
    }
    recent.push({
      title: event.title,
      date: dateOf(event),
      ...(champion ? { champion } : {}),
      gamesPlayed: eventSessions.filter(hasStarted).length,
    });
  }

  if (finished.length === 0 && played.length === 0) return null;

  const counts = new Map<string, number>();
  for (const s of played) counts.set(GAME_LABEL[s.game], (counts.get(GAME_LABEL[s.game]) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];

  return {
    recorded: true,
    gameDays: finished.length,
    gamesPlayed: played.length,
    outdoorGames: outdoor,
    ...(top ? { mostPlayed: { label: top[0], count: top[1] } } : {}),
    teamWins: [...wins.entries()]
      .map(([name, w]) => ({ name, wins: w }))
      .sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name))
      .slice(0, 6),
    recent: recent.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4),
  };
}

async function loadContributions(year: number): Promise<ReviewContributions | null> {
  const prefix = `${year}-`;
  const all = await listContributionsWithStats();
  const inYear = all.filter((c) => contributionStartDate(c).startsWith(prefix) || c.endDate?.startsWith(prefix));
  if (inYear.length === 0) return null;

  const drives: ReviewDrive[] = inYear
    .map((c) => ({
      title: c.title,
      pledged: c.stats.totalPledged,
      redeemed: c.stats.youthReceived,
      percent: c.stats.totalPledged > 0 ? Math.round((c.stats.youthReceived / c.stats.totalPledged) * 100) : null,
    }))
    .sort((a, b) => b.redeemed - a.redeemed);

  return {
    drives: inYear.length,
    totalPledged: inYear.reduce((s, c) => s + c.stats.totalPledged, 0),
    totalRedeemed: inYear.reduce((s, c) => s + c.stats.youthReceived, 0),
    itemsPledged: inYear.reduce((s, c) => s + c.stats.itemsPledged, 0),
    itemsRedeemed: inYear.reduce((s, c) => s + (c.stats.itemsReceived - c.stats.itemsReceivedFromExternal), 0),
    top: drives.slice(0, 4),
  };
}

async function loadFinance(year: number): Promise<ReviewFinance | null> {
  const r = await generateYearlyReport(year);
  if (r.openingBalance === 0 && r.totalIncoming === 0 && r.totalOutgoing === 0) return null;
  return {
    openingBalance: r.openingBalance,
    dues: r.totalDues,
    otherIncome: r.totalIncoming - r.totalDues,
    income: r.totalIncoming,
    spending: r.totalOutgoing,
    closingBalance: r.closingBalance,
  };
}

async function loadPlans(year: number): Promise<ReviewPlans | null> {
  const programmes = await listProgrammes(year);
  const approved = programmes.filter((p) => p.status === "approved");
  const chosen = approved.length > 0 ? approved : programmes.filter((p) => p.status === "suggested");
  if (chosen.length === 0) return null;
  return {
    year,
    approved: approved.length > 0,
    items: chosen.map((p) => ({
      key: p.id,
      title: p.title,
      ...(p.month ? { month: p.month } : {}),
      ...(p.timeNote ? { timeNote: p.timeNote } : {}),
      ...(p.estimatedBudget ? { budget: p.estimatedBudget } : {}),
    })),
    totalBudget: chosen.reduce((s, p) => s + (p.estimatedBudget ?? 0), 0),
  };
}

/**
 * Gathers everything the year-in-review slideshow shows. Each part is loaded on its own, so
 * one that fails (or has nothing in it) is simply left out instead of breaking the whole show.
 */
export async function buildYearReview(year: number): Promise<YearReviewData> {
  const today = todayISO();
  const [extras, churchEvents] = await Promise.all([
    section(() => getYearReviewExtras(year)),
    section(() => listChurchEvents()),
  ]);

  // Completed events: this year's, and already past.
  const events: ReviewEvent[] = (churchEvents ?? [])
    .filter((e) => e.date.startsWith(`${year}-`) && e.date <= today)
    .map((e) => ({
      key: e.id,
      title: e.title,
      date: e.date,
      ...(e.venue?.trim() ? { venue: e.venue.trim() } : {}),
      ...(e.theme?.trim() ? { theme: e.theme.trim() } : {}),
      ...(snippet(e.afterEventReport) ? { summary: snippet(e.afterEventReport) } : {}),
      ...(e.gamesEventId ? { hadGames: true } : {}),
      // An event on the day the slideshow is shown (the love feast, say) belongs in the year too.
      ...(e.date === today ? { isToday: true, ...(e.time ? { time: e.time } : {}) } : {}),
    }));

  // Plus whatever was typed in by hand (events that were never added to the app, wins, milestones).
  for (const h of extras?.highlights ?? []) {
    events.push({
      key: `extra-${h.id}`,
      title: h.title,
      ...(h.date ? { date: h.date } : {}),
      ...(snippet(h.note) ? { summary: snippet(h.note) } : {}),
      ...(h.hadGames ? { hadGames: true } : {}),
      ...(h.hadGames && h.outdoorGames ? { outdoorGames: true } : {}),
      ...(h.order && h.order.filter((s) => s.trim()).length > 0
        ? { order: h.order.map((s) => s.trim()).filter(Boolean).slice(0, MAX_ORDER_STEPS) }
        : {}),
    });
  }
  events.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));

  const [games, contributions, finance, plans, youths] = await Promise.all([
    section(() => loadGames(year, churchEvents ?? [])),
    section(() => loadContributions(year)),
    section(() => loadFinance(year)),
    section(() => loadPlans(year + 1)),
    section(async () => (await listYouths()).filter((y) => y.active).length),
  ]);

  // Game days typed in by hand join the games slide, so a games day that was never recorded still shows.
  const manualGameDays: ReviewGameDay[] = (extras?.highlights ?? [])
    .filter((h) => h.hadGames && h.title.trim())
    .map((h) => {
      const list = splitList(h.games);
      return {
        title: h.title.trim(),
        date: h.date ?? "",
        gamesPlayed: 0,
        note: list.length > 0 ? list.join(", ") : snippet(h.note, 90) ?? "Games were played",
        ...(h.outdoorGames ? { outdoor: true } : {}),
      };
    });
  const byDateDesc = (a: ReviewGameDay, b: ReviewGameDay) => b.date.localeCompare(a.date);
  // A hand-added game day counts as a game day, and as one outdoor game if it was played outdoors.
  const manualOutdoor = manualGameDays.filter((m) => m.outdoor).length;
  const allGames: ReviewGames | null =
    manualGameDays.length === 0
      ? games
      : games
      ? {
          ...games,
          gameDays: games.gameDays + manualGameDays.length,
          outdoorGames: games.outdoorGames + manualOutdoor,
          recent: [...games.recent, ...manualGameDays].sort(byDateDesc).slice(0, 4),
        }
      : {
          recorded: false,
          gameDays: manualGameDays.length,
          gamesPlayed: 0,
          outdoorGames: manualOutdoor,
          teamWins: [],
          recent: manualGameDays.sort(byDateDesc).slice(0, 5),
        };

  return {
    year,
    ...(extras?.tagline?.trim() ? { tagline: extras.tagline.trim() } : {}),
    youths,
    events,
    games: allGames,
    contributions,
    finance,
    plans,
    memoryPhotos: MEMORY_PHOTOS[year] ?? [],
  };
}
