import { collectionGroup, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { listTransactions } from "./transactions";
import { listYouths } from "./youths";
import { listOpeningBalances, openingTotal } from "./openingBalances";
import { formatMonthList } from "./dues";
import { formatPersonName } from "./formatName";
import type { DuesRecord, OpeningBalance, Payment, PaymentMethod } from "@/types";

export interface ReportLineItem {
  date: string; // the actual date money moved — not which period it covers
  description: string;
  amount: number;
  method?: PaymentMethod;
  // Extra detail the PDF uses to lay the report out like the manual one:
  kind?: "dues" | "income" | "expense";
  payer?: string; // dues only: who paid
  months?: string[]; // dues only: the "yyyy-MM" months this payment covers
  note?: string; // optional note (shown in the Notes column)
}

export interface MonthlyReport {
  yearMonth: string;
  openingBalance: number;
  totalIncoming: number;
  totalOutgoing: number;
  closingBalance: number;
  incomingBreakdown: ReportLineItem[];
  outgoingBreakdown: ReportLineItem[];
}

export interface YearlyReport {
  year: number;
  openingBalance: number;
  totalDues: number;
  totalIncoming: number;
  totalOutgoing: number;
  closingBalance: number;
  // The opening balance entered for this year (cash/transfer split), if any.
  // When there isn't one the opening balance is just carried forward from
  // earlier recorded activity (or zero).
  openingEntry: OpeningBalance | null;
}

function sumItems(items: ReportLineItem[] | undefined): number {
  return (items ?? []).reduce((sum, item) => sum + item.amount, 0);
}

interface FlowMaps {
  duesLineItemsByMonth: Record<string, ReportLineItem[]>;
  otherIncomeLineItemsByMonth: Record<string, ReportLineItem[]>;
  expenseLineItemsByMonth: Record<string, ReportLineItem[]>;
  allMonths: string[]; // sorted ascending, union of every month with any activity
  openingBalances: OpeningBalance[]; // sorted by year ascending
}

interface FlatDuesPayment {
  youthId: string;
  yearMonth: string; // which month this slice of the payment covers
  groupId?: string;
  date: string; // when it was actually paid
  amount: number;
  method: PaymentMethod;
}

/**
 * Builds the dues portion of the report: flattens every youth's dues
 * payments, regroups the ones that share a groupId back into single
 * real-world payments (someone paying for 3 months at once shouldn't
 * show as 3 disconnected lines), and buckets each into the report month
 * based on when it was actually PAID — not which month(s) it covers.
 * That distinction is the whole point: a payment made in March for
 * Jan–Mar dues belongs in March's incoming money, not split across three
 * different months' reports.
 */
async function buildDuesLineItemsByMonth(): Promise<Record<string, ReportLineItem[]>> {
  const [duesSnap, youths] = await Promise.all([getDocs(collectionGroup(db, "dues")), listYouths()]);
  const youthById = new Map(youths.map((y) => [y.id, y]));

  const flat: FlatDuesPayment[] = [];
  for (const docSnap of duesSnap.docs) {
    const youthId = docSnap.ref.parent.parent?.id;
    if (!youthId) continue;
    const data = docSnap.data() as DuesRecord;
    for (const p of data.payments) {
      flat.push({ youthId, yearMonth: data.yearMonth, groupId: p.groupId, date: p.date, amount: p.amount, method: p.method });
    }
  }

  // Group by groupId; anything without one (shouldn't happen for new
  // payments, but covers old data from before groupId existed) gets a
  // synthetic one-off key so it still shows as its own line.
  const groups = new Map<string, FlatDuesPayment[]>();
  let ungroupedCount = 0;
  for (const fp of flat) {
    const key = fp.groupId ?? `__ungrouped_${ungroupedCount++}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(fp);
  }

  const duesLineItemsByMonth: Record<string, ReportLineItem[]> = {};
  for (const group of groups.values()) {
    const first = group[0];
    const youth = youthById.get(first.youthId);
    const name = youth ? formatPersonName(youth.name, youth.gender) : "Unknown";
    const months = group.map((g) => g.yearMonth);
    const totalAmount = group.reduce((sum, g) => sum + g.amount, 0);

    const item: ReportLineItem = {
      date: first.date,
      description: `Monthly dues from ${name} for ${formatMonthList(months)}`,
      amount: totalAmount,
      method: first.method,
      kind: "dues",
      payer: name,
      months,
    };

    const reportMonth = first.date.slice(0, 7);
    (duesLineItemsByMonth[reportMonth] ??= []).push(item);
  }

  return duesLineItemsByMonth;
}

async function collectFlows(): Promise<FlowMaps> {
  const [duesLineItemsByMonth, transactions, openingBalances] = await Promise.all([
    buildDuesLineItemsByMonth(),
    listTransactions(),
    listOpeningBalances(),
  ]);

  const otherIncomeLineItemsByMonth: Record<string, ReportLineItem[]> = {};
  const expenseLineItemsByMonth: Record<string, ReportLineItem[]> = {};
  for (const t of transactions) {
    const month = t.date.slice(0, 7);
    const item: ReportLineItem = {
      date: t.date,
      description: t.description,
      amount: t.amount,
      method: t.method,
      kind: t.type,
      note: t.note,
    };
    if (t.type === "income") {
      (otherIncomeLineItemsByMonth[month] ??= []).push(item);
    } else {
      (expenseLineItemsByMonth[month] ??= []).push(item);
    }
  }

  const allMonths = Array.from(
    new Set([
      ...Object.keys(duesLineItemsByMonth),
      ...Object.keys(otherIncomeLineItemsByMonth),
      ...Object.keys(expenseLineItemsByMonth),
    ])
  ).sort();

  return { duesLineItemsByMonth, otherIncomeLineItemsByMonth, expenseLineItemsByMonth, allMonths, openingBalances };
}

/** Net (in - out) of every month from `fromMonth` up to, but not including, `beforeMonth`. */
function netBetween(flows: FlowMaps, fromMonth: string, beforeMonth: string): number {
  let net = 0;
  for (const month of flows.allMonths) {
    if (month < fromMonth) continue;
    if (month >= beforeMonth) break;
    net += sumItems(flows.duesLineItemsByMonth[month]) + sumItems(flows.otherIncomeLineItemsByMonth[month]);
    net -= sumItems(flows.expenseLineItemsByMonth[month]);
  }
  return net;
}

/**
 * The balance at the start of `beforeMonth` — the running balance carried
 * forward. If an opening balance has been entered for that year or an
 * earlier one, the latest such entry is the starting point (its year's
 * 1 January balance) and only activity from then on is added; anything
 * recorded before it is ignored, since the opening balance already
 * accounts for it. With no opening balance, it's the net of all recorded
 * activity before the month.
 */
function balanceBefore(flows: FlowMaps, beforeMonth: string): number {
  const year = Number(beforeMonth.slice(0, 4));
  const base = flows.openingBalances.filter((o) => o.year <= year).pop();
  if (!base) return netBetween(flows, "", beforeMonth);
  return openingTotal(base) + netBetween(flows, `${base.year}-01`, beforeMonth);
}

function buildMonthlyReport(flows: FlowMaps, yearMonth: string): MonthlyReport {
  const openingBalance = balanceBefore(flows, yearMonth);

  const duesItems = flows.duesLineItemsByMonth[yearMonth] ?? [];
  const otherItems = flows.otherIncomeLineItemsByMonth[yearMonth] ?? [];
  const incomingBreakdown = [...duesItems, ...otherItems].sort((a, b) => a.date.localeCompare(b.date));
  const outgoingBreakdown = (flows.expenseLineItemsByMonth[yearMonth] ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));

  const totalIncoming = sumItems(duesItems) + sumItems(otherItems);
  const totalOutgoing = sumItems(outgoingBreakdown);

  return {
    yearMonth,
    openingBalance,
    totalIncoming,
    totalOutgoing,
    closingBalance: openingBalance + totalIncoming - totalOutgoing,
    incomingBreakdown,
    outgoingBreakdown,
  };
}

export async function generateMonthlyReport(yearMonth: string): Promise<MonthlyReport> {
  return buildMonthlyReport(await collectFlows(), yearMonth);
}

export interface QuarterlyReport {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  months: MonthlyReport[]; // always three, in order
  openingBalance: number;
  totalIncoming: number;
  totalOutgoing: number;
  closingBalance: number;
}

/** Three monthly reports plus the quarter's totals — one Firestore pass, not three. */
export async function generateQuarterlyReport(year: number, quarter: 1 | 2 | 3 | 4): Promise<QuarterlyReport> {
  const flows = await collectFlows();
  const firstMonth = (quarter - 1) * 3 + 1;
  const months = [0, 1, 2].map((i) =>
    buildMonthlyReport(flows, `${year}-${String(firstMonth + i).padStart(2, "0")}`)
  );
  return {
    year,
    quarter,
    months,
    openingBalance: months[0].openingBalance,
    totalIncoming: months.reduce((sum, m) => sum + m.totalIncoming, 0),
    totalOutgoing: months.reduce((sum, m) => sum + m.totalOutgoing, 0),
    closingBalance: months[2].closingBalance,
  };
}

/** Year-level summary for the financial report page: total dues, incoming, outgoing, and ending balance. */
export async function generateYearlyReport(year: number): Promise<YearlyReport> {
  const flows = await collectFlows();
  const yearPrefix = String(year);
  const monthsInYear = flows.allMonths.filter((m) => m.startsWith(yearPrefix));

  const openingBalance = balanceBefore(flows, `${yearPrefix}-01`);
  const totalDues = monthsInYear.reduce((sum, m) => sum + sumItems(flows.duesLineItemsByMonth[m]), 0);
  const totalOtherIncome = monthsInYear.reduce((sum, m) => sum + sumItems(flows.otherIncomeLineItemsByMonth[m]), 0);
  const totalOutgoing = monthsInYear.reduce((sum, m) => sum + sumItems(flows.expenseLineItemsByMonth[m]), 0);
  const totalIncoming = totalDues + totalOtherIncome;

  return {
    year,
    openingBalance,
    totalDues,
    totalIncoming,
    totalOutgoing,
    closingBalance: openingBalance + totalIncoming - totalOutgoing,
    openingEntry: flows.openingBalances.find((o) => o.year === year) ?? null,
  };
}
