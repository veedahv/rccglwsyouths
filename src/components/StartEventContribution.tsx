"use client";

import { useState } from "react";
import { createContribution } from "@/lib/contributions";
import { linkEventContribution } from "@/lib/events";
import { formatPersonName } from "@/lib/formatName";
import { todayISO } from "@/lib/format";
import Modal from "@/components/Modal";
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

/** Starts the contribution drive for an event, in a dialog. */
export default function StartEventContribution({ eventId, eventTitle, excos, createdBy, onCreated, onCancel }: Props) {
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
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title="Start a contribution"
      onClose={onCancel}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={saving} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" form="start-contribution-form" disabled={saving} className="btn-primary">
            {saving ? "Starting…" : "Start contribution"}
          </button>
        </>
      }
    >
      <form id="start-contribution-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted">
          The contribution will be titled <span className="font-semibold text-ink">“{eventTitle}”</span>, the same as the event.
        </p>

        <Field label="Description (optional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="What's this contribution for? Any context to share."
            className="input"
          />
        </Field>

        <Field label="Who's in charge of collecting?">
          <select value={inChargeOf} onChange={(e) => setInChargeOf(e.target.value)} className="input">
            <option value="">Select an exco…</option>
            {excos.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {formatPersonName(ex.name, ex.gender)}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
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
          The end date only marks the contribution as ended. Pledges and payments can still be recorded after it.
        </p>

        {error && <Notice tone="error">{error}</Notice>}
      </form>
    </Modal>
  );
}
