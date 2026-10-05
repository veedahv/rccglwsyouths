import { listEvents } from "./events";
import { listMeetings } from "./meetings";
import { listContributions, loadStatsFor, ContributionWithStats } from "./contributions";
import { getContributionStatus } from "./contributionStatus";
import { generateYearlyReport } from "./reports";
import { todayISO } from "./format";
import type { ChurchEvent, Meeting } from "@/types";

export interface YearMoneyFlow {
  totalIn: number;
  totalOut: number;
}

/**
 * "Money in" / "money out" for a year, sourced from the same
 * generateYearlyReport() the financial report page uses — so the
 * dashboard and the report can never show two different numbers for the
 * same year. This deliberately excludes contributions (pledges,
 * redemptions, external support): those are tracked and reported on
 * their own `/contributions` pages, not folded into the financial
 * report's incoming/outgoing totals.
 */
export async function getYearMoneyFlow(year: number): Promise<YearMoneyFlow> {
  const report = await generateYearlyReport(year);
  return { totalIn: report.totalIncoming, totalOut: report.totalOutgoing };
}

export interface DashboardData {
  thisYear: YearMoneyFlow;
  lastYear: YearMoneyFlow;
  eventsThisYearCount: number;
  nextUpcomingEvent: ChurchEvent | null;
  lastConcludedEvent: ChurchEvent | null;
  recentMinutes: Meeting[];
  /** The latest ongoing drive; if none are ongoing, the most recent one (shown as ended/upcoming). */
  featuredContribution: ContributionWithStats | null;
  /** How many drives are currently ongoing. */
  ongoingContributionCount: number;
}

export async function getDashboardData(): Promise<DashboardData> {
  const now = new Date();
  const today = todayISO();
  const currentYear = now.getFullYear();

  const [thisYear, lastYear, events, meetings, contributions] = await Promise.all([
    getYearMoneyFlow(currentYear),
    getYearMoneyFlow(currentYear - 1),
    listEvents(),
    listMeetings(),
    listContributions(),
  ]);

  const eventsThisYearCount = events.filter((e) => e.date.startsWith(String(currentYear))).length;

  const upcoming = events.filter((e) => e.date >= today).sort((a, b) => (a.date > b.date ? 1 : -1));
  const concluded = events.filter((e) => e.date < today).sort((a, b) => (a.date < b.date ? 1 : -1));

  const recentMinutes = meetings.filter((m) => m.minutesContent?.trim()).slice(0, 5);

  // `contributions` is newest-created first, so find() gives the latest
  // ongoing drive. Falling back to the newest of any status means the
  // card still has something useful to show between drives.
  const ongoing = contributions.filter((c) => getContributionStatus(c, today) === "ongoing");
  const featured = ongoing[0] ?? contributions[0] ?? null;
  const featuredContribution = featured ? await loadStatsFor(featured) : null;

  return {
    thisYear,
    lastYear,
    eventsThisYearCount,
    nextUpcomingEvent: upcoming[0] ?? null,
    lastConcludedEvent: concluded[0] ?? null,
    recentMinutes,
    featuredContribution,
    ongoingContributionCount: ongoing.length,
  };
}
