"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { Field, Notice } from "@/components/ui";
import type { ChurchEvent } from "@/types";

export interface EventDetailsValues {
  title: string;
  date: string;
  theme: string;
  time: string;
  venue: string;
  expectedAttendance: string;
}

/** Edits the event's title, date, time, theme, venue and expected attendance. */
export default function EditEventModal({
  event,
  onSave,
  onClose,
}: {
  event: ChurchEvent;
  onSave: (values: EventDetailsValues) => Promise<boolean>; // true when it saved
  onClose: () => void;
}) {
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(event.date);
  const [time, setTime] = useState(event.time ?? "");
  const [theme, setTheme] = useState(event.theme ?? "");
  const [venue, setVenue] = useState(event.venue ?? "");
  const [attendance, setAttendance] = useState(event.expectedAttendance ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("The event needs a title.");
    if (!date) return setError("Pick the date.");
    setSaving(true);
    setError(null);
    const ok = await onSave({ title, date, theme, time, venue, expectedAttendance: attendance });
    setSaving(false);
    if (ok) onClose();
    else setError("That didn't save. Check your connection and try again.");
  }

  return (
    <Modal
      open
      size="lg"
      title="Edit event"
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" form="edit-event-form" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="edit-event-form" onSubmit={submit} className="space-y-4">
        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          </Field>
          <Field label="Time (optional)">
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input" />
          </Field>
        </div>
        <Field label="Theme (optional)" hint="Leave blank if it hasn't been decided yet.">
          <input value={theme} onChange={(e) => setTheme(e.target.value)} className="input" />
        </Field>
        <Field label="Venue (optional)">
          <input value={venue} onChange={(e) => setVenue(e.target.value)} className="input" />
        </Field>
        <Field label="Expected attendance (optional)">
          <input
            value={attendance}
            onChange={(e) => setAttendance(e.target.value)}
            placeholder="e.g. About 60 youths and 40 children"
            className="input"
          />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
      </form>
    </Modal>
  );
}
