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
import type { Contribution, Pledge, Payment, PaymentMethod, ExternalSupport } from "@/types";

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
 */
export async function addExternalSupport(
  contributionId: string,
  data: { name: string; amount: number; method: PaymentMethod; date: string; recordedBy: string }
): Promise<string> {
  const ref = await addDoc(collection(db, `contributions/${contributionId}/externalSupport`), data);
  return ref.id;
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
  /** Youths with a pledge above ₦0. */
  pledgerCount: number;
  fullyRedeemedCount: number;
  partlyRedeemedCount: number;
  unpaidCount: number;
  /** Youths who gave without ever pledging. */
  unpledgedGiverCount: number;
  /** totalReceived as a share of totalPledged; null when nothing is pledged. */
  percentReceived: number | null;
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

  for (const p of pledges) {
    totalPledged += p.pledgedAmount;
    youthReceived += p.redeemedAmount;

    if (p.pledgedAmount > 0) {
      pledgerCount += 1;
      outstanding += Math.max(0, p.pledgedAmount - p.redeemedAmount);
      if (p.redeemedAmount >= p.pledgedAmount) fullyRedeemedCount += 1;
      else if (p.redeemedAmount > 0) partlyRedeemedCount += 1;
      else unpaidCount += 1;
    } else if (p.redeemedAmount > 0) {
      unpledgedGiverCount += 1;
    }
  }

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
