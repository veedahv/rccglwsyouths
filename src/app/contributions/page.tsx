"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listContributionsWithStats, createContribution, ContributionWithStats } from "@/lib/contributions";
import { listExcos } from "@/lib/excos";
import { useAuth } from "@/lib/useAuth";
import RequireAuth from "@/components/RequireAuth";
import { Page, PageHeader, Card, Field, Loading, EmptyState, Notice } from "@/components/ui";
import { ContributionBar, ContributionStatusBadge } from "@/components/ContributionProgress";
import { formatPersonName } from "@/lib/formatName";
import { naira, todayISO } from "@/lib/format";
import {
  contributionPeriod,
  contributionTiming,
  getContributionStatus,
} from "@/lib/contributionStatus";
import type { ExcoMember } from "@/types";

function ContributionCard({ item, inCharge }: { item: ContributionWithStats; inCharge: string }) {
  const { stats } = item;
  const status = getContributionStatus(item);
  return (
    <Link
      href={`/contributions/${item.id}`}
      className="card block transition-colors hover:border-rccg-purple-300"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-rccg-purple-800">{item.title}</h3>
        <ContributionStatusBadge contribution={item} />
      </div>
      <p className="mt-1 text-sm text-muted">{contributionPeriod(item)}</p>
      <p className="text-xs text-muted">{contributionTiming(item)}</p>

      <div className="mt-4">
        <ContributionBar stats={stats} />
      </div>

      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <p className="num font-display text-xl font-bold text-rccg-green-700">{naira(stats.totalReceived)}</p>
          <p className="text-xs text-muted">received of {naira(stats.totalPledged)} pledged</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">In charge</p>
          <p className="text-sm font-medium text-ink">{inCharge}</p>
        </div>
      </div>

      {stats.outstanding > 0 && (
        <p className={`mt-3 text-xs font-medium ${status === "ended" ? "text-rccg-red-600" : "text-muted"}`}>
          {naira(stats.outstanding)} in pledges not yet paid
        </p>
      )}
    </Link>
  );
}

function ContributionsInner() {
  const { user, hasPermission } = useAuth();
  const [contributions, setContributions] = useState<ContributionWithStats[]>([]);
  const [excos, setExcos] = useState<ExcoMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [inChargeOf, setInChargeOf] = useState("");
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState(() => todayISO());
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = hasPermission("canEditFinance");

  async function refresh() {
    setLoading(true);
    const [data, excoData] = await Promise.all([
      listContributionsWithStats(),
      listExcos({ activeOnly: true }),
    ]);
    setContributions(data);
    setExcos(excoData);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  function excoName(id: string) {
    const exco = excos.find((e) => e.id === id);
    return exco ? formatPersonName(exco.name, exco.gender) : "—";
  }

  function resetForm() {
    setTitle("");
    setInChargeOf("");
    setNotes("");
    setStartDate(todayISO());
    setEndDate("");
    setError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !inChargeOf || !user) return;
    if (!startDate) return setError("Choose a start date.");
    if (endDate && endDate < startDate) return setError("The end date can't be before the start date.");

    setSaving(true);
    setError(null);
    try {
      await createContribution({
        title,
        inChargeOf,
        notes: notes || undefined,
        startDate,
        endDate: endDate || undefined,
        createdBy: user.uid,
      });
      resetForm();
      setShowForm(false);
      await refresh();
    } catch {
      setError("Couldn't create the contribution. Try again.");
    } finally {
      setSaving(false);
    }
  }

  // Ongoing drives first, then upcoming ones, then everything that's ended
  // (most recently ended on top). Ended drives still accept late payments.
  const today = todayISO();
  const rank = { ongoing: 0, upcoming: 1, ended: 2 } as const;
  const current = contributions
    .filter((c) => getContributionStatus(c, today) !== "ended")
    .sort((a, b) => rank[getContributionStatus(a, today)] - rank[getContributionStatus(b, today)]);
  const ended = contributions
    .filter((c) => getContributionStatus(c, today) === "ended")
    .sort((a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? ""));

  return (
    <Page>
      <PageHeader
        title="Contributions"
        description="What's been pledged and what's come in for each drive."
        actions={
          canEdit && (
            <button
              onClick={() => {
                setShowForm((s) => !s);
                setError(null);
              }}
              className={showForm ? "btn-secondary" : "btn-primary"}
            >
              {showForm ? "Cancel" : "New contribution"}
            </button>
          )
        }
      />

      {showForm && (
        <Card title="New contribution" className="mb-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <Field label="What's it for?">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Pastor's birthday 2026"
                className="input"
                required
              />
            </Field>

            <Field label="Who's in charge of collecting?">
              <select
                value={inChargeOf}
                onChange={(e) => setInChargeOf(e.target.value)}
                className="input"
                required
              >
                <option value="">Select an exco…</option>
                {excos.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {formatPersonName(ex.name, ex.gender)}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Start date">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input"
                  required
                />
              </Field>
              <Field label="End date (optional)">
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input"
                />
              </Field>
            </div>
            <p className="hint -mt-2">
              The end date only marks the contribution as ended. Pledges and payments can still be
              recorded after it.
            </p>

            <Field label="Notes (optional)">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="input"
              />
            </Field>

            {error && <Notice tone="error">{error}</Notice>}

            <button disabled={saving} className="btn-primary">
              {saving ? "Creating…" : "Create contribution"}
            </button>
          </form>
        </Card>
      )}

      {loading ? (
        <Loading />
      ) : contributions.length === 0 ? (
        <EmptyState
          title="No contributions yet"
          description={
            canEdit
              ? "Start one for an event, a gift or any drive the youths are giving toward."
              : "Contributions will show up here once an exco starts one."
          }
        />
      ) : (
        <div className="space-y-8">
          {current.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-semibold text-rccg-purple-800">Ongoing and upcoming</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {current.map((c) => (
                  <ContributionCard key={c.id} item={c} inCharge={excoName(c.inChargeOf)} />
                ))}
              </div>
            </section>
          )}

          {ended.length > 0 && (
            <section>
              <h2 className="mb-1 text-base font-semibold text-rccg-purple-800">Ended</h2>
              <p className="mb-3 text-sm text-muted">
                Ended contributions still accept late pledges and payments.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {ended.map((c) => (
                  <ContributionCard key={c.id} item={c} inCharge={excoName(c.inChargeOf)} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </Page>
  );
}

export default function ContributionsPage() {
  return (
    <RequireAuth>
      <ContributionsInner />
    </RequireAuth>
  );
}
