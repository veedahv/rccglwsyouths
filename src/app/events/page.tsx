"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listEvents, createEvent } from "@/lib/events";
import { useAuth } from "@/lib/useAuth";
import { formatDate, todayISO } from "@/lib/format";
import RequireAuth from "@/components/RequireAuth";
import { Page, PageHeader, Card, Field, Badge, Loading, EmptyState } from "@/components/ui";
import type { ChurchEvent } from "@/types";

function EventsInner() {
  const { user, hasPermission } = useAuth();
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => todayISO());
  const [saving, setSaving] = useState(false);

  const canEdit = hasPermission("canEditEvents");

  async function refresh() {
    setLoading(true);
    setEvents(await listEvents());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !user) return;
    setSaving(true);
    await createEvent({ title, date, createdBy: user.uid });
    setTitle("");
    setShowForm(false);
    setSaving(false);
    refresh();
  }

  const today = todayISO();

  return (
    <Page size="md">
      <PageHeader
        title="Events"
        description="Plan the agenda, assign tasks and write the report once an event is done."
        actions={
          canEdit && (
            <button onClick={() => setShowForm((s) => !s)} className={showForm ? "btn-secondary" : "btn-primary"}>
              {showForm ? "Cancel" : "New event"}
            </button>
          )
        }
      />

      {showForm && (
        <Card title="New event" className="mb-6">
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <Field label="Event title">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" required />
            </Field>
            <Field label="Date">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
            </Field>
            <button disabled={saving} className="btn-primary">
              {saving ? "Creating…" : "Create event"}
            </button>
          </form>
        </Card>
      )}

      {loading ? (
        <Loading />
      ) : events.length === 0 ? (
        <EmptyState title="No events yet" description={canEdit ? "Create the first one to start planning." : undefined} />
      ) : (
        <ul className="space-y-2">
          {events.map((e) => {
            const hasHappened = e.date <= today;
            return (
              <li key={e.id}>
                <Link
                  href={`/events/${e.id}`}
                  className="card flex items-center justify-between gap-3 !p-4 transition-colors hover:border-rccg-purple-300"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-rccg-purple-800">{e.title}</p>
                    <p className="text-sm text-muted">{formatDate(e.date)}</p>
                  </div>
                  <Badge tone={hasHappened ? "gray" : "green"} dot>
                    {hasHappened ? "Concluded" : "Upcoming"}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}

export default function EventsPage() {
  return (
    <RequireAuth>
      <EventsInner />
    </RequireAuth>
  );
}
