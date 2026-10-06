"use client";

import { useState } from "react";
import { naira } from "@/lib/format";
import { budgetTotal } from "@/lib/events";
import { Notice } from "@/components/ui";
import type { BudgetItem } from "@/types";

interface Props {
  items: BudgetItem[];
  canEdit: boolean;
  onChange: (items: BudgetItem[]) => void; // caller persists (updateEventBudget)
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * An event's budget: a list of items with a price each, and the total.
 * Items and prices stay editable (budgets change a lot while planning);
 * edits are saved when you leave the field or press Enter.
 */
export default function BudgetEditor({ items, canEdit, onChange }: Props) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  const total = budgetTotal(items);

  function addItem() {
    const amount = Number(price);
    if (!name.trim()) return setError("Enter what the item is.");
    if (price.trim() === "" || Number.isNaN(amount) || amount < 0) {
      return setError("Enter a price of ₦0 or more.");
    }
    setError(null);
    onChange([...items, { id: genId(), item: name.trim(), price: amount }]);
    setName("");
    setPrice("");
  }

  function updateItem(id: string, patch: Partial<BudgetItem>) {
    onChange(items.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function removeItem(id: string) {
    onChange(items.filter((b) => b.id !== id));
  }

  return (
    <div>
      {items.length === 0 ? (
        <p className="mb-4 text-sm text-muted">
          {canEdit ? "No budget items yet. Add what the event will need and what each is expected to cost." : "No budget items yet."}
        </p>
      ) : (
        <div className="mb-4 overflow-x-auto rounded-lg border border-line">
          <table className="tbl">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">Price</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id}>
                  <td className="font-medium">
                    {canEdit ? (
                      <input
                        key={`name-${b.id}-${b.item}`}
                        defaultValue={b.item}
                        aria-label="Budget item"
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                        onBlur={(e) => {
                          const value = e.target.value.trim();
                          if (value && value !== b.item) updateItem(b.id, { item: value });
                          else e.target.value = b.item; // empty or unchanged: put it back
                        }}
                        className="input py-1"
                      />
                    ) : (
                      b.item
                    )}
                  </td>
                  <td className="num text-right">
                    {canEdit ? (
                      <input
                        key={`price-${b.id}-${b.price}`}
                        type="number"
                        min={0}
                        defaultValue={b.price}
                        aria-label={`Price of ${b.item}`}
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                        onBlur={(e) => {
                          const value = Number(e.target.value);
                          if (e.target.value !== "" && !Number.isNaN(value) && value >= 0 && value !== b.price) {
                            updateItem(b.id, { price: value });
                          } else {
                            e.target.value = String(b.price);
                          }
                        }}
                        className="input ml-auto w-32 py-1 text-right"
                      />
                    ) : (
                      naira(b.price)
                    )}
                  </td>
                  {canEdit && (
                    <td className="text-right">
                      <button onClick={() => removeItem(b.id)} className="btn-ghost-danger shrink-0">
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total budget</td>
                <td className="num text-right">{naira(total)}</td>
                {canEdit && <td></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {canEdit && (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              placeholder="Item, e.g. Sound system hire"
              aria-label="Budget item"
              className="input min-w-[10rem] flex-1"
            />
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              placeholder="Price (₦)"
              aria-label="Price (₦)"
              className="input w-36"
            />
            <button onClick={addItem} className="btn-primary">
              Add item
            </button>
          </div>
          {error && (
            <Notice tone="error" className="mt-3">
              {error}
            </Notice>
          )}
        </>
      )}
    </div>
  );
}
