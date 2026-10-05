"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getEvent,
  updateEventDetails,
  updateEventAgenda,
  updateEventTasks,
  updateEventPlanningNotes,
  updateEventAfterEventReport,
} from "@/lib/events";
import { listExcos } from "@/lib/excos";
import { listYouths } from "@/lib/youths";
import { getContribution, getPledges, listExternalSupport, computeStats, ContributionStats } from "@/lib/contributions";
import { contributionPeriod, contributionTiming } from "@/lib/contributionStatus";
import { formatDate, naira, todayISO } from "@/lib/format";
import { useAuth } from "@/lib/useAuth";
import RequireAuth from "@/components/RequireAuth";
import AttendanceChecklist from "@/components/AttendanceChecklist";
import AgendaEditor from "@/components/AgendaEditor";
import TaskAssignment from "@/components/TaskAssignment";
import EditableSection from "@/components/EditableSection";
import StartEventContribution from "@/components/StartEventContribution";
import { Page, PageHeader, Card, Badge, Field, Loading, Notice } from "@/components/ui";
import { ContributionBar, ContributionStatusBadge } from "@/components/ContributionProgress";
import type { ChurchEvent, ExcoMember, Youth, AgendaItem, EventTask, Contribution } from "@/types";

function EventDetailInner({ id }: { id: string }) {
  const { user, hasPermission } = useAuth();
  const [event, setEvent] = useState<ChurchEvent | null>(null);
  // Agenda/task ownership draws on excos; attendance is tracked against
  // the youth roster; tasks can go to either (see TaskAssignment).
  const [excos, setExcos] = useState<ExcoMember[]>([]);
  const [youths, setYouths] = useState<Youth[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingDetails, setEditingDetails] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [dateDraft, setDateDraft] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);

  const [contribution, setContribution] = useState<Contribution | null>(null);
  const [contributionStats, setContributionStats] = useState<ContributionStats | null>(null);
  const [showStartContribution, setShowStartContribution] = useState(false);

  const canEditEvent = hasPermission("canEditEvents");
  const canStartContribution = hasPermission("canEditFinance") && hasPermission("canEditEvents");

  async function loadContribution(contributionId: string) {
    const [contributionData, pledges, externalSupport] = await Promise.all([
      getContribution(contributionId),
      getPledges(contributionId),
      listExternalSupport(contributionId),
    ]);
    setContribution(contributionData);
    setContributionStats(computeStats(pledges, externalSupport));
  }

  async function load() {
    setLoading(true);
    const [eventData, excoData, youthData] = await Promise.all([
      getEvent(id),
      listExcos({ activeOnly: true }),
      listYouths({ activeOnly: true }),
    ]);
    setEvent(eventData);
    setExcos(excoData);
    setYouths(youthData);
    if (eventData?.contributionId) await loadContribution(eventData.contributionId);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleAgendaChange(agenda: AgendaItem[]) {
    if (!event) return;
    setEvent({ ...event, agenda }); // optimistic
    await updateEventAgenda(id, agenda);
  }

  async function handleTasksChange(tasks: EventTask[]) {
    if (!event) return;
    setEvent({ ...event, tasks }); // optimistic
    await updateEventTasks(id, tasks);
  }

  function startEditingDetails() {
    if (!event) return;
    setTitleDraft(event.title);
    setDateDraft(event.date);
    setEditingDetails(true);
  }

  async function saveDetails() {
    if (!titleDraft.trim() || !event) return;
    setSavingDetails(true);
    await updateEventDetails(id, { title: titleDraft, date: dateDraft });
    setEvent({ ...event, title: titleDraft, date: dateDraft });
    setSavingDetails(false);
    setEditingDetails(false);
  }

  if (loading)
    return (
      <Page size="md">
        <Loading />
      </Page>
    );
  if (!event)
    return (
      <Page size="md">
        <Notice tone="error">Event not found.</Notice>
      </Page>
    );

  const hasHappened = event.date <= todayISO();

  return (
    <Page size="md">
      {editingDetails ? (
        <Card title="Edit event" className="mb-6">
          <div className="space-y-3">
            <Field label="Title">
              <input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} className="input" />
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={dateDraft}
                onChange={(e) => setDateDraft(e.target.value)}
                className="input sm:w-auto"
              />
            </Field>
            <div className="flex gap-2">
              <button onClick={saveDetails} disabled={savingDetails} className="btn-primary btn-sm">
                {savingDetails ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setEditingDetails(false)} className="btn-secondary btn-sm">
                Cancel
              </button>
            </div>
          </div>
        </Card>
      ) : (
        <PageHeader
          title={event.title}
          backHref="/events"
          backLabel="Events"
          description={formatDate(event.date)}
          actions={
            <>
              <Badge tone={hasHappened ? "gray" : "green"} dot>
                {hasHappened ? "Concluded" : "Upcoming"}
              </Badge>
              {canEditEvent && (
                <button onClick={startEditingDetails} className="btn-secondary btn-sm">
                  Edit
                </button>
              )}
            </>
          }
        />
      )}

      <div className="space-y-6">
        <Card title="Agenda">
          <AgendaEditor agenda={event.agenda} excos={excos} canEdit={canEditEvent} onChange={handleAgendaChange} />
        </Card>

        <Card title="Tasks">
          <TaskAssignment
            tasks={event.tasks}
            excos={excos}
            youths={youths}
            canEdit={canEditEvent}
            onChange={handleTasksChange}
          />
        </Card>

        <Card
          title="Planning notes"
          description="Thoughts, suggestions and things to consider while this is still being planned."
        >
          <EditableSection
            value={event.planningNotes ?? ""}
            canEdit={canEditEvent}
            placeholder="Jot down ideas, open questions, things to sort out…"
            onSave={async (value) => {
              await updateEventPlanningNotes(id, value);
              setEvent({ ...event, planningNotes: value });
            }}
          />
        </Card>

        <Card title="Contribution">
          {contribution ? (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Link href={`/contributions/${contribution.id}`} className="link text-base">
                  {contribution.title}
                </Link>
                <ContributionStatusBadge contribution={contribution} />
              </div>
              <p className="mt-0.5 text-sm text-muted">
                {contributionPeriod(contribution)}. {contributionTiming(contribution)}.
              </p>
              {contributionStats && (
                <div className="mt-4">
                  <ContributionBar stats={contributionStats} />
                  <p className="mt-2 text-sm">
                    <span className="num font-semibold text-rccg-green-700">
                      {naira(contributionStats.totalReceived)}
                    </span>{" "}
                    <span className="text-muted">
                      received of {naira(contributionStats.totalPledged)} pledged
                    </span>
                  </p>
                </div>
              )}
            </div>
          ) : showStartContribution ? (
            <StartEventContribution
              eventId={id}
              eventTitle={event.title}
              excos={excos}
              createdBy={user?.uid ?? ""}
              onCreated={(contributionId) => {
                setEvent({ ...event, contributionId });
                setShowStartContribution(false);
                loadContribution(contributionId);
              }}
              onCancel={() => setShowStartContribution(false)}
            />
          ) : (
            <div>
              <p className="mb-3 text-sm text-muted">No contribution started for this event yet.</p>
              {canStartContribution && (
                <button onClick={() => setShowStartContribution(true)} className="btn-secondary btn-sm">
                  Start a contribution
                </button>
              )}
            </div>
          )}
        </Card>

        {hasHappened ? (
          <>
            <Card title="After-event report">
              <EditableSection
                value={event.afterEventReport ?? ""}
                canEdit={canEditEvent}
                placeholder="How did it go? What happened, and what to note for next time…"
                onSave={async (value) => {
                  await updateEventAfterEventReport(id, value);
                  setEvent({ ...event, afterEventReport: value });
                }}
              />
            </Card>

            <Card title="Attendance">
              <AttendanceChecklist
                gatheringType="events"
                gatheringId={id}
                people={youths}
                canEdit={canEditEvent}
                onYouthAdded={(y) => setYouths((prev) => [...prev, y])}
              />
            </Card>
          </>
        ) : (
          <Notice tone="info">
            The after-event report and attendance checklist will appear here once {formatDate(event.date)} arrives.
          </Notice>
        )}
      </div>
    </Page>
  );
}

export default function EventDetailPage({ params }: { params: { id: string } }) {
  return (
    <RequireAuth>
      <EventDetailInner id={params.id} />
    </RequireAuth>
  );
}
