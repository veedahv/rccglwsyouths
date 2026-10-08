"use client";

import { useState } from "react";
import { updateYouth } from "@/lib/youths";
import { Card, Field, Notice } from "@/components/ui";
import type { Youth } from "@/types";

interface Props {
  existing: Youth;
  onSaved: () => void;
  onCancel: () => void;
}

export default function YouthForm({ existing, onSaved, onCancel }: Props) {
  const [name, setName] = useState(existing.name);
  const [phone, setPhone] = useState(existing.phone ?? "");
  const [gender, setGender] = useState(existing.gender ?? "");
  const [dob, setDob] = useState(existing.dob ?? "");
  const [unit, setUnit] = useState(existing.unit ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Name is required.");

    setSaving(true);
    setError(null);
    try {
      await updateYouth(existing.id, {
        name,
        phone,
        gender: gender as Youth["gender"],
        dob,
        unit,
      });
      onSaved();
    } catch {
      setError("Couldn't save this youth. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Edit youth">
      <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" required />
        </Field>
        {existing.linkedExcoId && (
          <p className="hint -mt-2">
            This youth is also an exco. Name, phone, gender, birthday and unit are shared with their exco record:
            changing them here changes them there too.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
          </Field>
          <Field label="Gender">
            <select value={gender} onChange={(e) => setGender(e.target.value)} className="input">
              <option value="">Not specified</option>
              <option value="male">Male (Bro)</option>
              <option value="female">Female (Sis)</option>
            </select>
          </Field>
          <Field label="Date of birth">
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="input" />
          </Field>
          <Field label="Unit">
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g. Ushering"
              className="input"
            />
          </Field>
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}
