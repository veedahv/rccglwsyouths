import { Badge, Tone } from "./ui";
import { naira } from "@/lib/format";
import type { ContributionStats } from "@/lib/contributions";
import {
  CONTRIBUTION_STATUS_LABEL,
  ContributionStatus,
  getContributionStatus,
} from "@/lib/contributionStatus";
import type { Contribution } from "@/types";

const STATUS_TONE: Record<ContributionStatus, Tone> = {
  ongoing: "green",
  upcoming: "purple",
  ended: "gray",
};

export function ContributionStatusBadge({
  contribution,
}: {
  contribution: Pick<Contribution, "createdAt" | "startDate" | "endDate">;
}) {
  const status = getContributionStatus(contribution);
  return (
    <Badge tone={STATUS_TONE[status]} dot>
      {CONTRIBUTION_STATUS_LABEL[status]}
    </Badge>
  );
}

/**
 * One bar, three colours:
 *   green  = paid in by youths      purple = external support
 *   pale   = pledged but still to come
 * The bar's full width is whichever is larger — pledged or received — so
 * it never overflows when more has come in than was pledged; in that case
 * a white tick marks where the pledged total sits.
 */
export function ContributionBar({
  stats,
  className = "h-2.5",
}: {
  stats: ContributionStats;
  className?: string;
}) {
  const { totalPledged, totalReceived, youthReceived, externalReceived } = stats;
  const scale = Math.max(totalPledged, totalReceived);
  const pct = (n: number) => (scale > 0 ? Math.min(100, (n / scale) * 100) : 0);
  const pledgedTick = totalPledged > 0 && totalReceived > totalPledged ? pct(totalPledged) : null;

  return (
    <div
      role="img"
      aria-label={`${naira(totalReceived)} received of ${naira(totalPledged)} pledged`}
      className={`relative flex w-full overflow-hidden rounded-full bg-rccg-purple-100 ${className}`}
    >
      <div className="bg-rccg-green-500" style={{ width: `${pct(youthReceived)}%` }} />
      <div className="bg-rccg-purple-600" style={{ width: `${pct(externalReceived)}%` }} />
      {pledgedTick !== null && (
        <div className="absolute inset-y-0 w-0.5 bg-white" style={{ left: `${pledgedTick}%` }} />
      )}
    </div>
  );
}

export function ContributionLegend({ stats }: { stats: ContributionStats }) {
  const items = [
    { color: "bg-rccg-green-500", label: "Youth payments", value: stats.youthReceived },
    { color: "bg-rccg-purple-600", label: "External support", value: stats.externalReceived },
    { color: "bg-rccg-purple-100 ring-1 ring-inset ring-rccg-purple-200", label: "Still to come in", value: stats.outstanding },
  ];
  return (
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-muted">
          <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} aria-hidden="true" />
          {item.label} <span className="num font-semibold text-ink">{naira(item.value)}</span>
        </li>
      ))}
    </ul>
  );
}
