import type { BudgetItem, BudgetSubItem, EventExpense, NeededItem } from "@/types";
import type { ContributionStats, ReceivedItemLine } from "./contributions";
import { budgetTotal } from "./events";

/* ---------------------------------------------------------------------------
 * Everything here is derived: nothing is stored beyond what the event, its
 * expenses and its contribution already hold, so the numbers can't drift.
 *
 * Budget and Items needed are two lists that can overlap (the rice for the
 * jollof is both something we may buy and something people may donate). A
 * needed item can be linked to its budget twin, and the link works both ways:
 *   - needed item covered by donations / ticked  → the budget twin counts as donated
 *   - purchase recorded against the budget twin   → the needed item counts as covered
 * ------------------------------------------------------------------------ */

const keyOf = (name: string) => name.trim().toLowerCase();

export function sumExpenses(expenses: EventExpense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

/* ---- Pointing at a place in the budget --------------------------------- */

/** Identifies a budget target: a sub-item, or a budget item that has no sub-items. */
export function targetKey(budgetItemId: string, budgetSubItemId?: string): string {
  return budgetSubItemId ? `${budgetItemId}/${budgetSubItemId}` : budgetItemId;
}

/** "Jollof rice › Rice", or "Chairs"; null when the target no longer exists. */
export function targetLabel(budget: BudgetItem[], budgetItemId?: string, budgetSubItemId?: string): string | null {
  const line = budget.find((b) => b.id === budgetItemId);
  if (!line) return null;
  return line.item;
}

function spentOnTarget(expenses: EventExpense[], budgetItemId: string, budgetSubItemId?: string): number {
  return sumExpenses(
    expenses.filter((e) => (budgetSubItemId ? e.budgetSubItemId === budgetSubItemId : e.budgetItemId === budgetItemId))
  );
}

/* ---- Items needed: do we have enough? ---------------------------------- */

export type ItemStatus = "enough" | "partial" | "none";

export interface ItemCheck {
  item: NeededItem;
  /** The number needed, or null when no number was given. */
  target: number | null;
  /** Came in through the contribution drive (matched to the item by name). */
  contributed: number;
  /** Got outside the drive: bought, or handed over directly. */
  gotten: number;
  total: number;
  /** How many more are needed; null when there is no number to compare against. */
  short: number | null;
  /** Covered by what came in (or ticked as enough), whether or not it was bought. */
  coveredAlone: boolean;
  /** A purchase is recorded against its linked budget item. */
  bought: boolean;
  status: ItemStatus;
}

export interface ItemsCheckResult {
  checks: ItemCheck[];
  /** Items that came in through the drive but aren't on the needed list. */
  otherContributed: ReceivedItemLine[];
  coveredCount: number;
}

/**
 * Compares the event's needed items with what has come in. An item counts as
 * enough when someone ticked it as enough, when it has a number and what was
 * got reaches it, or when a purchase is recorded for its linked budget item.
 * Items are matched to the drive's contributions by name (ignoring capitals);
 * quantities are added as they are, with no unit conversion.
 */
export function checkNeededItems(
  items: NeededItem[] | undefined,
  received: ReceivedItemLine[] = [],
  expenses: EventExpense[] = []
): ItemsCheckResult {
  const list = items ?? [];
  const receivedByName = new Map<string, number>();
  for (const line of received) {
    receivedByName.set(keyOf(line.name), (receivedByName.get(keyOf(line.name)) ?? 0) + line.quantity);
  }

  // If the same name is listed twice, only the first line is credited with
  // what the drive brought in, so it is never counted twice.
  const credited = new Set<string>();
  const checks = list.map((item): ItemCheck => {
    const key = keyOf(item.name);
    const contributed = credited.has(key) ? 0 : receivedByName.get(key) ?? 0;
    credited.add(key);
    const target = item.target && item.target > 0 ? item.target : null;
    const gotten = item.gotten ?? 0;
    const total = contributed + gotten;

    const coveredAlone = !!item.enough || (target !== null && total >= target);
    const bought = item.budgetItemId ? spentOnTarget(expenses, item.budgetItemId, item.budgetSubItemId) > 0 : false;

    let status: ItemStatus;
    if (coveredAlone || bought) status = "enough";
    else if (total > 0) status = "partial";
    else status = "none";

    return {
      item,
      target,
      contributed,
      gotten,
      total,
      short: target !== null ? Math.max(0, target - total) : null,
      coveredAlone,
      bought,
      status,
    };
  });

  const listed = new Set(list.map((i) => keyOf(i.name)));
  const otherMap = new Map<string, ReceivedItemLine>();
  for (const line of received) {
    if (listed.has(keyOf(line.name))) continue;
    const k = `${keyOf(line.name)}|${(line.unit ?? "").toLowerCase()}`;
    const existing = otherMap.get(k);
    if (existing) existing.quantity += line.quantity;
    else otherMap.set(k, { ...line });
  }

  return {
    checks,
    otherContributed: [...otherMap.values()],
    coveredCount: checks.filter((c) => c.status === "enough").length,
  };
}

/* ---- Links: which needed items point at which budget target ------------ */

export interface LinkedItem {
  name: string;
  /** Covered by donations or ticked as enough (not merely because it was bought). */
  covered: boolean;
}

export type LinkMap = Map<string, LinkedItem[]>;

export function linkMap(checks: ItemCheck[]): LinkMap {
  const map: LinkMap = new Map();
  for (const c of checks) {
    if (!c.item.budgetItemId) continue;
    const key = targetKey(c.item.budgetItemId, c.item.budgetSubItemId);
    const entry: LinkedItem = { name: c.item.name, covered: c.coveredAlone };
    map.set(key, [...(map.get(key) ?? []), entry]);
  }
  return map;
}

/* ---- Budget lines: what was spent against each ------------------------- */

/** How a part of the budget was dealt with: nothing yet, bought (a purchase is recorded), or donated. */
export type SubItemStatus = "pending" | "bought" | "donated";

export interface SubItemState {
  child: BudgetSubItem;
  status: SubItemStatus;
  /** Spent on this sub-item through recorded purchases. */
  spent: number;
  /** Set when it counts as donated because a linked needed item is covered. */
  viaItem?: string;
  /** Needed items linked to it. */
  linked: LinkedItem[];
}

/** The same, for a budget item that has no sub-items and is linked to a needed item. */
export interface OwnState {
  status: SubItemStatus;
  spent: number;
  viaItem?: string;
  linked: LinkedItem[];
}

export interface BudgetLineSpend {
  line: BudgetItem;
  spent: number;
  children: SubItemState[];
  /** Only for an item with no sub-items that a needed item is linked to. */
  own: OwnState | null;
}

export interface SpendingBreakdown {
  lines: BudgetLineSpend[];
  /** Spending with no budget line, or against a line that has since been removed. */
  unbudgeted: number;
  totalSpent: number;
}

/**
 * Order of precedence: a recorded purchase wins (money did go out), then a
 * donation flag set by hand, then a linked needed item that is covered.
 */
export function subItemState(
  child: BudgetSubItem,
  lineId: string,
  expenses: EventExpense[],
  links: LinkMap = new Map()
): SubItemState {
  const spent = sumExpenses(expenses.filter((e) => e.budgetSubItemId === child.id));
  const linked = links.get(targetKey(lineId, child.id)) ?? [];
  const covering = linked.find((l) => l.covered);
  const status: SubItemStatus = spent > 0 ? "bought" : child.donated || covering ? "donated" : "pending";
  return { child, status, spent, viaItem: status === "donated" && !child.donated ? covering?.name : undefined, linked };
}

function ownState(line: BudgetItem, expenses: EventExpense[], links: LinkMap): OwnState | null {
  const linked = links.get(targetKey(line.id)) ?? [];
  if (linked.length === 0) return null;
  const spent = sumExpenses(expenses.filter((e) => e.budgetItemId === line.id));
  const covering = linked.find((l) => l.covered);
  const status: SubItemStatus = spent > 0 ? "bought" : covering ? "donated" : "pending";
  return { status, spent, viaItem: status === "donated" ? covering?.name : undefined, linked };
}

/** The item's price from its sub-items (their total), or its own price when it has none. */
export function lineTotal(line: BudgetItem): number {
  return line.children && line.children.length > 0
    ? line.children.reduce((sum, c) => sum + c.price, 0)
    : line.price;
}

export function spendingBreakdown(
  budget: BudgetItem[] | undefined,
  expenses: EventExpense[],
  links: LinkMap = new Map()
): SpendingBreakdown {
  const list = budget ?? [];
  const ids = new Set(list.map((b) => b.id));
  const lines = list.map((line): BudgetLineSpend => {
    const children = (line.children ?? []).map((c) => subItemState(c, line.id, expenses, links));
    return {
      line,
      spent: sumExpenses(expenses.filter((e) => e.budgetItemId === line.id)),
      children,
      own: children.length === 0 ? ownState(line, expenses, links) : null,
    };
  });
  const unbudgeted = sumExpenses(expenses.filter((e) => !e.budgetItemId || !ids.has(e.budgetItemId)));
  return { lines, unbudgeted, totalSpent: sumExpenses(expenses) };
}

/* ---- The headline numbers ---------------------------------------------- */

export interface EventMoney {
  budget: number;
  contributed: number; // cash received through the contribution drive
  pledged: number;
  spent: number;
  /** Contributed minus spent. Negative means more has been spent than came in. */
  balance: number;
  /** Budget minus spent. Negative means over budget. */
  budgetLeft: number;
  /** The cost of parts of the budget that were donated, so did not have to be bought. */
  donated: number;
}

export function eventMoney(
  budget: BudgetItem[] | undefined,
  expenses: EventExpense[],
  stats: ContributionStats | null,
  links: LinkMap = new Map()
): EventMoney {
  const total = budgetTotal(budget);
  const spent = sumExpenses(expenses);
  const contributed = stats?.totalReceived ?? 0;
  const donated = spendingBreakdown(budget, expenses, links).lines.reduce(
    (sum, l) =>
      sum +
      l.children.filter((c) => c.status === "donated").reduce((s, c) => s + c.child.price, 0) +
      (l.own?.status === "donated" ? l.line.price : 0),
    0
  );
  return {
    budget: total,
    contributed,
    pledged: stats?.totalPledged ?? 0,
    spent,
    balance: contributed - spent,
    budgetLeft: total - spent,
    donated,
  };
}
