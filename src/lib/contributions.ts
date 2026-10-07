import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteField,
  getDoc,
  getDocs,
  query,
  orderBy,
  runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";
import { todayISO } from "./format";
import { getPledgeStatus } from "./contributionStatus";
import type {
  Contribution,
  Pledge,
  PledgedItem,
  Payment,
  PaymentMethod,
  ExternalSupport,
  ExternalSupportItem,
} from "@/types";

export async function listContributions(): Promise<Contribution[]> {
  const q = query(collection(db, "contributions"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Contribution, "id">) }));
}

export async function getContribution(id: string): Promise<Contribution | null> {
  const snap = await getDoc(doc(db, "contributions", id));
  return snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Contribution, "id">) } : null;
}

export async function createContribution(data: {
  title: string;
  inChargeOf: string;
  notes?: string;
  startDate?: string; // defaults to today
  endDate?: string; // optional
  createdBy: string;
}): Promise<string> {
  // Firestore rejects `undefined` field values, so only include what's set.
  const payload: Record<string, unknown> = {
    title: data.title.trim(),
    inChargeOf: data.inChargeOf,
    createdBy: data.createdBy,
    startDate: data.startDate || todayISO(),
    createdAt: new Date().toISOString(),
  };
  if (data.notes?.trim()) payload.notes = data.notes.trim();
  if (data.endDate) payload.endDate = data.endDate;

  const ref = await addDoc(collection(db, "contributions"), payload);
  return ref.id;
}

export type ContributionUpdate = {
  title?: string;
  inChargeOf?: string;
  notes?: string;
  startDate?: string;
  /** Pass `null` to clear the end date (re-opens the drive). */
  endDate?: string | null;
};

export async function updateContribution(id: string, data: ContributionUpdate): Promise<void> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    payload[key] = value === null ? deleteField() : value;
  }
  await updateDoc(doc(db, "contributions", id), payload);
}

export async function getPledges(contributionId: string): Promise<Pledge[]> {
  const snap = await getDocs(collection(db, `contributions/${contributionId}/pledges`));
  return snap.docs.map((d) => d.data() as Pledge);
}

export function newItemId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Creates a youth's pledge: money, items, or both. Use a pledgedAmount of
 * 0 for an items-only pledge. Nothing has been received yet.
 */
export async function createPledge(
  contributionId: string,
  youthId: string,
  pledgedAmount: number,
  items: { name: string; quantity: number }[] = []
): Promise<void> {
  const pledge: Pledge = {
    youthId,
    pledgedAmount,
    redeemedAmount: 0,
    payments: [],
    items: items.map((i) => ({ id: newItemId(), name: i.name.trim(), quantity: i.quantity, received: 0 })),
  };
  await setDoc(doc(db, `contributions/${contributionId}/pledges/${youthId}`), pledge);
}

/**
 * Replaces the items on an existing pledge (adding, removing, changing a
 * quantity, or recording how many have been received are all just edits to
 * this list). Allowed at any time — including after a contribution has ended.
 */
export async function setPledgeItems(
  contributionId: string,
  youthId: string,
  items: PledgedItem[]
): Promise<void> {
  await updateDoc(doc(db, `contributions/${contributionId}/pledges/${youthId}`), { items });
}

/**
 * Sets (or creates) how much a youth has pledged. Doesn't touch what they've redeemed.
 * Allowed at any time — including after a contribution has ended.
 */
export async function setPledgeAmount(
  contributionId: string,
  youthId: string,
  pledgedAmount: number
): Promise<void> {
  const ref = doc(db, `contributions/${contributionId}/pledges/${youthId}`);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, { pledgedAmount });
  } else {
    const pledge: Pledge = { youthId, pledgedAmount, redeemedAmount: 0, payments: [] };
    await setDoc(ref, pledge);
  }
}

/**
 * Records a payment toward a youth's pledge — always tops up (like dues), never overwrites.
 * Allowed at any time — including after a contribution has ended.
 */
export async function recordRedemption(params: {
  contributionId: string;
  youthId: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  recordedBy: string;
}): Promise<void> {
  const { contributionId, youthId, amount, method, date, recordedBy } = params;
  const ref = doc(db, `contributions/${contributionId}/pledges/${youthId}`);
  const payment: Payment = { amount, method, date, recordedBy };

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) {
      const existing = snap.data() as Pledge;
      tx.update(ref, {
        redeemedAmount: existing.redeemedAmount + amount,
        payments: [...existing.payments, payment],
      });
    } else {
      const pledge: Pledge = {
        youthId,
        pledgedAmount: 0, // redeeming without a prior pledge is allowed (e.g. spontaneous giving)
        redeemedAmount: amount,
        payments: [payment],
      };
      tx.set(ref, pledge);
    }
  });
}

export async function listExternalSupport(contributionId: string): Promise<ExternalSupport[]> {
  const q = query(collection(db, `contributions/${contributionId}/externalSupport`), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExternalSupport, "id">) }));
}

/**
 * Records support from someone outside the youth roster — a parent, a
 * pastor, etc. Unlike a youth's redemption this is never tied to a
 * pledge (there's nothing to top up), so it's just a flat add each time.
 * Support can be money, items, or both: an items-only gift has an
 * amount of 0.
 */
