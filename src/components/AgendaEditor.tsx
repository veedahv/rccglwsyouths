"use client";

import { useState } from "react";
import { formatPersonName } from "@/lib/formatName";
import Modal, { ConfirmDialog } from "@/components/Modal";
import { Field, Notice } from "@/components/ui";
import type { AgendaItem, ExcoMember } from "@/types";

interface Props {
  agenda: AgendaItem[];
  excos: ExcoMember[];
  canEdit: boolean;
  onChange: (agenda: AgendaItem[]) => void; // caller persists (updateEventAgenda)
}

/**
 * The event's running order. Reads as a clean list (time on the left);
 * adding and editing happen in a dialog.
 */
export default function AgendaEditor({ agenda, excos, canEdit, onChange }: Props) {
  // The index of the item being edited, or "new". Agenda items have no ids.
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  function ownerName(id?: string) {
    const exco = excos.find((m) => m.id === id);
    return exco ? formatPersonName(exco.name, exco.gender) : undefined;
  }

  function save(item: AgendaItem) {
    if (editing === "new") onChange([...agenda, item]);
    else if (editing !== null) onChange(agenda.map((a, i) => (i === editing ? item : a)));
    setEditing(null);
  }

  function remove() {
    if (deleting === null) return;
    onChange(agenda.filter((_, i) => i !== deleting));
    setDeleting(null);
  }

  return (
    <div>
      {agenda.length === 0 ? (
        <p className="mb-3 text-sm text-muted">No agenda items yet.</p>
      ) : (
        <ol className="mb-3 divide-y divide-line/70 text-sm">
          {agenda.map((a, i) => (
            <li key={i} className="flex items-start gap-3 py-2.5 first:pt-0">
              <span className="w-16 shrink-0 pt-0.5 text-xs font-semibold text-rccg-purple-600">{a.time || "—"}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{a.item}</p>
                {a.owner && <p className="text-xs text-muted">{ownerName(a.owner) ?? "Unknown"}</p>}
              </div>
              {canEdit && (
                <button type="button" onClick={() => setEditing(i)} className="btn-ghost shrink-0" aria-label={`Edit ${a.item}`}>
                  Edit
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      {canEdit && (
        <button type="button" onClick={() => setEditing("new")} className="btn-secondary btn-sm w-full border-dashed">
          + Add agenda item
        </button>
      )}

      {editing !== null && (
        <AgendaModal
          key={editing}
          initial={editing === "new" ? null : agenda[editing]}
          excos={excos}
          onSave={save}
          onClose={() => setEditing(null)}
          onRemove={() => {
            if (editing !== "new") setDeleting(editing);
            setEditing(null);
          }}
        />
      )}

      {deleting !== null && agenda[deleting] && (
        <ConfirmDialog
          open
          title="Remove this agenda item?"
          subject={{ name: agenda[deleting].item, detail: agenda[deleting].time }}
          tone="danger"
          confirmLabel="Remove"
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function AgendaModal({
  initial,
  excos,
  onSave,
  onClose,
  onRemove,
}: {
  initial: AgendaItem | null;
  excos: ExcoMember[];
  onSave: (item: AgendaItem) => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  const [item, setItem] = useState(initial?.item ?? "");
  const [time, setTime] = useState(initial?.time ?? "");
  const [owner, setOwner] = useState(initial?.owner ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!item.trim()) return setError("Enter the agenda item.");
    // Firestore rejects `undefined`, so time and owner are only included when set.
    onSave({ item: item.trim(), ...(time.trim() ? { time: time.trim() } : {}), ...(owner ? { owner } : {}) });
  }

  return (
    <Modal
      open
      title={initial ? "Edit agenda item" : "Add agenda item"}
      onClose={onClose}
      footer={
        <>
          {initial && (
            <button type="button" onClick={onRemove} className="btn-ghost-danger mr-auto">
              Remove
            </button>
          )}
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" form="agenda-form" className="btn-primary">
            {initial ? "Save changes" : "Add item"}
          </button>
        </>
      }
    >
      <form id="agenda-form" onSubmit={submit} className="space-y-4">
        <Field label="Agenda item">
          <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Welcome and opening prayer" className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Time (optional)">
            <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="e.g. 2:00 PM" className="input" />
          </Field>
          <Field label="Owner (optional)">
            <select value={owner} onChange={(e) => setOwner(e.target.value)} className="input">
              <option value="">No owner</option>
              {excos.map((m) => (
                <option key={m.id} value={m.id}>
                  {formatPersonName(m.name, m.gender)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
      </form>
    </Modal>
  );
}
