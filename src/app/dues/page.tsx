"use client";

import { useEffect, useState } from "react";
import { getDuesGridForYear } from "@/lib/dues";
import { listYouths } from "@/lib/youths";
import { useAuth } from "@/lib/useAuth";
import { formatPersonName } from "@/lib/formatName";
import { naira } from "@/lib/format";
import RequireAuth from "@/components/RequireAuth";
import DuesForm from "@/components/DuesForm";
import { Page, PageHeader, Card, Loading, EmptyState } from "@/components/ui";
import type { Youth } from "@/types";

const MONTHS = [
  ["01", "Jan"], ["02", "Feb"], ["03", "Mar"], ["04", "Apr"],
  ["05", "May"], ["06", "Jun"], ["07", "Jul"], ["08", "Aug"],
  ["09", "Sep"], ["10", "Oct"], ["11", "Nov"], ["12", "Dec"],
] as const;

function currentYear() {
  return new Date().getFullYear();
}

function DuesInner() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("canEditFinance");

  const [year, setYear] = useState(currentYear());
  const [youths, setYouths] = useState<Youth[]>([]);
  const [grid, setGrid] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function refresh() {
    setLoading(true);
    const [youthData, gridData] = await Promise.all([
      listYouths({ activeOnly: true }),
      getDuesGridForYear(year),
    ]);
    setYouths(youthData);
    setGrid(gridData);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  // The whole active roster is shown (not just people who've paid) —
  // seeing who hasn't paid yet is useful information.
  const rows = youths
    .map((y) => {
      const monthly = grid[y.id] ?? {};
      const total = Object.values(monthly).reduce((sum, v) => sum + v, 0);
      return { youth: y, monthly, total };
    })
    .sort((a, b) => a.youth.name.localeCompare(b.youth.name));

  const monthlyTotals = MONTHS.map(([key]) =>
    rows.reduce((sum, r) => sum + (r.monthly[key] ?? 0), 0)
  );
  const grandTotal = monthlyTotals.reduce((sum, v) => sum + v, 0);

  return (
    <Page>
      <PageHeader
        title="Monthly dues"
        description="Who has paid what, month by month. Everyone on the active roster is listed."
        actions={
          canEdit && (
            <button onClick={() => setShowForm((s) => !s)} className={showForm ? "btn-secondary" : "btn-primary"}>
              {showForm ? "Cancel" : "Add payment"}
            </button>
          )
        }
      />

      {showForm && (
        <Card title="Record a dues payment" className="mb-6">
          <DuesForm youths={youths} onSaved={refresh} />
        </Card>
      )}

      <div className="mb-4 flex items-center gap-2">
        <label htmlFor="dues-year" className="text-sm font-medium">
          Year
        </label>
        <select
          id="dues-year"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="input w-auto"
        >
          {Array.from({ length: 5 }, (_, i) => currentYear() - i).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState title="No active youths on the roster yet" description="Add youths from the Youths page." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="tbl">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-mist">Name</th>
                {MONTHS.map(([key, label]) => (
                  <th key={key} className="text-right">
                    {label}
                  </th>
                ))}
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ youth, monthly, total }) => (
                <tr key={youth.id}>
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white font-medium">
                    {formatPersonName(youth.name, youth.gender)}
                  </td>
                  {MONTHS.map(([key]) => (
                    <td key={key} className="num text-right text-muted">
                      {monthly[key] ? <span className="text-ink">{naira(monthly[key])}</span> : "—"}
                    </td>
                  ))}
                  <td className="num text-right font-semibold">{naira(total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="sticky left-0 z-10 bg-mist">Monthly total</td>
                {monthlyTotals.map((amount, i) => (
                  <td key={i} className="num text-right">
                    {amount ? naira(amount) : "—"}
                  </td>
                ))}
                <td className="num text-right text-rccg-green-700">{naira(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Page>
  );
}

export default function DuesPage() {
  return (
    <RequireAuth>
      <DuesInner />
    </RequireAuth>
  );
}