export async function addExternalSupport(
  contributionId: string,
  data: {
    name: string;
    amount: number;
    method: PaymentMethod;
    date: string;
    items?: { name: string; quantity: number; unit?: string }[];
    recordedBy: string;
  }
): Promise<string> {
  const { items, ...rest } = data;
  // Firestore rejects `undefined`, so a missing unit or an empty list is left out entirely.
  const payload: Record<string, unknown> = { ...rest };
  if (items && items.length > 0) {
    payload.items = items.map(
      (i): ExternalSupportItem => ({
        id: newItemId(),
        name: i.name.trim(),
        quantity: i.quantity,
        ...(i.unit?.trim() ? { unit: i.unit.trim() } : {}),
      })
    );
  }
  const ref = await addDoc(collection(db, `contributions/${contributionId}/externalSupport`), payload);
  return ref.id;
}

/** One kind of item across everyone's pledges, e.g. all the chairs. */
export interface ItemTotal {
  name: string;
  pledged: number;
  received: number;
}

/** One kind of item given by external supporters, e.g. all the rice, added up. */
export interface ExternalItemTotal {
  name: string;
  unit?: string;
  received: number;
}

export interface ContributionStats {
  /** Sum of every youth's pledge. External supporters never pledge. */
  totalPledged: number;
  /** Everything that's come in: youth payments + external support. */
  totalReceived: number;
  youthReceived: number;
  externalReceived: number;
  /** Pledged money not yet paid in — only counts what's still owed per youth. */
  outstanding: number;
  /** Youths who pledged something: money, items, or both. */
  pledgerCount: number;
  /** Of those, how many have given everything they pledged. */
  fullyRedeemedCount: number;
  partlyRedeemedCount: number;
  unpaidCount: number;
  /** Youths who gave without ever pledging. */
  unpledgedGiverCount: number;
  /** totalReceived as a share of totalPledged; null when nothing is pledged. */
  percentReceived: number | null;
  /**
   * Pledged items rolled up by name (case-insensitive). Quantities are only
   * ever added within the same item, never across different items.
   */
  itemTotals: ItemTotal[];
  /**
   * Items given by external supporters, rolled up by name and unit. Kept
   * apart from itemTotals because nobody pledges these — there's no
   * "pledged" figure to compare against.
   */
  externalItemTotals: ExternalItemTotal[];
}

export function computeStats(pledges: Pledge[], externalSupport: ExternalSupport[] = []): ContributionStats {
  let totalPledged = 0;
  let youthReceived = 0;
  let outstanding = 0;
  let pledgerCount = 0;
  let fullyRedeemedCount = 0;
  let partlyRedeemedCount = 0;
  let unpaidCount = 0;
  let unpledgedGiverCount = 0;

  const itemMap = new Map<string, ItemTotal>();

  for (const p of pledges) {
    totalPledged += p.pledgedAmount;
    youthReceived += p.redeemedAmount;
    if (p.pledgedAmount > 0) outstanding += Math.max(0, p.pledgedAmount - p.redeemedAmount);

    // Money and items are judged together, so someone who pledged only
    // items counts as a pledger too.
    switch (getPledgeStatus(p)) {
      case "redeemed":
        pledgerCount += 1;
        fullyRedeemedCount += 1;
        break;
      case "partial":
        pledgerCount += 1;
        partlyRedeemedCount += 1;
        break;
      case "unpaid":
        pledgerCount += 1;
        unpaidCount += 1;
        break;
      case "unpledged":
        unpledgedGiverCount += 1;
        break;
    }

    for (const item of p.items ?? []) {
      const key = item.name.trim().toLowerCase();
      const total = itemMap.get(key) ?? { name: item.name.trim(), pledged: 0, received: 0 };
      total.pledged += item.quantity;
      total.received += item.received;
      itemMap.set(key, total);
    }
  }
  const itemTotals = [...itemMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  // Same item and same unit add together ("2 bags" + "1 bag" of rice); a
  // different unit stays on its own line rather than being guessed at.
  const externalItemMap = new Map<string, ExternalItemTotal>();
  for (const support of externalSupport) {
    for (const item of support.items ?? []) {
      const unit = item.unit?.trim() || undefined;
      const key = `${item.name.trim().toLowerCase()}|${(unit ?? "").toLowerCase()}`;
      const total = externalItemMap.get(key) ?? { name: item.name.trim(), unit, received: 0 };
      total.received += item.quantity;
      externalItemMap.set(key, total);
    }
  }
  const externalItemTotals = [...externalItemMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  const externalReceived = externalSupport.reduce((sum, s) => sum + s.amount, 0);
  const totalReceived = youthReceived + externalReceived;

  return {
    totalPledged,
    totalReceived,
    youthReceived,
    externalReceived,
    outstanding,
    pledgerCount,
    fullyRedeemedCount,
    partlyRedeemedCount,
    unpaidCount,
    unpledgedGiverCount,
    percentReceived: totalPledged > 0 ? Math.round((totalReceived / totalPledged) * 100) : null,
    itemTotals,
    externalItemTotals,
  };
}

/**
 * Total pledged only ever counts youth pledges — external supporters
 * don't pledge, they just give. Total received counts both.
 */
export function computeTotals(pledges: Pledge[], externalSupport: ExternalSupport[] = []) {
  const { totalPledged, totalReceived } = computeStats(pledges, externalSupport);
  return { totalPledged, totalReceived };
}

export type ContributionWithStats = Contribution & { stats: ContributionStats };

/** One extra read per drive (pledges + external support) — fine at youth-department scale. */
export async function loadStatsFor(contribution: Contribution): Promise<ContributionWithStats> {
  const [pledges, externalSupport] = await Promise.all([
    getPledges(contribution.id),
    listExternalSupport(contribution.id),
  ]);
  return { ...contribution, stats: computeStats(pledges, externalSupport) };
}

export async function listContributionsWithStats(): Promise<ContributionWithStats[]> {
  const contributions = await listContributions();
  return Promise.all(contributions.map(loadStatsFor));
}
