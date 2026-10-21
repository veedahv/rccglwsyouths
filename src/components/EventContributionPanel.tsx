import Link from "next/link";
import { Card } from "@/components/ui";
import { ContributionBar, ContributionLegend, ContributionStatusBadge, ItemsLine } from "@/components/ContributionProgress";
import { contributionPeriod, contributionTiming } from "@/lib/contributionStatus";
import { naira } from "@/lib/format";
import type { ContributionStats } from "@/lib/contributions";
import type { Contribution } from "@/types";

/** What the event's contribution drive has brought in (money and items), or a way to start one. */
export default function EventContributionPanel({
  contribution,
  stats,
  canStart,
  onStart,
}: {
  contribution: Contribution | null;
  stats: ContributionStats | null;
  canStart: boolean;
  onStart: () => void;
}) {
  if (!contribution || !stats) {
    return (
      <Card title="Contributions" description="Money and items people pledge and give toward this event.">
        <p className="mb-3 text-sm text-muted">No contribution started for this event yet.</p>
        {canStart && (
          <button type="button" onClick={onStart} className="btn-secondary btn-sm">
            Start a contribution
          </button>
        )}
      </Card>
    );
  }

  return (
    <Card
      title="Contributions"
      description="Money and items that have come in through the contribution drive."
      action={
        <Link href={`/contributions/${contribution.id}`} className="btn-secondary btn-sm">
          Open
        </Link>
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-medium text-ink">{contribution.title}</p>
        <ContributionStatusBadge contribution={contribution} />
      </div>
      <p className="mt-0.5 text-sm text-muted">
        {contributionPeriod(contribution)}. {contributionTiming(contribution)}.
      </p>
      <div className="mt-4">
        <ContributionBar stats={stats} />
        <p className="mt-2 text-sm">
          <span className="num font-semibold text-rccg-green-700">{naira(stats.totalReceived)}</span>{" "}
          <span className="text-muted">received of {naira(stats.totalPledged)} pledged</span>
        </p>
        <ContributionLegend stats={stats} />
        <ItemsLine stats={stats} maxLines={8} className="mt-3" />
      </div>
    </Card>
  );
}
