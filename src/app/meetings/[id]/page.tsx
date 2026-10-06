"use client";

import { useEffect, useState } from "react";
import {
  getMeeting,
  updateMeetingMinutes,
  updateMeetingActions,
  updateMeetingAudience,
  meetingAttendees,
  pendingActionCount,
  audienceOf,
  audienceSummary,
} from "@/lib/meetings";
import { listExcos } from "@/lib/excos";
import { listYouths } from "@/lib/youths";
import { useAuth } from "@/lib/useAuth";
import { formatDate } from "@/lib/format";
import RequireAuth from "@/components/RequireAuth";
import TaskAssignment from "@/components/TaskAssignment";
import AttendanceChecklist from "@/components/AttendanceChecklist";
import MeetingAudienceFields from "@/components/MeetingAudienceFields";
import { Page, PageHeader, Card, Loading, Notice } from "@/components/ui";
import type { Attendee, ExcoMember, Meeting, MeetingActionItem, MeetingAudience, Youth } from "@/types";

function MeetingDetailInner({ id }: { id: string }) {
  const { hasPermission } = useAuth();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [youths, setYouths] = useState<Youth[]>([]);
  const [excos, setExcos] = useState<ExcoMember[]>([]);
  const [editingAudience, setEditingAudience] = useState(false);
  const [draftAudience, setDraftAudience] = useState<MeetingAudience>("youths");
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const [savingAudience, setSavingAudience] = useState(false);
  const [minutes, setMinutes] = useState("");
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  const canEdit = hasPermission("canEditMinutes");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [meetingData, youthData, excoData] = await Promise.all([
        getMeeting(id),
        listYouths({ activeOnly: true }),
        listExcos({ activeOnly: true }),
      ]);
      setMeeting(meetingData);
      setMinutes(meetingData?.minutesContent ?? "");
      setYouths(youthData);
      setExcos(excoData);
      setLoading(false);
    }
    load();
  }, [id]);

  async function saveMinutes() {
    setSaving(true);
    await updateMeetingMinutes(id, minutes);
    setSaving(false);
    setShowEdit(false);
  }

  // Saves straight away, like event tasks. Optimistic so the status
  // dropdown doesn't feel laggy; rolls back if the write fails.
  async function handleActionsChange(actionItems: MeetingActionItem[]) {
    if (!meeting) return;
    const previous = meeting.actionItems ?? [];
    setMeeting({ ...meeting, actionItems });
    try {
      await updateMeetingActions(id, actionItems);
    } catch {
      setMeeting((m) => (m ? { ...m, actionItems: previous } : m));
    }
  }

  function startEditingAudience() {
    if (!meeting) return;
    setDraftAudience(audienceOf(meeting));
    setDraftIds(meeting.attendeeIds ?? []);
    setAudienceError(null);
    setEditingAudience(true);
  }

  async function saveAudience() {
    if (draftAudience === "selected" && draftIds.length === 0) {
      return setAudienceError("Pick at least one youth, or choose a different audience.");
    }
    setSavingAudience(true);
    setAudienceError(null);
    try {
      await updateMeetingAudience(id, draftAudience, draftIds);
      setMeeting((m) =>
        m ? { ...m, audience: draftAudience, attendeeIds: draftAudience === "selected" ? draftIds : [] } : m
      );
      setEditingAudience(false);
    } catch {
      setAudienceError("Couldn't save this change. Try again.");
    } finally {
      setSavingAudience(false);
    }
  }

  // Someone not on the roster turned up. They're added to the youth list,
  // and, for a selected-group meeting, to the group too so they stay on
  // this meeting's list after a reload.
  async function handleYouthAdded(youth: Youth) {
    setYouths((prev) => [...prev, youth]);
    if (meeting && audienceOf(meeting) === "selected") {
      const ids = [...(meeting.attendeeIds ?? []), youth.id];
      setMeeting({ ...meeting, attendeeIds: ids });
      await updateMeetingAudience(id, "selected", ids).catch(() => { });
    }
  }

  if (loading)
    return (
      <Page size="md">
        <Loading />
      </Page>
    );
  if (!meeting)
    return (
      <Page size="md">
        <Notice tone="error">Meeting not found.</Notice>
      </Page>
    );

  const audience = audienceOf(meeting);
  const attendees: Attendee[] = meetingAttendees(meeting, youths, excos);
  const actions = meeting.actionItems ?? [];
  const pendingActions = pendingActionCount(meeting);

  return (
    <Page size="md">
      <PageHeader
        title={meeting.title}
        description={`${formatDate(meeting.date)} · ${audienceSummary(meeting)}`}
        backHref="/meetings"
        backLabel="Meetings"
      />

      <div className="space-y-6">
        <Card title="Minutes" action={
          canEdit && !showEdit ? (
            <button onClick={() => setShowEdit(true)} className="btn-secondary btn-sm">
              Edit minutes
            </button>
          ) : undefined
        }>
          {showEdit ? (
            <div>
              <textarea
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                rows={12}
                className="input leading-relaxed"
                placeholder="Write the minutes for this meeting…"
              />
              <div className="flex gap-3">
                <button onClick={saveMinutes} disabled={saving} className="btn-primary mt-3">
                  {saving ? "Saving…" : "Save minutes"}
                </button>
                <button onClick={() => setShowEdit(false)} className="btn-secondary mt-3">
                  Cancel
                </button>
              </div>
            </div>
          ) : minutes ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{minutes}</p>
          ) : (
            <p className="text-sm text-muted">No minutes recorded yet.</p>
          )}
        </Card>

        <Card
          title="After-meeting actions"
          description={
            actions.length === 0
              ? "Who needs to do what following this meeting."
              : `${pendingActions} pending of ${actions.length}`
          }
        >
          <TaskAssignment
            tasks={actions}
            excos={excos}
            youths={youths}
            canEdit={canEdit}
            onChange={handleActionsChange}
            emptyLabel="No actions from this meeting yet."
            placeholder="Action (e.g. Design the sports flyer)"
            addLabel="Add action"
          />
        </Card>

        <Card
          title="Attendance"
          description={audience === "excos" ? "Excos" : audience === "selected" ? "Selected group" : "All youths"}
          action={
            canEdit && !editingAudience ? (
              <button onClick={startEditingAudience} className="btn-ghost btn-sm">
                Change who it&apos;s for
              </button>
            ) : undefined
          }
        >
          {editingAudience ? (
            <div className="space-y-4">
              <MeetingAudienceFields
                audience={draftAudience}
                onAudienceChange={setDraftAudience}
                youths={youths}
                selectedIds={draftIds}
                onSelectedChange={setDraftIds}
              />
              <p className="text-xs text-muted">
                Attendance you&apos;ve already marked is kept, even for anyone who is no longer on the list.
              </p>
              {audienceError && <Notice tone="error">{audienceError}</Notice>}
              <div className="flex gap-2">
                <button onClick={saveAudience} disabled={savingAudience} className="btn-primary">
                  {savingAudience ? "Saving…" : "Save"}
                </button>
                <button onClick={() => setEditingAudience(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <AttendanceChecklist
              gatheringType="meetings"
              gatheringId={id}
              people={attendees}
              allowQuickAdd={audience !== "excos"}
              onYouthAdded={handleYouthAdded}
              canEdit={canEdit}
            />
          )}
        </Card>
      </div>
    </Page>
  );
}

export default function MeetingDetailPage({ params }: { params: { id: string } }) {
  return (
    <RequireAuth>
      <MeetingDetailInner id={params.id} />
    </RequireAuth>
  );
}
