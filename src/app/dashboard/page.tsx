"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDashboardData, DashboardData } from "@/lib/dashboard";
import { contributionPeriod, contributionTiming } from "@/lib/contributionStatus";
import { formatDate, formatQuantity, naira, pluralize } from "@/lib/format";
import RequireAuth from "@/components/RequireAuth";
import { Page, PageHeader, Card, Stat, Loading, EmptyState } from "@/components/ui";
import {
  ContributionBar,
  ContributionLegend,
  ContributionStatusBadge,
  hasItems,
  ItemsLine,
} from "@/components/ContributionProgress";

function MoneyCard({
  label,
  thisYear,
  lastYear,
  tone,
  rewardGrowth,
}: {
  label: string;
  thisYear: number;
  lastYear: number;
  tone: "green" | "red";
  rewardGrowth: boolean; // true for money in (up is good); false for money out (neutral colour)
}) {
  const diff = thisYear - lastYear;
  const pct = lastYear ? Math.round((diff / lastYear) * 100) : null;
  const trendColor = !rewardGrowth ? "text-muted" : diff >= 0 ? "text-rccg-green-700" : "text-rccg-red-600";
  return (
    <div className="card">
      <Stat
        label={`${label} this year`}
        value={naira(thisYear)}
        tone={tone}
        hint={
          <>
            Last year {naira(lastYear)}
            {pct !== null && (
              <span className={`ml-2 font-medium ${trendColor}`}>
                {diff >= 0 ? "▲" : "▼"} {Math.abs(pct)}%
              </span>
            )}
          </>
        }
      />
    </div>
  );
}

function DashboardInner() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardData().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  if (loading || !data)
    return (
      <Page>
        <Loading label="Loading dashboard…" />
      </Page>
    );

  const featured = data.featuredContribution;

  return (
    <Page>
      <PageHeader
        title="Dashboard"
        description={new Date().toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      />

      <div className="space-y-6">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MoneyCard
            label="Money in"
            thisYear={data.thisYear.totalIn}
            lastYear={data.lastYear.totalIn}
            tone="green"
            rewardGrowth
          />
          <MoneyCard
            label="Money out"
            thisYear={data.thisYear.totalOut}
            lastYear={data.lastYear.totalOut}
            tone="red"
            rewardGrowth={false}
          />
          <div className="card">
            <Stat label="Events this year" value={data.eventsThisYearCount} hint="Handled so far" tone="purple" />
          </div>
        </section>

        <Card
          title={
            featured && data.ongoingContributionCount === 0
              ? "Latest contribution"
              : "Ongoing contribution"
          }
          description={
            data.ongoingContributionCount > 1
              ? `Showing the newest of ${data.ongoingContributionCount} ongoing contributions`
              : undefined
          }
          action={
            <Link href="/contributions" className="btn-ghost">
              View all
            </Link>
          }
        >
          {featured ? (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link
                    href={`/contributions/${featured.id}`}
                    className="font-display text-xl font-semibold text-rccg-purple-800 hover:underline"
                  >
                    {featured.title}
                  </Link>
                  <p className="mt-0.5 text-sm text-muted">
                    {contributionPeriod(featured)}. {contributionTiming(featured)}.
                  </p>
                </div>
                <ContributionStatusBadge contribution={featured} />
              </div>

              <div
                className={`mt-5 grid grid-cols-2 gap-x-6 gap-y-4 ${hasItems(featured.stats) ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}
              >
                <Stat label="Received" value={naira(featured.stats.totalReceived)} tone="green" />
                <Stat label="Pledged" value={naira(featured.stats.totalPledged)} />
                <Stat
                  label="Outstanding pledges"
                  value={naira(featured.stats.outstanding)}
                  tone={featured.stats.outstanding > 0 ? "red" : "default"}
                  hint={
                    featured.stats.pledgerCount > 0
                      ? `${featured.stats.fullyRedeemedCount} of ${pluralize(featured.stats.pledgerCount, "pledge")} fulfilled`
                      : undefined
                  }
                />
                {hasItems(featured.stats) && (
                  <Stat
                    label="Items received"
                    value={formatQuantity(featured.stats.itemsReceived)}
                    tone="green"
                    hint={
                      featured.stats.itemsPledged > 0
                        ? `of ${pluralize(featured.stats.itemsPledged, "pledged item")}`
                        : undefined
                    }
                  />
                )}
              </div>

              <div className="mt-5">
                <ContributionBar stats={featured.stats} className="h-3" />
                <ContributionLegend stats={featured.stats} />
                <ItemsLine stats={featured.stats} className="mt-3" />
              </div>
            </div>
          ) : (
            <EmptyState title="No contributions yet" description="Start one from the Contributions page." />
          )}
        </Card>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Events">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted">Next upcoming</p>
                {data.nextUpcomingEvent ? (
                  <>
                    <Link href={`/events/${data.nextUpcomingEvent.id}`} className="link text-base">
                      {data.nextUpcomingEvent.title}
                    </Link>
                    <p className="text-sm text-muted">{formatDate(data.nextUpcomingEvent.date)}</p>
                  </>
                ) : (
                  <p className="text-sm text-ink">Nothing scheduled.</p>
                )}
              </div>
              <div className="border-t border-line pt-4">
                <p className="text-sm text-muted">Last concluded</p>
                {data.lastConcludedEvent ? (
                  <>
                    <Link href={`/events/${data.lastConcludedEvent.id}`} className="link text-base">
                      {data.lastConcludedEvent.title}
                    </Link>
                    <p className="text-sm text-muted">{formatDate(data.lastConcludedEvent.date)}</p>
                  </>
                ) : (
                  <p className="text-sm text-ink">None yet.</p>
                )}
              </div>
            </div>
          </Card>

          <Card
            title="Recent minutes"
            action={
              <Link href="/meetings" className="btn-ghost">
                View all
              </Link>
            }
          >
            {data.recentMinutes.length === 0 ? (
              <p className="text-sm text-muted">No minutes recorded yet.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {data.recentMinutes.map((m) => (
                  <li key={m.id} className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <Link href={`/meetings/${m.id}`} className="link">
                      {m.title}
                    </Link>
                    <span className="shrink-0 text-muted">{formatDate(m.date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </Page>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardInner />
    </RequireAuth>
  );
}
