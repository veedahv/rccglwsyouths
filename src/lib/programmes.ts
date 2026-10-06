import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { newEventData } from "./events";
import { naira } from "./format";
import type { BudgetItem, Programme, ProgrammeStatus } from "@/types";

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const STATUS_LABEL: Record<ProgrammeStatus, string> = {
  suggested: "Suggested",
  approved: "Approved",
  declined: "Declined",
};

export interface ProgrammeInput {
  title: string;
  idea: string;
  year: number;
  month: number | null; // null = not decided yet
  timeNote: string;
  estimatedBudget: number | null;
}

/** Firestore rejects `undefined`; empty optional text/numbers are simply not stored. */
function cleanInput(input: ProgrammeInput) {
  return {
    title: input.title.trim(),
    year: input.year,
    month: input.month,
    ...(input.idea.trim() ? { idea: input.idea.trim() } : {}),
    ...(input.timeNote.trim() ? { timeNote: input.timeNote.trim() } : {}),
    ...(input.estimatedBudget && input.estimatedBudget > 0 ? { estimatedBudget: input.estimatedBudget } : {}),
  };
}

// Filtered on a single field and sorted in the client, so this needs no
// composite Firestore index.
export async function listProgrammes(year: number): Promise<Programme[]> {
  const snap = await getDocs(query(collection(db, "programmes"), where("year", "==", year)));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Programme, "id">) }))
    .sort((a, b) => (a.month ?? 99) - (b.month ?? 99) || a.createdAt.localeCompare(b.createdAt));
}

export async function createProgramme(
  input: ProgrammeInput,
  author: { uid: string; name: string }
): Promise<void> {
  await addDoc(collection(db, "programmes"), {
    ...cleanInput(input),
    status: "suggested" as ProgrammeStatus,
    createdBy: author.uid,
    createdByName: author.name,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Edits a programme's content. Optional fields are written explicitly
 * (empty string / null) rather than omitted, because updateDoc leaves
 * omitted keys untouched — omitting would make "clear the budget"
 * silently do nothing.
 */
export async function updateProgramme(id: string, input: ProgrammeInput): Promise<void> {
  await updateDoc(doc(db, "programmes", id), {
    title: input.title.trim(),
    year: input.year,
    month: input.month,
    idea: input.idea.trim(),
    timeNote: input.timeNote.trim(),
    estimatedBudget: input.estimatedBudget && input.estimatedBudget > 0 ? input.estimatedBudget : null,
  });
}

/** Approve / decline / put back to "suggested". Records who decided and when. */
export async function setProgrammeStatus(
  id: string,
  status: ProgrammeStatus,
  decidedByName: string
): Promise<void> {
  await updateDoc(doc(db, "programmes", id), {
    status,
    ...(status === "suggested"
      ? { decidedByName: null, decidedAt: null }
      : { decidedByName, decidedAt: new Date().toISOString() }),
  });
}

export async function deleteProgramme(id: string): Promise<void> {
  await deleteDoc(doc(db, "programmes", id));
}

/**
 * Creates a real event from an approved programme and links the two, in
 * one atomic batch — so you can never end up with an event but a
 * programme that still says "no event yet" (and a second click creating
 * a duplicate). The programme's idea becomes the event's planning notes,
 * and its rough budget (if any) becomes a single budget line the team
 * can break down later.
 */
export async function createEventFromProgramme(
  programme: Programme,
  details: { title: string; date: string; theme: string },
  createdBy: string
): Promise<string> {
  const budget: BudgetItem[] = programme.estimatedBudget
    ? [{ id: crypto.randomUUID(), item: "Estimated budget (from yearly planner)", price: programme.estimatedBudget }]
    : [];

  const notes = [
    programme.idea,
    programme.timeNote ? `Planned timeline: ${programme.timeNote}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const eventRef = doc(collection(db, "events"));
  const batch = writeBatch(db);
  batch.set(
    eventRef,
    newEventData({
      title: details.title.trim(),
      date: details.date,
      theme: details.theme,
      createdBy,
      planningNotes: notes,
      budget,
      programmeId: programme.id,
    })
  );
  batch.update(doc(db, "programmes", programme.id), { eventId: eventRef.id });
  await batch.commit();
  return eventRef.id;
}

export function budgetLabel(p: Pick<Programme, "estimatedBudget">): string | null {
  return p.estimatedBudget ? naira(p.estimatedBudget) : null;
}
