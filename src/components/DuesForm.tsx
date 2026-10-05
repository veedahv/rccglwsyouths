"use client";

import { useEffect, useMemo, useState } from "react";
import {
  currentYearMonth,
  getExistingDues,
  recordDuesPayment,
  splitEvenly,
  MonthEntry,
} from "@/lib/dues";
import type { Youth, PaymentMethod, DuesRecord } from "@/types";
import { useAuth } from "@/lib/useAuth"; // your auth hook; returns { user }
import { formatPersonName } from "@/lib/formatName";
import { naira, todayISO } from "@/lib/format";
import { Field, Notice } from "@/components/ui";

// Builds the last 12 months as "yyyy-MM" options, newest first.
function recentMonths(count = 12): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

function formatMonth(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
}

interface Props {
  youths: Youth[]; // pass in from /youths query
  onSaved?: () => void; // called after a successful payment, so a parent page can refresh its data
}

export default function DuesForm({ youths, onSaved }: Props) {
  const { user } = useAuth();
  const [youthId, setYouthId] = useState("");
  const [amount, setAmount] = useState<number>(1000);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [date, setDate] = useState(() => todayISO());

  // Current month is preselected by default, per the platform's rule.
  const [selectedMonths, setSelectedMonths] = useState<string[]>([currentYearMonth()]);
  const [splitMode, setSplitMode] = useState<"equal" | "manual">("equal");
  const [manualAmounts, setManualAmounts] = useState<Record<string, number>>({});

  const [existingDues, setExistingDues] = useState<Record<string, DuesRecord>>({});
  const [confirmMerge, setConfirmMerge] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const monthOptions = useMemo(() => recentMonths(12), []);

  // Whenever the youth or selected months change, check which months
  // are already paid so we can warn before submitting.
  useEffect(() => {
    if (!youthId || selectedMonths.length === 0) {
      setExistingDues({});
      return;
    }
    getExistingDues(youthId, selectedMonths).then(setExistingDues);
  }, [youthId, selectedMonths]);

  const monthsAlreadyPaid = selectedMonths.filter((m) => existingDues[m]);

  function toggleMonth(month: string) {
    setConfirmMerge(false);
    setSelectedMonths((prev) =>
      prev.includes(month) ? prev.filter((m) => m !== month) : [...prev, month].sort()
    );
  }

  function computeMonthEntries(): MonthEntry[] {
    if (splitMode === "equal") {
      return splitEvenly(amount, selectedMonths);
    }
    return selectedMonths.map((yearMonth) => ({
      yearMonth,
      amount: manualAmounts[yearMonth] ?? 0,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!youthId) return setError("Select a youth.");
    if (selectedMonths.length === 0) return setError("Select at least one month.");
    if (!user) return setError("Not signed in.");

    // If any selected month is already paid and the secretary hasn't
    // confirmed the top-up yet, block submission and show the warning
    // instead — they either confirm the merge or deselect that month
    // and pick the correct one.
    if (monthsAlreadyPaid.length > 0 && !confirmMerge) {
      return; // the warning banner below handles prompting for confirmation
    }

    const monthEntries = computeMonthEntries();
    const total = monthEntries.reduce((sum, m) => sum + m.amount, 0);
    if (total !== amount && splitMode === "manual") {
      return setError(`Manual amounts (${naira(total)}) don't add up to the amount paid (${naira(amount)}).`);
    }

    setSubmitting(true);
    try {
      await recordDuesPayment({
        youthId,
        months: monthEntries,
        method,
        date,
        recordedBy: user.uid,
      });
      setSuccess(true);
      setSelectedMonths([currentYearMonth()]);
      setAmount(1000);
      setConfirmMerge(false);
      onSaved?.();
    } catch (err) {
      setError("Something went wrong saving this payment. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
      <Field label="Youth">
        <select
          value={youthId}
          onChange={(e) => setYouthId(e.target.value)}
          className="input"
          required
        >
          <option value="">Select a youth…</option>
          {youths.map((m) => (
            <option key={m.id} value={m.id}>
              {formatPersonName(m.name, m.gender)}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Amount paid (₦)">
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="input"
            required
          />
        </Field>
        <Field label="Method">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            className="input"
          >
            <option value="cash">Cash</option>
            <option value="transfer">Transfer</option>
          </select>
        </Field>
        <Field label="Date paid">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </Field>
      </div>

      <div>
        <p className="label">
          Months covered <span className="font-normal text-muted">(current month is selected by default)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {monthOptions.map((month) => {
            const active = selectedMonths.includes(month);
            const paid = !!existingDues[month];
            return (
              <button
                type="button"
                key={month}
                onClick={() => toggleMonth(month)}
                aria-pressed={active}
                className={[
                  "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                  active
                    ? "border-rccg-green-600 bg-rccg-green-600 text-white"
                    : "border-line bg-white text-ink hover:bg-rccg-purple-50",
                  paid && !active ? "!border-amber-400" : "",
                ].join(" ")}
              >
                {formatMonth(month)}
                {paid && <span className="ml-1" title="Already has a payment">•</span>}
              </button>
            );
          })}
        </div>
        <p className="hint">A dot marks a month that already has a payment recorded.</p>
      </div>

      {selectedMonths.length > 1 && (
        <fieldset>
          <legend className="label">Split</legend>
          <div className="flex gap-5 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="split-mode"
                checked={splitMode === "equal"}
                onChange={() => setSplitMode("equal")}
                className="accent-rccg-green-600"
              />
              Equal split
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="split-mode"
                checked={splitMode === "manual"}
                onChange={() => setSplitMode("manual")}
                className="accent-rccg-green-600"
              />
              Manual breakdown
            </label>
          </div>

          {splitMode === "manual" && (
            <div className="mt-3 space-y-2">
              {selectedMonths.map((month) => (
                <div key={month} className="flex items-center gap-3">
                  <span className="w-36 text-sm">{formatMonth(month)}</span>
                  <input
                    type="number"
                    min={0}
                    value={manualAmounts[month] ?? ""}
                    aria-label={`Amount for ${formatMonth(month)}`}
                    onChange={(e) =>
                      setManualAmounts((prev) => ({
                        ...prev,
                        [month]: Number(e.target.value),
                      }))
                    }
                    className="input flex-1"
                  />
                </div>
              ))}
            </div>
          )}
        </fieldset>
      )}

      {/* Merge warning: shown when a selected month already has a dues
          record. The secretary must explicitly confirm this is a
          top-up for that month before the form will submit. */}
      {monthsAlreadyPaid.length > 0 && !confirmMerge && (
        <Notice tone="warning">
          <p className="mb-2">
            {monthsAlreadyPaid.map(formatMonth).join(", ")} already{" "}
            {monthsAlreadyPaid.length === 1 ? "has" : "have"} a payment recorded (
            {naira(monthsAlreadyPaid.reduce((sum, m) => sum + existingDues[m].totalPaid, 0))} so far). If
            this youth is paying extra for {monthsAlreadyPaid.length === 1 ? "that month" : "those months"},
            confirm below to add to it. Otherwise, deselect it and pick the correct month.
          </p>
          <button
            type="button"
            onClick={() => setConfirmMerge(true)}
            className="btn btn-sm bg-amber-500 text-white hover:bg-amber-600"
          >
            Add to existing payment
          </button>
        </Notice>
      )}

      {error && <Notice tone="error">{error}</Notice>}
      {success && <Notice tone="success">Payment recorded.</Notice>}

      <button
        type="submit"
        disabled={submitting || (monthsAlreadyPaid.length > 0 && !confirmMerge)}
        className="btn-primary"
      >
        {submitting ? "Saving…" : "Record payment"}
      </button>
    </form>
  );
}
