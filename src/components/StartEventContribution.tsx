"use client";

import { useState } from "react";
import { createContribution } from "@/lib/contributions";
import { linkEventContribution } from "@/lib/events";
import { formatPersonName } from "@/lib/formatName";
import { todayISO } from "@/lib/format";
import { Field, Notice } from "@/components/ui";
import type { ExcoMember } from "@/types";

interface Props {
  eventId: string;
  eventTitle: string; // used as the contribution's title — no separate title field
  excos: ExcoMember[];
  createdBy: string;
  onCreated: (contributionId: string) => void;
  onCancel: () => void;
}

export default function StartEventContribution({
  eventId,
  eventTitle,
  excos,
  createdBy,
  onCreated,
  onCancel,
}: Props) {
  const [inChargeOf, setInChargeOf] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(() => todayISO());
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inChargeOf) return setError("Choose who's in charge of collecting.");
    if (!startDate) return setError("Choose a start date.");
    if (endDate && endDate < startDate) return setError("The end date can't be before the start date.");

    setSaving(true);
    setError(null);
    try {
      const contributionId = await createContribution({
        title: eventTitle,
        inChargeOf,
        notes: description || undefined,
        startDate,
        endDate: endDate || undefined,
        createdBy,
      });
      await linkEventContribution(eventId, contributionId);
      onCreated(contributionId);
    } catch {
      setError("Couldn't start the contribution. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel space-y-4">
      <p className="text-sm text-muted">
        The contribution will be titled <span className="font-semibold text-ink">“{eventTitle}”</span>,
        the same as the event.
      </p>

      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="What's this contribution for? Any context to share."
          className="input"
        />
      </Field>

      <Field label="Who's in charge of collecting?">
        <select
          value={inChargeOf}
          onChange={(e) => setInChargeOf(e.target.value)}
          className="input"
          required
        >
          <option value="">Select an exco…</option>
          {excos.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {formatPersonName(ex.name, ex.gender)}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start date">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input"
            required
          />
        </Field>
        <Field label="End date (optional)">
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className="input"
          />
        </Field>
      </div>
      <p className="hint -mt-2">
        The end date only marks the contribution as ended. Pledges and payments can still be recorded
        after it.
      </p>

      {error && <Notice tone="error">{error}</Notice>}

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary btn-sm">
          {saving ? "Starting…" : "Start contribution"}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary btn-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
