"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listMeetings, createMeeting, audienceSummary } from "@/lib/meetings";
import { listYouths } from "@/lib/youths";
import { useAuth } from "@/lib/useAuth";
import { formatDate, todayISO } from "@/lib/format";
import RequireAuth from "@/components/RequireAuth";
import MeetingAudienceFields from "@/components/MeetingAudienceFields";
import { Page, PageHeader, Card, Field, Badge, Loading, EmptyState, Notice } from "@/components/ui";
import type { Meeting, MeetingAudience, Youth } from "@/types";

function MeetingsInner() {
  const { user, hasPermission } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => todayISO());
  const [saving, setSaving] = useState(false);
  const [audience, setAudience] = useState<MeetingAudience>("youths");
  const [youths, setYouths] = useState<Youth[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const canEdit = hasPermission("canEditMinutes");

  async function refresh() {
    setLoading(true);
    setMeetings(await listMeetings());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  // Only people who can create meetings need the youth list (for picking a group).
  useEffect(() => {
    if (canEdit) listYouths({ activeOnly: true }).then(setYouths);
  }, [canEdit]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !user) return;
    if (audience === "selected" && selectedIds.length === 0) {
      return setError("Pick at least one youth for this group, or choose a different audience.");
    }
    setError(null);
    setSaving(true);
    try {
      await createMeeting({ title, date, createdBy: user.uid, audience, attendeeIds: selectedIds });
      setTitle("");
      setAudience("youths");
      setSelectedIds([]);
      setShowForm(false);
      refresh();
    } catch {
      setError("Couldn't create this meeting. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page size="md">
      <PageHeader
        title="Meetings"
        description="Minutes and attendance for exco meetings, all-youth meetings and meetings for a selected group."
        actions={
          canEdit && (
            <button onClick={() => setShowForm((s) => !s)} className={showForm ? "btn-secondary" : "btn-primary"}>
              {showForm ? "Cancel" : "New meeting"}
            </button>
          )
        }
      />

      {showForm && (
        <Card title="New meeting" className="mb-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <Field label="Meeting title">
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" required />
              </Field>
              <Field label="Date">
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
              </Field>
            </div>
            <MeetingAudienceFields
              audience={audience}
              onAudienceChange={setAudience}
              youths={youths}
              selectedIds={selectedIds}
              onSelectedChange={setSelectedIds}
            />
            {error && <Notice tone="error">{error}</Notice>}
            <button disabled={saving} className="btn-primary">
              {saving ? "Creating…" : "Create meeting"}
            </button>
          </form>
        </Card>
      )}

      {loading ? (
        <Loading />
      ) : meetings.length === 0 ? (
        <EmptyState title="No meetings yet" description={canEdit ? "Create one to start taking minutes." : undefined} />
      ) : (
        <ul className="space-y-2">
          {meetings.map((m) => (
            <li key={m.id}>
              <Link
                href={`/meetings/${m.id}`}
                className="card flex items-center justify-between gap-3 !p-4 transition-colors hover:border-rccg-purple-300"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-rccg-purple-800">{m.title}</p>
                  <p className="text-sm text-muted">
                    {formatDate(m.date)} · {audienceSummary(m)}
                  </p>
                </div>
                {m.minutesContent?.trim() ? (
                  <Badge tone="green" dot>
                    Minutes written
                  </Badge>
                ) : (
                  <Badge tone="gray">No minutes yet</Badge>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

export default function MeetingsPage() {
  return (
    <RequireAuth>
      <MeetingsInner />
    </RequireAuth>
  );
}
