import { daysBetween, formatDateTime, todayISO } from "@/lib/format";
import type { ChurchEvent } from "@/types";

function countdown(date: string): string {
  const d = daysBetween(todayISO(), date);
  if (d === 0) return "Today";
  if (d > 0) return d === 1 ? "Tomorrow" : `In ${d} days`;
  return d === -1 ? "Yesterday" : `${-d} days ago`;
}

function Detail({ label, value, empty }: { label: string; value?: string; empty: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-rccg-purple-700/60">{label}</dt>
      <dd className={`mt-0.5 text-sm font-medium ${value ? "text-rccg-purple-700" : "text-rccg-purple-700/50"}`}>{value || empty}</dd>
    </div>
  );
}

/** The top of the event page: its name, when it is, and the key details at a glance. */
export default function EventHero({
  event,
  hasHappened,
  canEdit,
  onEdit,
}: {
  event: ChurchEvent;
  hasHappened: boolean;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const empty = canEdit ? "Not set yet" : "—";
  return (
    <header className="mb-6 overflow-hidden rounded-2xl bg-white text-rccg-purple-700 shadow-sm">
      <div className="h-1 bg-gradient-to-r from-rccg-green-500 to-rccg-red-600" aria-hidden="true" />
      <div className="px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rccg-purple-700/15 px-2.5 py-0.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${hasHappened ? "bg-rccg-purple-700/60" : "bg-rccg-green-500"}`}
                  aria-hidden="true"
                />
                {hasHappened ? "Concluded" : "Upcoming"}
              </span>
              <span className="text-rccg-purple-700/70">{countdown(event.date)}</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{event.title}</h1>
          </div>

          {canEdit && (
            <button type="button" onClick={onEdit} className="btn btn-sm bg-rccg-purple-800 text-white hover:bg-rccg-purple-500">
              Edit event
            </button>
          )}
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 border-t border-rccg-purple-700/15 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="When" value={formatDateTime(event.date, event.time)} empty={empty} />
          <Detail label="Where" value={event.venue} empty={empty} />
          <Detail label="Theme" value={event.theme} empty={empty} />
          <Detail label="Expected attendance" value={event.expectedAttendance} empty={empty} />
        </dl>
      </div>
    </header>
  );
}
