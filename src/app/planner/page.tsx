"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  listProgrammes,
  createProgramme,
  updateProgramme,
  setProgrammeStatus,
  deleteProgramme,
  createEventFromProgramme,
  MONTH_NAMES,
  STATUS_LABEL,
  type ProgrammeInput,
} from "@/lib/programmes";
import { listEvents } from "@/lib/events";
import { useAuth } from "@/lib/useAuth";
import { formatDate, naira } from "@/lib/format";
import { formatPersonName } from "@/lib/formatName";
import RequireAuth from "@/components/RequireAuth";
import ProgrammeForm from "@/components/ProgrammeForm";
import ProgrammeCard from "@/components/ProgrammeCard";
import { Page, PageHeader, Card, Stat, Loading, EmptyState, Notice } from "@/components/ui";
import type { ChurchEvent, Programme, ProgrammeStatus } from "@/types";

type View = "months" | "status";

const STATUS_ORDER: ProgrammeStatus[] = ["suggested", "approved", "declined"];

// This time of year the team is planning for the year ahead, so open on
// next year from October; otherwise on the current one.
function defaultPlannerYear(): number {
  const now = new Date();
  return now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
}

function PlannerInner() {
  const { user, exco, hasPermission } = useAuth();
  const canManage = hasPermission("canEditEvents");

  const [year, setYear] = useState(defaultPlannerYear);
  const [view, setView] = useState<View>("months");
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const thisYear = new Date().getFullYear();
  const years = useMemo(() => {
    const list = [thisYear - 1, thisYear, thisYear + 1, thisYear + 2];
    return list.includes(year) ? list : [...list, year].sort((a, b) => a - b);
  }, [thisYear, year]);

  async function refresh() {
    setLoadError(false);
    try {
      const [progs, evs] = await Promise.all([listProgrammes(year), listEvents()]);
      setProgrammes(progs);
      setEvents(evs);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const myName = exco ? formatPersonName(exco.name, exco.gender) : "";

  async function handleCreate(input: ProgrammeInput) {
    if (!user) return;
    await createProgramme(input, { uid: user.uid, name: myName });
    // If it was filed under another year, jump there so it doesn't seem to vanish.
    if (input.year !== year) setYear(input.year);
    else await refresh();
    setShowForm(false);
  }

  // Events already on the calendar that didn't come from a programme —
  // shown muted in the month view so the year reads as one picture.
  const linkedEventIds = new Set(programmes.map((p) => p.eventId).filter(Boolean));
  const otherEvents = events.filter(
    (e) => e.date.startsWith(`${year}-`) && !e.programmeId && !linkedEventIds.has(e.id)
  );

  const counts = {
    suggested: programmes.filter((p) => p.status === "suggested").length,
    approved: programmes.filter((p) => p.status === "approved").length,
    eventsCreated: programmes.filter((p) => p.eventId).length,
  };
  const approvedBudget = programmes
    .filter((p) => p.status === "approved")
    .reduce((sum, p) => sum + (p.estimatedBudget ?? 0), 0);

  function renderCard(p: Programme, showMonth: boolean) {
    return (
      <ProgrammeCard
        key={p.id}
        programme={p}
        years={years}
        canManage={canManage}
        isMine={p.createdBy === user?.uid}
        showMonth={showMonth}
        onSetStatus={async (status) => {
          await setProgrammeStatus(p.id, status, myName);
          await refresh();
        }}
        onSave={async (input) => {
          await updateProgramme(p.id, input);
          if (input.year !== year) setYear(input.year);
          else await refresh();
        }}
        onDelete={async () => {
          await deleteProgramme(p.id);
          await refresh();
        }}
        onCreateEvent={async (details) => {
          if (!user) return;
          await createEventFromProgramme(p, details, user.uid);
          await refresh();
        }}
      />
    );
  }

  const viewButton = (v: View, label: string) => (
    <button
      type="button"
      onClick={() => setView(v)}
      aria-pressed={view === v}
      className={view === v ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
    >
      {label}
    </button>
  );

  return (
    <Page>
      <PageHeader
        title="Yearly planner"
        description="Collect ideas for the year's programmes, agree which to go ahead with, then turn approved ones into events."
        actions={
          <>
            <label className="sr-only" htmlFor="planner-year">
              Year
            </label>
            <select
              id="planner-year"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="input !w-auto"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button onClick={() => setShowForm((s) => !s)} className={showForm ? "btn-secondary" : "btn-primary"}>
              {showForm ? "Cancel" : "Suggest a programme"}
            </button>
          </>
        }
      />

      {showForm && (
        <Card title="Suggest a programme" description="Rough is fine. Everyone can add ideas; approving is up to those who manage events." className="mb-6">
          <ProgrammeForm
            defaultYear={year}
            years={years}
            submitLabel="Add suggestion"
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        </Card>
      )}

      {loading ? (
        <Loading />
      ) : loadError ? (
        <Notice tone="error">Couldn't load the planner. Check your connection and refresh.</Notice>
      ) : (
        <>
          <div className="card mb-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
            <Stat label="Suggested" value={counts.suggested} hint="awaiting a decision" />
            <Stat label="Approved" value={counts.approved} tone="green" />
            <Stat label="Approved budget" value={approvedBudget ? naira(approvedBudget) : "—"} hint="rough, from estimates" />
            <Stat label="Events created" value={counts.eventsCreated} tone="purple" />
          </div>

          <div className="mb-4 flex items-center gap-2">
            {viewButton("months", "By month")}
            {viewButton("status", "By status")}
          </div>

          {programmes.length === 0 && otherEvents.length === 0 ? (
            <EmptyState
              title={`Nothing planned for ${year} yet`}
              description="Add the first idea with “Suggest a programme”. A month and a rough budget help, but only the title is needed."
            />
          ) : view === "months" ? (
            <MonthsView year={year} programmes={programmes} otherEvents={otherEvents} renderCard={renderCard} />
          ) : (
            <div className="space-y-8">
              {STATUS_ORDER.map((status) => {
                const list = programmes.filter((p) => p.status === status);
                return (
                  <section key={status}>
                    <h2 className="mb-3 text-base font-semibold text-rccg-purple-800">
                      {STATUS_LABEL[status]} <span className="font-normal text-muted">({list.length})</span>
                    </h2>
                    {list.length === 0 ? (
                      <p className="text-sm text-muted">None.</p>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {list.map((p) => renderCard(p, true))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </Page>
  );
}

function MonthsView({
  year,
  programmes,
  otherEvents,
  renderCard,
}: {
  year: number;
  programmes: Programme[];
  otherEvents: ChurchEvent[];
  renderCard: (p: Programme, showMonth: boolean) => React.ReactNode;
}) {
  const unplaced = programmes.filter((p) => !p.month);
  const currentMonth = new Date().getMonth() + 1;
  const isThisYear = year === new Date().getFullYear();

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {MONTH_NAMES.map((name, i) => {
        const month = i + 1;
        const list = programmes.filter((p) => p.month === month);
        const evs = otherEvents
          .filter((e) => Number(e.date.slice(5, 7)) === month)
          .sort((a, b) => a.date.localeCompare(b.date));
        const isNow = isThisYear && month === currentMonth;
        return (
          <section
            key={name}
            className={`rounded-xl border p-3 ${isNow ? "border-rccg-green-500 bg-rccg-green-50/40" : "border-line bg-white/60"}`}
          >
            <h2 className="mb-2 text-sm font-semibold text-rccg-purple-800">{name}</h2>
            {list.length === 0 && evs.length === 0 ? (
              <p className="text-xs text-muted">Nothing yet.</p>
            ) : (
              <div className="space-y-2">
                {list.map((p) => renderCard(p, false))}
                {evs.map((e) => (
                  <Link
                    key={e.id}
                    href={`/events/${e.id}`}
                    className="flex items-baseline justify-between gap-2 rounded-lg bg-mist px-3 py-2 text-xs text-muted hover:text-rccg-purple-700"
                  >
                    <span className="truncate font-medium">{e.title}</span>
                    <span className="shrink-0">{formatDate(e.date)}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {unplaced.length > 0 && (
        <section className="rounded-xl border border-dashed border-rccg-purple-200 bg-white/60 p-3">
          <h2 className="mb-2 text-sm font-semibold text-rccg-purple-800">Month not decided</h2>
          <div className="space-y-2">{unplaced.map((p) => renderCard(p, false))}</div>
        </section>
      )}
    </div>
  );
}

export default function PlannerPage() {
  return (
    <RequireAuth>
      <PlannerInner />
    </RequireAuth>
  );
}
