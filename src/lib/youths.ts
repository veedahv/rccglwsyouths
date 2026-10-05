import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Youth, InactiveReason } from "@/types";

export interface YouthFilters {
  activeOnly?: boolean;
  unit?: string;
  search?: string; // matched client-side against name
}

export async function listYouths(filters: YouthFilters = {}): Promise<Youth[]> {
  const clauses = [];
  if (filters.activeOnly) clauses.push(where("active", "==", true));
  if (filters.unit) clauses.push(where("unit", "==", filters.unit));

  const q = query(collection(db, "youths"), ...clauses, orderBy("name"));
  const snap = await getDocs(q);
  let youths = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Youth, "id">) }));

  if (filters.search) {
    const term = filters.search.toLowerCase();
    youths = youths.filter((y) => y.name.toLowerCase().includes(term));
  }

  return youths;
}

export async function getYouth(id: string): Promise<Youth | null> {
  const snap = await getDoc(doc(db, "youths", id));
  return snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Youth, "id">) } : null;
}

// No auth account involved — youths are records only, so a plain
// auto-generated ID is fine (unlike excos, whose doc ID must match a
// Firebase Auth uid).
export async function createYouth(
  data: Omit<Youth, "id" | "active" | "joinedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, "youths"), {
    ...data,
    active: true,
    joinedAt: new Date().toISOString().slice(0, 10),
  });
  return ref.id;
}

export async function updateYouth(id: string, data: Partial<Youth>): Promise<void> {
  await updateDoc(doc(db, "youths", id), data);
}

/** Marks a youth inactive (married, left the church, etc.) rather than deleting their record. */
export async function setYouthInactive(id: string, reason: InactiveReason): Promise<void> {
  await updateDoc(doc(db, "youths", id), { active: false, inactiveReason: reason });
}

export async function reactivateYouth(id: string): Promise<void> {
  await updateDoc(doc(db, "youths", id), { active: true, inactiveReason: null });
}
