"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { Notice } from "@/components/ui";

interface Props {
  value: string;
  canEdit: boolean;
  placeholder: string; // shown in the textarea, and as the empty-state message in view mode
  onSave: (value: string) => Promise<void>;
  /** Heading of the edit dialog, e.g. "Planning notes". */
  title?: string;
}

/** A block of free text that reads cleanly and is edited in a dialog. */
export default function EditableSection({ value, canEdit, placeholder, onSave, title = "Edit" }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setDraft(value);
    setError(null);
    setEditing(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setEditing(false);
    } catch {
      setError("That didn't save. Check your connection and try again.");
    }
    setSaving(false);
  }

  return (
    <div>
      {value?.trim() ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{value}</p>
      ) : (
        <p className="text-sm text-muted">{canEdit ? placeholder : "Nothing here yet."}</p>
      )}
      {canEdit && (
        <button type="button" onClick={startEditing} className="btn-secondary btn-sm mt-3">
          {value?.trim() ? "Edit" : "Add"}
        </button>
      )}

      {editing && (
        <Modal
          open
          size="lg"
          title={title}
          onClose={() => setEditing(false)}
          busy={saving}
          footer={
            <>
              <button type="button" onClick={() => setEditing(false)} disabled={saving} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" form="editable-section-form" disabled={saving} className="btn-primary">
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          }
        >
          <form id="editable-section-form" onSubmit={handleSave} className="space-y-4">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={10}
              placeholder={placeholder}
              aria-label={title}
              className="input"
            />
            {error && <Notice tone="error">{error}</Notice>}
          </form>
        </Modal>
      )}
    </div>
  );
}
