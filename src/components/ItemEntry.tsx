"use client";

import { useState } from "react";

interface Props {
  onAdd: (name: string, quantity: number, unit?: string) => void | Promise<void>;
  disabled?: boolean;
  buttonLabel?: string;
  /**
   * Adds a free-text unit box ("bags", "packs", "baskets") and allows
   * half quantities (0.5), for things that aren't counted in whole
   * pieces — e.g. half a bag of rice. Off by default, which keeps pledged
   * items as plain whole-number counts.
   */
  withUnit?: boolean;
}

/** A one-line "item name + how many" entry used wherever items are pledged or given. */
export default function ItemEntry({ onAdd, disabled, buttonLabel = "Add item", withUnit = false }: Props) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function add() {
    const qty = Number(quantity);
    if (!name.trim()) return setError("Enter the item.");
    if (withUnit) {
      // Whole numbers or halves: 0.5, 1, 1.5, 2 …
      if (!(qty > 0) || !Number.isInteger(qty * 2)) return setError("Enter how many, in whole numbers or halves (0.5, 1, 1.5…).");
    } else if (!Number.isInteger(qty) || qty < 1) {
      return setError("Enter how many, as a whole number.");
    }
    setError(null);
    await onAdd(name.trim(), qty, withUnit ? unit.trim() || undefined : undefined);
    setName("");
    setQuantity("1");
    setUnit("");
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder={withUnit ? "Item, e.g. Rice" : "Item, e.g. Plastic chairs"}
          aria-label="Item name"
          className="input min-w-[10rem] flex-1"
        />
        <input
          type="number"
          min={withUnit ? 0.5 : 1}
          step={withUnit ? 0.5 : 1}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          aria-label="How many"
          className="input w-20"
        />
        {withUnit && (
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
            placeholder="Unit, e.g. bags"
            aria-label="Unit"
            className="input w-32"
          />
        )}
        <button type="button" onClick={add} disabled={disabled} className="btn-secondary">
          {buttonLabel}
        </button>
      </div>
      {error && <p className="mt-1.5 text-sm text-rccg-red-600">{error}</p>}
    </div>
  );
}
