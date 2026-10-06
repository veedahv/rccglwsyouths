"use client";

import { useState } from "react";
import { MONTH_NAMES, type ProgrammeInput } from "@/lib/programmes";
import { Field, Notice } from "./ui";
import type { Programme } from "@/types";

interface Props {
  initial?: Programme;
  defaultYear: number;
  years: number[];
  submitLabel: string;
  onSubmit: (input: ProgrammeInput) => Promise<void>;
  onCancel: () => void;
}

// Used both for suggesting a new programme and for editing one. Only the
// title is required — this is the idea phase, so everything else can be
// vague or left blank and filled in as the plan firms up.
export default function ProgrammeForm({ initial, defaultYear, years, submitLabel, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [idea, setIdea] = useState(initial?.idea ?? "");
  const [year, setYear] = useState(initial?.year ?? defaultYear);
  const [month, setMonth] = useState<number | null>(initial?.month ?? null);
  const [timeNote, setTimeNote] = useState(initial?.timeNote ?? "");
  const [budget, setBudget] = useState(initial?.estimatedBudget ? String(initial.estimatedBudget) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        title,
        idea,
        year,
        month,
        timeNote,
        estimatedBudget: budget ? Math.max(0, Number(budget)) || null : null,
      });
    } catch {
      setError("Couldn't save. Check your connection and try again.");
      setSaving(false);
    }
    // On success the parent closes the form, so there's nothing to reset.
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Programme title">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input"
          placeholder="e.g. Youth Retreat"
          required
          autoFocus
        />
      </Field>

      <Field label="The idea" hint="What is it, and why should we do it? A few lines is plenty.">
        <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={4} className="input" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Year">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="input">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Suggested month">
          <select
            value={month ?? ""}
            onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : null)}
            className="input"
          >
            <option value="">Not decided yet</option>
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Timeline (optional)" hint="Anything about timing, e.g. “2 days, late March”.">
          <input value={timeNote} onChange={(e) => setTimeNote(e.target.value)} className="input" />
        </Field>
        <Field label="Rough budget, ₦ (optional)">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="input"
          />
        </Field>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      <div className="flex gap-2">
        <button disabled={saving} className="btn-primary">
          {saving ? "Saving…" : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}
