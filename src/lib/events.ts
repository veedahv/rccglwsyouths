import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { ChurchEvent, AgendaItem, EventTask, BudgetItem, NeededItem, EventScreen } from "@/types";

export async function listEvents(): Promise<ChurchEvent[]> {
  const q = query(collection(db, "events"), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChurchEvent, "id">) }));
}

export async function getEvent(id: string): Promise<ChurchEvent | null> {
  const snap = await getDoc(doc(db, "events", id));
  return snap.exists() ? { id: snap.id, ...(snap.data() as Omit<ChurchEvent, "id">) } : null;
}

export interface NewEventInput {
  title: string;
  date: string;
  theme?: string; // optional: often not decided yet when planning starts
  createdBy: string;
  planningNotes?: string;
  budget?: BudgetItem[];
  programmeId?: string; // set when created from the yearly planner
}

/** The stored shape of a brand-new event — shared by createEvent and the planner's "create event". */
export function newEventData(data: NewEventInput) {
  const { theme, planningNotes, budget, programmeId, ...rest } = data;
  return {
    ...rest,
    // Firestore rejects `undefined`, so only store a theme/link if there is one.
    ...(theme?.trim() ? { theme: theme.trim() } : {}),
    ...(programmeId ? { programmeId } : {}),
    budget: budget ?? [],
    agenda: [],
    tasks: [],
    planningNotes: planningNotes ?? "",
    afterEventReport: "",
    createdAt: new Date().toISOString(),
  };
}

export async function createEvent(data: NewEventInput): Promise<string> {
  const ref = await addDoc(collection(db, "events"), newEventData(data));
  return ref.id;
}

/**
 * Editing the title/date/theme after creation — the original brief didn't
 * allow this. The theme can be added later, changed, or cleared (an empty
 * string means "no theme yet").
 */
export async function updateEventDetails(
  id: string,
  data: {
    title: string;
    date: string;
    theme: string;
    time: string;
    venue: string;
    expectedAttendance: string;
  }
): Promise<void> {
  await updateDoc(doc(db, "events", id), {
    title: data.title.trim(),
    date: data.date,
    theme: data.theme.trim(),
    time: data.time,
    venue: data.venue.trim(),
    expectedAttendance: data.expectedAttendance.trim(),
  });
}

/** The event's list of things it needs people to bring or give. */
export async function updateEventNeededItems(id: string, neededItems: NeededItem[]): Promise<void> {
  await updateDoc(doc(db, "events", id), { neededItems });
}

export async function updateEventBudget(id: string, budget: BudgetItem[]): Promise<void> {
  await updateDoc(doc(db, "events", id), { budget });
}

/** The event's total budget — always derived from the items, never stored. */
export function budgetTotal(budget: BudgetItem[] | undefined): number {
  return (budget ?? []).reduce((sum, b) => sum + b.price, 0);
}

export async function updateEventAgenda(id: string, agenda: AgendaItem[]): Promise<void> {
  await updateDoc(doc(db, "events", id), { agenda });
}

export async function updateEventTasks(id: string, tasks: EventTask[]): Promise<void> {
  await updateDoc(doc(db, "events", id), { tasks });
}

export async function updateEventPlanningNotes(id: string, planningNotes: string): Promise<void> {
  await updateDoc(doc(db, "events", id), { planningNotes });
}

/** Was "minutes" — renamed since "minutes" implies a live meeting record, not a post-event writeup. */
export async function updateEventAfterEventReport(id: string, afterEventReport: string): Promise<void> {
  await updateDoc(doc(db, "events", id), { afterEventReport });
}

/** Links a contribution drive (created elsewhere) back to the event it was started for. */
export async function linkEventContribution(id: string, contributionId: string): Promise<void> {
  await updateDoc(doc(db, "events", id), { contributionId });
}

/** Links a games event (created on /games) to this event, or unlinks it when `gamesEventId` is empty. */
export async function linkEventGames(id: string, gamesEventId: string): Promise<void> {
  await updateDoc(doc(db, "events", id), { gamesEventId });
}

/** One event, kept live. The big-screen page listens with this so it follows whatever the exco picks. */
export function subscribeChurchEvent(
  id: string,
  onChange: (event: ChurchEvent | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "events", id),
    (snap) => onChange(snap.exists() ? { id: snap.id, ...(snap.data() as Omit<ChurchEvent, "id">) } : null),
    (err) => onError?.(err)
  );
}

/** Saves the big-screen settings (what is shown, colours, icons, tagline, agenda item that is on now). */
export async function updateEventScreen(id: string, screen: EventScreen): Promise<void> {
  const clean: Record<string, unknown> = { view: screen.view, palette: screen.palette, icons: screen.icons };
  if (screen.tagline?.trim()) clean.tagline = screen.tagline.trim();
  if (screen.nowIndex !== undefined) clean.nowIndex = screen.nowIndex;
  await updateDoc(doc(db, "events", id), { screen: clean });
}
