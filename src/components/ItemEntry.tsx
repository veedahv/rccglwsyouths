"use client";

import { useState } from "react";

interface Props {
  onAdd: (name: string, quantity: number) => void | Promise<void>;
  disabled?: boolean;
  buttonLabel?: string;
}

/** A one-line "item name + how many" entry used wherever items are pledged. */
export default function ItemEntry({ onAdd, disabled, buttonLabel = "Add item" }: Props) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);

  async function add() {
    const qty = Number(quantity);
    if (!name.trim()) return setError("Enter the item.");
    if (!Number.isInteger(qty) || qty < 1) return setError("Enter how many, as a whole number.");
    setError(null);
    await onAdd(name.trim(), qty);
    setName("");
    setQuantity("1");
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Item, e.g. Plastic chairs"
          aria-label="Item name"
          className="input min-w-[10rem] flex-1"
        />
        <input
          type="number"
          min={1}
          step={1}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          aria-label="How many"
          className="input w-20"
        />
        <button type="button" onClick={add} disabled={disabled} className="btn-secondary">
          {buttonLabel}
        </button>
      </div>
      {error && <p className="mt-1.5 text-sm text-rccg-red-600">{error}</p>}
    </div>
  );
}
