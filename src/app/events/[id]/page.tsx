"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  getEvent,
  updateEventDetails,
  updateEventAgenda,
  updateEventTasks,
  updateEventBudget,
  updateEventNeededItems,
  budgetTotal,
  updateEventPlanningNotes,
  updateEventAfterEventReport,
} from "@/lib/events";
import { listExcos } from "@/lib/excos";
import { listEventDocuments } from "@/lib/eventDocuments";
import {
  addEventExpense,
  deleteEventExpense,
  listEventExpenses,
  updateEventExpense,
  ExpenseInput,
} from "@/lib/eventExpenses";
import { checkNeededItems, eventMoney, linkMap, spendingBreakdown } from "@/lib/eventBudget";
import { listYouths } from "@/lib/youths";
import { getContribution, getPledges, listExternalSupport, computeStats, ContributionStats } from "@/lib/contributions";
import { formatDate, todayISO } from "@/lib/format";
import { useAuth } from "@/lib/useAuth";
import RequireAuth from "@/components/RequireAuth";
import EventHero from "@/components/EventHero";
import EditEventModal, { EventDetailsValues } from "@/components/EditEventModal";
import BudgetSummary from "@/components/BudgetSummary";
import BudgetLines from "@/components/BudgetLines";
import EventExpenses, { ExpensePrefill } from "@/components/EventExpenses";
import NeededItemsCard from "@/components/NeededItemsCard";
import EventContributionPanel from "@/components/EventContributionPanel";
import AttendanceChecklist from "@/components/AttendanceChecklist";
import AgendaEditor from "@/components/AgendaEditor";
import TaskAssignment from "@/components/TaskAssignment";
import EditableSection from "@/components/EditableSection";
import StartEventContribution from "@/components/StartEventContribution";
import EventDocuments from "@/components/EventDocuments";
import { Page, PageHeader, Card, Loading, Notice } from "@/components/ui";
import type {
  ChurchEvent,
  ExcoMember,
  Youth,
  AgendaItem,
  EventTask,
  BudgetItem,
  NeededItem,
  Contribution,
  EventDocument,
  EventExpense,
} from "@/types";

const SAVE_ERROR = "That didn't save. Check your connection and try again.";

