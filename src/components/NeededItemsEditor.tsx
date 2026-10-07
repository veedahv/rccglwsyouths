"use client";

import { useState } from "react";
import { newId } from "@/lib/eventDocuments";
import type { NeededItem } from "@/types";

interface Props {
  items: NeededItem[];
  canEdit: boolean;
  onChange: (items: NeededItem[]) => void; // caller persists (updateEventNeededItems)
}

/**
 * An event's list of things it needs: clothes, rice, chairs. Each line has
 * a quantity in plain words and a note, which is where to say what has
 * been gotten so far. Edits save when you leave a field.
 */
export default function NeededItemsEditor({ items, canEdit, onChange }: Props) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Edits are held here while typing and saved on blur, so every keystroke isn't a write.
  const [draft, setDraft] = useState<Record<string, Partial<NeededItem>>>({});

  function add() {
    if (!name.trim()) return setError("Enter the item.");
    if (!quantity.trim()) return setError("Say how much or how many, e.g. “3 packs”.");
    setError(null);
    onChange([
      ...items,
      { id: newId(), name: name.trim(), quantity: quantity.trim(), ...(note.trim() ? { note: note.trim() } : {}) },
    ]);
    setName("");
    setQuantity("");
    setNote("");
  }

  function field(item: NeededItem, key: "name" | "quantity" | "note") {
    return {
      value: (draft[item.id]?.[key] ?? item[key] ?? "") as string,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setDraft((d) => ({ ...d, [item.id]: { ...d[item.id], [key]: e.target.value } })),
      onBlur: () => {
        const edited = draft[item.id];
        if (!edited) return;
        const next = { ...item, ...edited };
        setDraft((d) => {
          const { [item.id]: _removed, ...rest } = d;
          void _removed;
          return rest;
        });
        if (!next.name.trim() || !next.quantity.trim()) return; // never save a blank item or quantity
        const { note: n, ...base } = next;
        onChange(items.map((i) => (i.id === item.id ? { ...base, name: base.name.trim(), quantity: base.quantity.trim(), ...(n?.trim() ? { note: n.trim() } : {}) } : i)));
      },
      disabled: !canEdit,
    };
  }

  return (
    <div>
      {items.length === 0 ? (
        <p className="mb-4 text-sm text-muted">
          {canEdit
            ? "Nothing listed yet. Add what the event needs people to bring or give."
            : "Nothing listed yet."}
        </p>
      ) : (
        <div className="mb-4 overflow-x-auto rounded-lg border border-line">
          <table className="tbl">
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Note</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <input {...field(item, "name")} aria-label="Item" className="input min-w-[9rem]" />
                  </td>
                  <td>
                    <input {...field(item, "quantity")} aria-label="Quantity" className="input min-w-[9rem]" />
                  </td>
                  <td>
                    <input
                      {...field(item, "note")}
                      aria-label="Note"
                      placeholder={canEdit ? "e.g. 2 bags received" : ""}
                      className="input min-w-[11rem]"
                    />
                  </td>
                  {canEdit && (
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => onChange(items.filter((i) => i.id !== item.id))}
                        className="btn-ghost-danger"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && (
        <div>
          <div className="flex flex-wrap items-end gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
              placeholder="Item, e.g. Rice"
              aria-label="New item"
              className="input min-w-[9rem] flex-1"
            />
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
              placeholder="e.g. A big or half bag"
              aria-label="New item quantity"
              className="input min-w-[9rem] flex-1"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
              placeholder="Note (optional)"
              aria-label="New item note"
              className="input min-w-[9rem] flex-1"
            />
            <button type="button" onClick={add} className="btn-secondary">
              Add item
            </button>
          </div>
          {error && <p className="mt-1.5 text-sm text-rccg-red-600">{error}</p>}
          <p className="hint">
            Write the quantity the way you would say it: “A basket”, “3 packs”, “Half a pack”. Use the note to
            record what has been gotten so far.
          </p>
        </div>
      )}
    </div>
  );
}
