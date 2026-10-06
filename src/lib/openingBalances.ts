import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { OpeningBalance } from "@/types";

/** Every opening balance recorded so far, oldest year first. */
export async function listOpeningBalances(): Promise<OpeningBalance[]> {
  const snap = await getDocs(collection(db, "openingBalances"));
  return snap.docs
    .map((d) => d.data() as OpeningBalance)
    .sort((a, b) => a.year - b.year);
}

/** Total opening balance, cash and transfer together. */
export function openingTotal(entry: Pick<OpeningBalance, "cash" | "transfer">): number {
  return entry.cash + entry.transfer;
}

/** Saves (or replaces) the opening balance for a year. One doc per year, keyed by the year. */
export async function saveOpeningBalance(data: {
  year: number;
  cash: number;
  transfer: number;
  note?: string;
  updatedBy: string;
}): Promise<void> {
  const { note, ...rest } = data;
  await setDoc(doc(db, "openingBalances", String(data.year)), {
    ...rest,
    ...(note?.trim() ? { note: note.trim() } : {}),
    updatedAt: new Date().toISOString(),
  });
}
