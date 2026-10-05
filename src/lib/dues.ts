import {
  doc,
  getDoc,
  runTransaction,
  collectionGroup,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type { DuesRecord, Payment, PaymentMethod } from "@/types";

export interface MonthEntry {
  yearMonth: string; // "2026-04"
  amount: number;
}

/**
 * Checks which of the requested months already have a dues record for
 * this member, so the UI can warn the secretary before submitting.
 * Returns a map of yearMonth -> existing DuesRecord (only for months
 * that already exist).
 */
export async function getExistingDues(
  youthId: string,
  months: string[]
): Promise<Record<string, DuesRecord>> {
  const existing: Record<string, DuesRecord> = {};

  await Promise.all(
    months.map(async (yearMonth) => {
      const ref = doc(db, `youths/${youthId}/dues/${yearMonth}`);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        existing[yearMonth] = snap.data() as DuesRecord;
      }
    })
  );

  return existing;
}

/**
 * Records a dues payment covering one or more months for a single member.
 *
 * Rule: dues are added per person, one member at a time. If a selected
 * month already has a dues record, this is treated as a top-up for that
 * month (merge: the new payment is appended and totalPaid incremented).
 * The caller (UI) is responsible for confirming with the secretary first
 * when getExistingDues() shows a month is already paid — this function
 * always merges rather than overwrites, so it's safe either way.
 */
export async function recordDuesPayment(params: {
  youthId: string;
  months: MonthEntry[]; // one entry per selected month, with that month's amount
  method: PaymentMethod;
  date: string; // ISO date
  recordedBy: string; // uid of the financial secretary
}) {
  const { youthId, months, method, date, recordedBy } = params;

  // One groupId per call, shared across every month it covers — lets the
  // financial report reassemble a multi-month payment into a single
  // "Monthly dues from X for Jan, Feb and Mar" line instead of three.
  const groupId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  await runTransaction(db, async (tx) => {
    for (const { yearMonth, amount } of months) {
      const ref = doc(db, `youths/${youthId}/dues/${yearMonth}`);
      const snap = await tx.get(ref);

      const newPayment: Payment = { amount, method, date, recordedBy, groupId };

      if (snap.exists()) {
        // Month already has payment(s) recorded — merge (top-up).
        const existing = snap.data() as DuesRecord;
        tx.update(ref, {
          totalPaid: existing.totalPaid + amount,
          payments: [...existing.payments, newPayment],
        });
      } else {
        // First payment recorded for this member/month.
        const record: DuesRecord = {
          yearMonth,
          totalPaid: amount,
          payments: [newPayment],
        };
        tx.set(ref, record);
      }
    }
  });
}

/** Splits a total amount evenly across the given months (naira, whole numbers). */
export function splitEvenly(totalAmount: number, months: string[]): MonthEntry[] {
  const base = Math.floor(totalAmount / months.length);
  const remainder = totalAmount - base * months.length;

  return months.map((yearMonth, i) => ({
    yearMonth,
    // put the leftover naira (from rounding) on the first month
    amount: i === 0 ? base + remainder : base,
  }));
}

/**
 * "Jan 2026" for one month, "Jan 2026, Feb 2026 and Mar 2026" for
 * several — used to build the "...for Jan, Feb and Mar" part of a
 * dues report line.
 */
export function formatMonthList(months: string[]): string {
  const sorted = [...months].sort();
  const names = sorted.map((m) => {
    const [y, mo] = m.split("-").map(Number);
    return new Date(y, mo - 1, 1).toLocaleString("default", { month: "short", year: "numeric" });
  });
  if (names.length === 1) return names[0];
  const last = names.pop();
  return `${names.join(", ")} and ${last}`;
}

/** Current month in "yyyy-MM" form, used as the default selected month. */
export function currentYearMonth(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

/**
 * Pulls every dues record for a given year, across all youths, in one
 * collectionGroup query — for the Monthly Dues grid (names × months).
 * Keyed by youthId, then by month ("01".."12") -> amount paid.
 */
export async function getDuesGridForYear(year: number): Promise<Record<string, Record<string, number>>> {
  const q = query(
    collectionGroup(db, "dues"),
    where("yearMonth", ">=", `${year}-01`),
    where("yearMonth", "<=", `${year}-12`)
  );
  const snap = await getDocs(q);

  const grid: Record<string, Record<string, number>> = {};
  for (const docSnap of snap.docs) {
    const youthId = docSnap.ref.parent.parent?.id;
    if (!youthId) continue;
    const data = docSnap.data() as DuesRecord;
    const month = data.yearMonth.slice(5, 7); // "01".."12"
    (grid[youthId] ??= {})[month] = data.totalPaid;
  }
  return grid;
}
