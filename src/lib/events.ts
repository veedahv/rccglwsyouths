import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import type { ChurchEvent, AgendaItem, EventTask, BudgetItem } from "@/types";

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
  data: { title: string; date: string; theme: string }
): Promise<void> {
  await updateDoc(doc(db, "events", id), { ...data, theme: data.theme.trim() });
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
