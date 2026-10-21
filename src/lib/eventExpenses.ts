import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import type { EventExpense, PaymentMethod } from "@/types";

/* ---------------------------------------------------------------------------
 * Money spent on an event lives at /events/{eventId}/expenses/{id}. It is
 * tracked with the event and never touches the financial report, the same
 * way contributions are kept separate.
 * ------------------------------------------------------------------------ */

function expensesCol(eventId: string) {
  return collection(db, `events/${eventId}/expenses`);
}

export async function listEventExpenses(eventId: string): Promise<EventExpense[]> {
  const snap = await getDocs(query(expensesCol(eventId), orderBy("date", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EventExpense, "id">) }));
}

export interface ExpenseInput {
  description: string;
  amount: number;
  date: string;
  budgetItemId?: string; // blank/absent = not on the budget
  budgetSubItemId?: string; // a sub-item of that budget item
  method?: PaymentMethod;
  note?: string;
}

export async function addEventExpense(eventId: string, data: ExpenseInput & { recordedBy: string }): Promise<string> {
  const { description, budgetItemId, budgetSubItemId, method, note, ...rest } = data;
  // Firestore rejects `undefined`, so only the fields that are set are stored.
  const ref = await addDoc(expensesCol(eventId), {
    ...rest,
    description: description.trim(),
    ...(budgetItemId ? { budgetItemId } : {}),
    ...(budgetItemId && budgetSubItemId ? { budgetSubItemId } : {}),
    ...(method ? { method } : {}),
    ...(note?.trim() ? { note: note.trim() } : {}),
    createdAt: new Date().toISOString(),
  });
  return ref.id;
}

/** Fixes an existing expense. `recordedBy` and `createdAt` are left as they were. */
export async function updateEventExpense(eventId: string, expenseId: string, data: ExpenseInput): Promise<void> {
  await updateDoc(doc(db, `events/${eventId}/expenses/${expenseId}`), {
    description: data.description.trim(),
    amount: data.amount,
    date: data.date,
    budgetItemId: data.budgetItemId || deleteField(),
    budgetSubItemId: (data.budgetItemId && data.budgetSubItemId) || deleteField(),
    method: data.method || deleteField(),
    note: data.note?.trim() || deleteField(),
  });
}

export async function deleteEventExpense(eventId: string, expenseId: string): Promise<void> {
  await deleteDoc(doc(db, `events/${eventId}/expenses/${expenseId}`));
}
