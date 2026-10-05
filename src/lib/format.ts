/** Shared display helpers — money and dates. */

export function naira(n: number): string {
  return `₦${n.toLocaleString()}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Today's date as "yyyy-MM-dd" in the user's LOCAL timezone.
 * (`new Date().toISOString().slice(0, 10)` is the UTC date, which is
 * "yesterday" for the first hour after midnight in Nigeria.)
 */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses "yyyy-MM-dd" as a local date (no timezone shifting). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** "5 Oct 2026" */
export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return parseISODate(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Whole days from one ISO date to another (negative if `toISO` is earlier). */
export function daysBetween(fromISO: string, toISO: string): number {
  const ms = parseISODate(toISO).getTime() - parseISODate(fromISO).getTime();
  return Math.round(ms / 86_400_000);
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
