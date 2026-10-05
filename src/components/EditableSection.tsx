"use client";

import { useState } from "react";

interface Props {
  value: string;
  canEdit: boolean;
  placeholder: string; // shown in the textarea, and as the empty-state message in view mode
  onSave: (value: string) => Promise<void>;
}

export default function EditableSection({ value, canEdit, placeholder, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  function startEditing() {
    setDraft(value);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          placeholder={placeholder}
          autoFocus
          className="input"
        />
        <div className="mt-3 flex gap-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary btn-sm">
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)} className="btn-secondary btn-sm">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {value?.trim() ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{value}</p>
      ) : (
        <p className="text-sm text-muted">{canEdit ? placeholder : "Nothing here yet."}</p>
      )}
      {canEdit && (
        <button onClick={startEditing} className="btn-secondary btn-sm mt-3">
          {value?.trim() ? "Edit" : "Add"}
        </button>
      )}
    </div>
  );
}
