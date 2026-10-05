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
import type { ChurchEvent, AgendaItem, EventTask } from "@/types";

export async function listEvents(): Promise<ChurchEvent[]> {
  const q = query(collection(db, "events"), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChurchEvent, "id">) }));
}

export async function getEvent(id: string): Promise<ChurchEvent | null> {
  const snap = await getDoc(doc(db, "events", id));
  return snap.exists() ? { id: snap.id, ...(snap.data() as Omit<ChurchEvent, "id">) } : null;
}

export async function createEvent(data: {
  title: string;
  date: string;
  createdBy: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, "events"), {
    ...data,
    agenda: [],
    tasks: [],
    planningNotes: "",
    afterEventReport: "",
    createdAt: new Date().toISOString(),
  });
  return ref.id;
}

/** Editing the title/date after creation — the original brief didn't allow this. */
export async function updateEventDetails(
  id: string,
  data: { title: string; date: string }
): Promise<void> {
  await updateDoc(doc(db, "events", id), data);
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
