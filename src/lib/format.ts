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

/** "14:30" → "2:30 PM". Empty/absent → "". */
export function formatTime(time?: string | null): string {
  if (!time) return "";
  if (!/^\d{1,2}:\d{2}$/.test(time.trim())) return time; // older free-text values (e.g. "2pm") are shown as written
  const [h, m] = time.trim().split(":").map(Number);
  const d = new Date(2000, 0, 1, h, m || 0);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** "12 Dec 2026 · 2:30 PM", or just the date when no time is set. */
export function formatDateTime(date: string, time?: string | null): string {
  const t = formatTime(time);
  return t ? `${formatDate(date)} · ${t}` : formatDate(date);
}

/** 3 → "3", 0.5 → "0.5". Item quantities can be halves, so no fixed decimals. */
export function formatQuantity(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * Reads a time someone typed by hand ("2:00 PM", "2pm", "14:30") as "HH:mm" for a time input.
 * Returns "" when it can't be read, so an old free-text agenda time shows as empty when edited.
 */
export function parseLooseTime(text?: string | null): string {
  const m = (text ?? "").trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return "";
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
