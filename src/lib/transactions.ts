import { collection, doc, addDoc, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "./firebase";
import type { Transaction } from "@/types";

export async function listTransactions(): Promise<Transaction[]> {
  const q = query(collection(db, "transactions"), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Transaction, "id">) }));
}

export async function createTransaction(data: {
  type: Transaction["type"];
  category: Transaction["category"];
  amount: number;
  description: string;
  note?: string;
  date: string;
  method?: Transaction["method"];
  createdBy: string;
}): Promise<string> {
  const { note, ...rest } = data;
  const ref = await addDoc(collection(db, "transactions"), {
    ...rest,
    ...(note?.trim() ? { note: note.trim() } : {}),
    createdAt: new Date().toISOString(),
  });
  return ref.id;
}
