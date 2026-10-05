"use client";

import { useState } from "react";
import { formatPersonName } from "@/lib/formatName";
import type { AgendaItem, ExcoMember } from "@/types";

interface Props {
  agenda: AgendaItem[];
  excos: ExcoMember[];
  canEdit: boolean;
  onChange: (agenda: AgendaItem[]) => void; // caller persists (updateEventAgenda)
}

export default function AgendaEditor({ agenda, excos, canEdit, onChange }: Props) {
  const [item, setItem] = useState("");
  const [time, setTime] = useState("");
  const [owner, setOwner] = useState("");

  function addItem() {
    if (!item.trim()) return;
    onChange([...agenda, { item, time: time || undefined, owner: owner || undefined }]);
    setItem("");
    setTime("");
    setOwner("");
  }

  function removeItem(index: number) {
    onChange(agenda.filter((_, i) => i !== index));
  }

  function ownerName(id?: string) {
    const exco = excos.find((m) => m.id === id);
    return exco ? formatPersonName(exco.name, exco.gender) : undefined;
  }

  return (
    <div>
      {agenda.length === 0 ? (
        <p className="text-sm text-muted">No agenda items yet.</p>
      ) : (
        <ul className="mb-4 divide-y divide-line text-sm">
          {agenda.map((a, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
              <div className="min-w-0">
                <p className="font-medium text-ink">{a.item}</p>
                {(a.time || a.owner) && (
                  <p className="text-xs text-muted">
                    {[a.time, a.owner ? ownerName(a.owner) : undefined].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
              {canEdit && (
                <button onClick={() => removeItem(i)} className="btn-ghost-danger shrink-0">
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-end gap-2">
          <input
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder="Agenda item"
            aria-label="Agenda item"
            className="input min-w-[10rem] flex-1"
          />
          <input
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="Time"
            aria-label="Time (optional)"
            className="input w-28"
          />
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            aria-label="Owner (optional)"
            className="input w-auto"
          >
            <option value="">Owner</option>
            {excos.map((m) => (
              <option key={m.id} value={m.id}>
                {formatPersonName(m.name, m.gender)}
              </option>
            ))}
          </select>
          <button onClick={addItem} className="btn-primary">
            Add item
          </button>
        </div>
      )}
    </div>
  );
}
