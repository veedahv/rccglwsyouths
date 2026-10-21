import type { ReactNode } from "react";
import { Stat } from "@/components/ui";
import { naira } from "@/lib/format";
import type { EventMoney } from "@/lib/eventBudget";

/** ₦1,000, or -₦1,000 when below zero (naira() alone would print ₦-1,000). */
export function signedNaira(n: number): string {
  return n < 0 ? `-${naira(Math.abs(n))}` : naira(n);
}

function Tile({ accent, children }: { accent: string; children: ReactNode }) {
  return <div className={`rounded-xl border border-line border-t-4 bg-white p-4 ${accent}`}>{children}</div>;
}

/**
 * The numbers that answer "where are we?": what the event is expected to
 * cost, what has come in, what has gone out, what is left in hand, and how
 * many of the needed items are covered.
 */
export default function BudgetSummary({
  money,
  hasContribution,
  itemsCovered,
  itemsTotal,
}: {
  money: EventMoney;
  hasContribution: boolean;
  itemsCovered: number;
  itemsTotal: number;
}) {
  const { budget, contributed, pledged, spent, balance, donated } = money;
  const over = budget > 0 && spent > budget;
  const itemsPct = itemsTotal > 0 ? (itemsCovered / itemsTotal) * 100 : 0;

  return (
    <section aria-label="Money and items summary" className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Tile accent="border-t-rccg-purple-600">
          <Stat
            label="Budget"
            value={naira(budget)}
            tone="purple"
            hint={budget === 0 ? "No budget items yet" : donated > 0 ? `${naira(donated)} of it donated` : undefined}
          />
        </Tile>
        <Tile accent="border-t-rccg-green-500">
          <Stat
            label="Contributed"
            value={naira(contributed)}
            tone="green"
            hint={hasContribution ? `of ${naira(pledged)} pledged` : "No contribution started"}
          />
        </Tile>
        <Tile accent={over ? "border-t-rccg-red-600" : "border-t-rccg-purple-300"}>
          <Stat
            label="Spent"
            value={naira(spent)}
            tone={over ? "red" : "default"}
            hint={budget > 0 ? `${Math.round((spent / budget) * 100)}% of the budget` : undefined}
          />
        </Tile>
        <Tile accent={balance < 0 ? "border-t-rccg-red-600" : "border-t-rccg-green-500"}>
          <Stat
            label="Balance"
            value={signedNaira(balance)}
            tone={balance < 0 ? "red" : "green"}
            hint={balance < 0 ? "Spent beyond what was contributed" : "Contributed minus spent"}
          />
        </Tile>
        <Tile accent="border-t-rccg-purple-600">
          <p className="text-sm text-muted">Items covered</p>
          <p className="num mt-0.5 font-display text-2xl font-bold text-rccg-purple-700">
            {itemsTotal > 0 ? `${itemsCovered} of ${itemsTotal}` : "—"}
          </p>
          {itemsTotal > 0 ? (
            <div
              role="img"
              aria-label={`${itemsCovered} of ${itemsTotal} items covered`}
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-rccg-purple-100"
            >
              <div className="h-full bg-rccg-green-500" style={{ width: `${itemsPct}%` }} />
            </div>
          ) : (
            <p className="mt-0.5 text-xs text-muted">No items listed</p>
          )}
        </Tile>
      </div>
    </section>
  );
}