function EventDetailInner({ id }: { id: string }) {
  const { user, hasPermission } = useAuth();
  const [event, setEvent] = useState<ChurchEvent | null>(null);
  // Agenda/task ownership draws on excos; attendance is tracked against
  // the youth roster; tasks can go to either (see TaskAssignment).
  const [excos, setExcos] = useState<ExcoMember[]>([]);
  const [youths, setYouths] = useState<Youth[]>([]);
  const [documents, setDocuments] = useState<EventDocument[]>([]);
  const [expenses, setExpenses] = useState<EventExpense[]>([]);
  const [contribution, setContribution] = useState<Contribution | null>(null);
  const [contributionStats, setContributionStats] = useState<ContributionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [editingDetails, setEditingDetails] = useState(false);
  const [showStartContribution, setShowStartContribution] = useState(false);
  // Set when "Record purchase" is chosen on a budget sub-item: opens the spending dialog pre-filled.
  const [purchasePrefill, setPurchasePrefill] = useState<ExpensePrefill | null>(null);

  const canEditEvent = hasPermission("canEditEvents");
  const canStartContribution = hasPermission("canEditFinance") && hasPermission("canEditEvents");
  // Planning the event covers the budget and the items list; money going
  // out can also be recorded by whoever handles the finances.
  const canRecordSpending = canEditEvent || hasPermission("canEditFinance");

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
    try {
      const [eventData, excoData, youthData, documentData, expenseData] = await Promise.all([
        getEvent(id),
        listExcos({ activeOnly: true }),
        listYouths({ activeOnly: true }),
        listEventDocuments(id),
        listEventExpenses(id),
      ]);
      setEvent(eventData);
      setExcos(excoData);
      setYouths(youthData);
      setDocuments(documentData);
      setExpenses(expenseData);
      if (eventData?.contributionId) await loadContribution(eventData.contributionId);
    } catch (err) {
      console.error(err);
      setPageError("Couldn't load this event. Check your connection and refresh.");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Items needed and the budget are linked both ways, so they are worked out together:
  // purchases make a linked needed item covered, and a covered needed item makes its budget twin donated.
  const itemsResult = useMemo(
    () => checkNeededItems(event?.neededItems, contributionStats?.receivedItemLines ?? [], expenses),
    [event?.neededItems, contributionStats, expenses]
  );
  const links = useMemo(() => linkMap(itemsResult.checks), [itemsResult]);
  const breakdown = useMemo(() => spendingBreakdown(event?.budget, expenses, links), [event?.budget, expenses, links]);
  const money = useMemo(
    () => eventMoney(event?.budget, expenses, contributionStats, links),
    [event?.budget, expenses, contributionStats, links]
  );

  // Runs a write; when it fails the page shows a message and rolls back.
  async function attempt(run: () => Promise<void>, rollback?: () => void): Promise<boolean> {
    try {
      await run();
      setPageError(null);
      return true;
    } catch (err) {
      console.error(err);
      rollback?.();
      setPageError(SAVE_ERROR);
      return false;
    }
  }

  function handleAgendaChange(agenda: AgendaItem[]) {
    if (!event) return;
    const previous = event;
    setEvent({ ...event, agenda }); // optimistic
    void attempt(() => updateEventAgenda(id, agenda), () => setEvent(previous));
  }

  function handleTasksChange(tasks: EventTask[]) {
    if (!event) return;
    const previous = event;
    setEvent({ ...event, tasks }); // optimistic
    void attempt(() => updateEventTasks(id, tasks), () => setEvent(previous));
  }

  async function handleBudgetChange(budget: BudgetItem[]) {
    if (!event) return false;
    const previous = event;
    setEvent({ ...event, budget });
    return attempt(() => updateEventBudget(id, budget), () => setEvent(previous));
  }

  // `budget` is passed when an item was added to the budget at the same time as the needed list.
  async function handleNeededItemsChange(neededItems: NeededItem[], budget?: BudgetItem[]) {
    if (!event) return false;
    const previous = event;
    setEvent({ ...event, neededItems, ...(budget ? { budget } : {}) });
    return attempt(
      async () => {
        if (budget) await updateEventBudget(id, budget);
        await updateEventNeededItems(id, neededItems);
      },
      () => setEvent(previous)
    );
  }

  async function handleSaveDetails(values: EventDetailsValues) {
    if (!event) return false;
    return attempt(async () => {
      await updateEventDetails(id, values);
      setEvent({
        ...event,
        title: values.title.trim(),
        date: values.date,
        theme: values.theme.trim(),
        time: values.time,
        venue: values.venue.trim(),
        expectedAttendance: values.expectedAttendance.trim(),
      });
    });
  }

  async function refreshExpenses() {
    setExpenses(await listEventExpenses(id));
  }

  const handleAddExpense = (data: ExpenseInput) =>
    attempt(async () => {
      await addEventExpense(id, { ...data, recordedBy: user?.uid ?? "" });
      await refreshExpenses();
    });

  const handleUpdateExpense = (expenseId: string, data: ExpenseInput) =>
    attempt(async () => {
      await updateEventExpense(id, expenseId, data);
      await refreshExpenses();
    });

  const handleDeleteExpense = (expenseId: string) =>
    attempt(async () => {
      await deleteEventExpense(id, expenseId);
      await refreshExpenses();
    });

  if (loading)
    return (
      <Page size="xl">
        <PageHeader title="" backHref="/events" backLabel="Events" description="" actions={<></>} />
        <Loading />
      </Page>
    );
  if (!event)
    return (
      <Page size="xl">
        <PageHeader title="" backHref="/events" backLabel="Events" description="" actions={<></>} />
        <Notice tone="error">{pageError ?? "Event not found."}</Notice>
      </Page>
    );

  const hasHappened = event.date <= todayISO();
  const tasksDone = event.tasks.filter((t) => t.status === "done").length;

  return (
    <Page size="xl">
      <PageHeader
        title=""
        backHref="/events"
        backLabel="Events"
        description=""
        actions={
          <>
            {event.programmeId && (
              <Link href="/planner" className="btn-ghost">
                From yearly planner
              </Link>
            )}
          </>
        }
      />
      <EventHero event={event} hasHappened={hasHappened} canEdit={canEditEvent} onEdit={() => setEditingDetails(true)} />

      {pageError && (
        <Notice tone="error" className="mb-4">
          {pageError}
        </Notice>
      )}

      <div className="space-y-6">
        <BudgetSummary
          money={money}
          hasContribution={!!contribution}
          itemsCovered={itemsResult.coveredCount}
          itemsTotal={itemsResult.checks.length}
        />

        <div className="grid items-start gap-6 xl:grid-cols-5">
          {/* Money and items: the wide column */}
          <div className="space-y-6 xl:col-span-3">
            <BudgetLines
              budget={event.budget ?? []}
              breakdown={breakdown}
              total={budgetTotal(event.budget)}
              canEdit={canEditEvent}
              canRecord={canRecordSpending}
              onChange={handleBudgetChange}
              onRecordPurchase={(line, child) =>
                setPurchasePrefill({
                  description: child.name,
                  amount: child.price,
                  budgetItemId: line.id,
                  budgetSubItemId: child.id,
                })
              }
            />

            <EventExpenses
              expenses={expenses}
              budget={event.budget ?? []}
              total={breakdown.totalSpent}
              canEdit={canRecordSpending}
              onAdd={handleAddExpense}
              onUpdate={handleUpdateExpense}
              onDelete={handleDeleteExpense}
              prefill={purchasePrefill}
              onPrefillHandled={() => setPurchasePrefill(null)}
            />

            <NeededItemsCard
              items={event.neededItems ?? []}
              budget={event.budget ?? []}
              result={itemsResult}
              hasContribution={!!contribution}
              canEdit={canEditEvent}
              onChange={handleNeededItemsChange}
            />

            <EventContributionPanel
              contribution={contribution}
              stats={contributionStats}
              canStart={canStartContribution}
              onStart={() => setShowStartContribution(true)}
            />
          </div>

          {/* Planning: the side column */}
          <div className="space-y-6 xl:col-span-2">
            <Card
              title="Agenda"
              description={event.agenda.length > 0 ? `${event.agenda.length} ${event.agenda.length === 1 ? "item" : "items"}` : undefined}
            >
              <AgendaEditor agenda={event.agenda} excos={excos} canEdit={canEditEvent} onChange={handleAgendaChange} />
            </Card>

            <Card title="Tasks" description={event.tasks.length > 0 ? `${tasksDone} of ${event.tasks.length} done` : undefined}>
              <TaskAssignment
                tasks={event.tasks}
                excos={excos}
                youths={youths}
                canEdit={canEditEvent}
                onChange={handleTasksChange}
              />
            </Card>

            <Card
              title="Proposal and letters"
              description="Signed documents you can download as a PDF and send: a proposal (no budget), sponsorship requests (with the budget and what is needed), and a letter asking the place you are visiting to accept."
            >
              <EventDocuments
                event={event}
                documents={documents}
                excos={excos}
                createdBy={user?.uid ?? ""}
                canEdit={canEditEvent}
              />
            </Card>

            <Card
              title="Planning notes"
              description="Thoughts, suggestions and things to consider while this is still being planned."
            >
              <EditableSection
                title="Planning notes"
                value={event.planningNotes ?? ""}
                canEdit={canEditEvent}
                placeholder="Jot down ideas, open questions, things to sort out…"
                onSave={async (value) => {
                  await updateEventPlanningNotes(id, value);
                  setEvent((current) => (current ? { ...current, planningNotes: value } : current));
                }}
              />
            </Card>
          </div>
        </div>

        {hasHappened ? (
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <Card title="After-event report">
              <EditableSection
                title="After-event report"
                value={event.afterEventReport ?? ""}
                canEdit={canEditEvent}
                placeholder="How did it go? What happened, and what to note for next time…"
                onSave={async (value) => {
                  await updateEventAfterEventReport(id, value);
                  setEvent((current) => (current ? { ...current, afterEventReport: value } : current));
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
          </div>
        ) : (
          <Notice tone="info">
            The after-event report and attendance checklist will appear here once {formatDate(event.date)} arrives.
          </Notice>
        )}
      </div>

      {editingDetails && (
        <EditEventModal event={event} onSave={handleSaveDetails} onClose={() => setEditingDetails(false)} />
      )}

      {showStartContribution && (
        <StartEventContribution
          eventId={id}
          eventTitle={event.title}
          excos={excos}
          createdBy={user?.uid ?? ""}
          onCreated={(contributionId) => {
            setEvent((current) => (current ? { ...current, contributionId } : current));
            setShowStartContribution(false);
            loadContribution(contributionId);
          }}
          onCancel={() => setShowStartContribution(false)}
        />
      )}
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
