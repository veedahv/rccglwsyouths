"use client";

import { useState } from "react";
import { addExternalSupport, newItemId } from "@/lib/contributions";
import { useAuth } from "@/lib/useAuth";
import { formatDate, naira, todayISO } from "@/lib/format";
import { EmptyState, Field, Notice } from "@/components/ui";
import ItemEntry from "@/components/ItemEntry";
import type { ExternalSupport, ExternalSupportItem, PaymentMethod } from "@/types";

interface Props {
  contributionId: string;
  externalSupport: ExternalSupport[];
  canEdit: boolean;
  onChange: () => void; // caller refetches after a write
}

/** "2 bags of Rice", "0.5 pack of Spaghetti", "5 Pads" — how a given item reads in a list. */
export function describeItem(item: Pick<ExternalSupportItem, "name" | "quantity" | "unit">): string {
  const qty = Number.isInteger(item.quantity) ? String(item.quantity) : item.quantity.toFixed(1);
  return item.unit ? `${qty} ${item.unit} of ${item.name}` : `${qty} × ${item.name}`;
}

export default function ExternalSupportList({
  contributionId,
  externalSupport,
  canEdit,
  onChange,
}: Props) {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [date, setDate] = useState(() => todayISO());
  const [items, setItems] = useState<ExternalSupportItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setAmount("");
    setItems([]);
    setError(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const money = amount.trim() === "" ? 0 : Number(amount);
    if (!name.trim()) return setError("Enter who this is from.");
    if (Number.isNaN(money) || money < 0) return setError("Enter an amount of ₦0 or more.");
    // Money, items, or both — but never nothing.
    if (money === 0 && items.length === 0) return setError("Enter an amount, add at least one item, or both.");

    setSaving(true);
    setError(null);
    try {
      await addExternalSupport(contributionId, {
        name: name.trim(),
        amount: money,
        method,
        date,
        items: items.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
        recordedBy: user.uid,
      });
      resetForm();
      setShowForm(false);
      onChange();
    } catch {
      setError("Couldn't save this. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const total = externalSupport.reduce((sum, s) => sum + s.amount, 0);
  const hasItems = externalSupport.some((s) => (s.items?.length ?? 0) > 0);

  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        From people outside the youth roster, such as parents or pastors. Can be money, items (clothes,
        foodstuff, anything the drive needs), or both. Counts toward total received, never total pledged.
      </p>

      {externalSupport.length === 0 ? (
        <EmptyState title="No external support recorded yet" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Date</th>
                {hasItems && <th>Items</th>}
                <th>Method</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {externalSupport.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.name}</td>
                  <td className="whitespace-nowrap text-muted">{formatDate(s.date)}</td>
                  {hasItems && (
                    <td className="text-sm">
                      {(s.items?.length ?? 0) === 0 ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {s.items!.map((item) => (
                            <li key={item.id}>{describeItem(item)}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  )}
                  <td className="capitalize text-muted">{s.amount > 0 ? s.method : "—"}</td>
                  <td className="num text-right">{s.amount > 0 ? naira(s.amount) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={hasItems ? 4 : 3}>Total money</td>
                <td className="num text-right">{naira(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {canEdit && (
        <div className="mt-4">
          {showForm ? (
            <form onSubmit={handleAdd} className="panel space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Supporter's name">
                  <input value={name} onChange={(e) => setName(e.target.value)} className="input" required />
                </Field>
                <Field label="Date received">
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
                </Field>
                <Field label="Amount (₦)" hint="Leave blank if they only gave items.">
                  <input
                    type="number"
                    min={0}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="input"
                  />
                </Field>
                <Field label="Method" hint="Only used when money was given.">
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                    className="input"
                  >
                    <option value="cash">Cash</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </Field>
              </div>

              <div>
                <span className="label">Items given (optional)</span>
                {items.length > 0 && (
                  <ul className="mb-2 divide-y divide-line/70 rounded-lg border border-line bg-white text-sm">
                    {items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <span>{describeItem(item)}</span>
                        <button
                          type="button"
                          onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                          className="btn-ghost-danger"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <ItemEntry
                  withUnit
                  buttonLabel="Add to list"
                  onAdd={(itemName, quantity, unit) =>
                    setItems((prev) => [...prev, { id: newItemId(), name: itemName, quantity, unit }])
                  }
                />
                <span className="hint block">
                  e.g. Rice · 0.5 · bag, Maggi · 3 · packs, Onions · 1 · basket, Clothes · 1 · bag.
                </span>
              </div>

              {error && <Notice tone="error">{error}</Notice>}
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="btn-primary btn-sm">
                  {saving ? "Saving…" : "Add support"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowForm(true)} className="btn-secondary btn-sm">
              Add external support
            </button>
          )}
        </div>
      )}
    </div>
  );
}
