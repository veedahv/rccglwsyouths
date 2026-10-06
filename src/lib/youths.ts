import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  collectionGroup,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import { listContributions } from "./contributions";
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

/**
 * Why this youth can't safely be deleted, or null if they can. Deleting
 * would leave money records pointing at nobody (dues would show up on the
 * financial report as "Unknown", pledges in a drive's totals), so anyone
 * with payments or pledges has to be marked inactive instead. Excos are
 * managed from the Excos page.
 */
export async function getYouthDeleteBlocker(youth: Pick<Youth, "id" | "linkedExcoId">): Promise<string | null> {
  if (youth.linkedExcoId) {
    return "They're an exco. Remove them from the Excos page first, or mark them inactive.";
  }

  const duesSnap = await getDocs(collection(db, `youths/${youth.id}/dues`));
  if (duesSnap.docs.some((d) => ((d.data() as { payments?: unknown[] }).payments ?? []).length > 0)) {
    return "They have dues payments on record, which the financial report relies on. Mark them inactive instead.";
  }

  const contributions = await listContributions();
  const pledgeSnaps = await Promise.all(contributions.map((c) => getDoc(doc(db, `contributions/${c.id}/pledges/${youth.id}`))));
  if (pledgeSnaps.some((s) => s.exists())) {
    return "They have a pledge in a contribution drive. Mark them inactive instead.";
  }

  return null;
}

/**
 * Permanently deletes a youth and their attendance marks. Callers should
 * check getYouthDeleteBlocker first. Attendance cleanup is best-effort:
 * leftover marks for a deleted youth are harmless (they're matched by
 * youth ID and nothing lists them).
 */
export async function deleteYouth(id: string): Promise<void> {
  await deleteDoc(doc(db, "youths", id));
  try {
    const marks = await getDocs(query(collectionGroup(db, "attendance"), where("youthId", "==", id)));
    await Promise.all(marks.docs.map((m) => deleteDoc(m.ref).catch(() => undefined)));
  } catch {
    // ignore, see above
  }
}
