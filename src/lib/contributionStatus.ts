import type { Contribution, Pledge } from "@/types";
import { daysBetween, formatDate, todayISO } from "./format";

/**
 * A contribution's status is INFORMATIONAL only. "Ended" means the drive
 * is officially closed (the item was bought, the event happened) — it
 * never blocks recording a late pledge or a late payment.
 */
export type ContributionStatus = "upcoming" | "ongoing" | "ended";

type Dated = Pick<Contribution, "createdAt" | "startDate" | "endDate">;

export const CONTRIBUTION_STATUS_LABEL: Record<ContributionStatus, string> = {
  upcoming: "Upcoming",
  ongoing: "Ongoing",
  ended: "Ended",
};

/** Contributions created before start dates existed fall back to their creation date. */
export function contributionStartDate(c: Dated): string {
  return c.startDate ?? c.createdAt.slice(0, 10);
}

export function getContributionStatus(c: Dated, today: string = todayISO()): ContributionStatus {
  if (contributionStartDate(c) > today) return "upcoming";
  // The end date itself is still part of the drive; it's "ended" the day after.
  if (c.endDate && c.endDate < today) return "ended";
  return "ongoing";
}

/** "5 Oct 2026 – 20 Oct 2026", or "From 5 Oct 2026" when there's no end date yet. */
export function contributionPeriod(c: Dated): string {
  const start = formatDate(contributionStartDate(c));
  return c.endDate ? `${start} – ${formatDate(c.endDate)}` : `From ${start}`;
}

/** "12 days left", "Ended 3 days ago", "Starts in 4 days"… */
export function contributionTiming(c: Dated, today: string = todayISO()): string {
  const status = getContributionStatus(c, today);

  if (status === "upcoming") {
    const days = daysBetween(today, contributionStartDate(c));
    return days === 1 ? "Starts tomorrow" : `Starts in ${days} days`;
  }
  if (!c.endDate) return "No end date set";

  const left = daysBetween(today, c.endDate);
  if (status === "ongoing") {
    if (left === 0) return "Ends today";
    return left === 1 ? "1 day left" : `${left} days left`;
  }
  const ago = Math.abs(left);
  return ago === 1 ? "Ended yesterday" : `Ended ${ago} days ago`;
}

export type PledgeStatus = "redeemed" | "partial" | "unpaid" | "unpledged" | "none";

export const PLEDGE_STATUS_LABEL: Record<PledgeStatus, string> = {
  redeemed: "Redeemed",
  partial: "Part-paid",
  unpaid: "Not yet paid",
  unpledged: "Gave without pledge",
  none: "No pledge",
};

export function getPledgeStatus(p: Pick<Pledge, "pledgedAmount" | "redeemedAmount">): PledgeStatus {
  if (p.pledgedAmount > 0) {
    if (p.redeemedAmount >= p.pledgedAmount) return "redeemed";
    return p.redeemedAmount > 0 ? "partial" : "unpaid";
  }
  return p.redeemedAmount > 0 ? "unpledged" : "none";
}
