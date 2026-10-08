"use client";

import { useState } from "react";
import {
  addExternalSupport,
  deleteExternalSupport,
  newItemId,
  updateExternalSupport,
} from "@/lib/contributions";
import { useAuth } from "@/lib/useAuth";
import { formatDate, naira, todayISO } from "@/lib/format";
import { EmptyState, Field, Notice } from "@/components/ui";
import ItemEntry from "@/components/ItemEntry";
import Modal, { ConfirmDialog } from "@/components/Modal";
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

interface SupportValues {
  name: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  items: ExternalSupportItem[];
}

/**
 * The form for one record of external support, used both to add a new one
 * and to edit an existing one. It validates, then hands the values to
 * onSubmit; saving (and any error from it) is the caller's job.
 */
function SupportForm({
  initial,
  submitLabel,
  saving,
  error: submitError,
  onSubmit,
  onCancel,
}: {
  initial?: ExternalSupport;
  submitLabel: string;
  saving: boolean;
  error: string | null;
  onSubmit: (values: SupportValues) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(initial && initial.amount > 0 ? String(initial.amount) : "");
  const [method, setMethod] = useState<PaymentMethod>(initial?.method ?? "cash");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [items, setItems] = useState<ExternalSupportItem[]>(initial?.items ?? []);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const money = amount.trim() === "" ? 0 : Number(amount);
    if (!name.trim()) return setError("Enter who this is from.");
    if (Number.isNaN(money) || money < 0) return setError("Enter an amount of ₦0 or more.");
    // Money, items, or both — but never nothing.
    if (money === 0 && items.length === 0) return setError("Enter an amount, add at least one item, or both.");
    setError(null);
    await onSubmit({ name: name.trim(), amount: money, method, date, items });
  }

  const shownError = error ?? submitError;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Supporter's name">
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" required />
        </Field>
        <Field label="Date received">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </Field>
        <Field label="Amount (₦)" hint="Leave blank if they only gave items.">
          <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className="input" />
        </Field>
        <Field label="Method" hint="Only used when money was given.">
          <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className="input">
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

      {shownError && <Notice tone="error">{shownError}</Notice>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary btn-sm">
          {saving ? "Saving…" : submitLabel}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="btn-secondary btn-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function ExternalSupportList({
  contributionId,
  externalSupport,
  canEdit,
  onChange,
}: Props) {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ExternalSupport | null>(null);
  const [deleting, setDeleting] = useState<ExternalSupport | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(values: SupportValues) {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      await addExternalSupport(contributionId, {
        name: values.name,
        amount: values.amount,
        method: values.method,
        date: values.date,
        items: values.items.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
        recordedBy: user.uid,
      });
      setShowForm(false);
      onChange();
    } catch {
      setError("Couldn't save this. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(values: SupportValues) {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      await updateExternalSupport(contributionId, editing.id, values);
      setEditing(null);
      onChange();
    } catch {
      setError("Couldn't save your changes. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    setError(null);
    try {
      await deleteExternalSupport(contributionId, deleting.id);
      setDeleting(null);
      onChange();
    } catch {
      setError("Couldn't delete this. Try again.");
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
                {canEdit && <th />}
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
                  {canEdit && (
                    <td className="whitespace-nowrap text-right">
                      <button
                        onClick={() => {
                          setError(null);
                          setEditing(s);
                        }}
                        className="btn-ghost"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setError(null);
                          setDeleting(s);
                        }}
                        className="btn-ghost-danger"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={hasItems ? 4 : 3}>Total money</td>
                <td className="num text-right">{naira(total)}</td>
                {canEdit && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {canEdit && (
        <div className="mt-4">
          {showForm ? (
            <div className="panel">
              <SupportForm
                submitLabel="Add support"
                saving={saving}
                error={error}
                onSubmit={handleAdd}
                onCancel={() => {
                  setError(null);
                  setShowForm(false);
                }}
              />
            </div>
          ) : (
            <button
              onClick={() => {
                setError(null);
                setShowForm(true);
              }}
              className="btn-secondary btn-sm"
            >
              Add external support
            </button>
          )}
        </div>
      )}

      {editing && (
        <Modal open title="Edit external support" onClose={() => !saving && setEditing(null)} busy={saving}>
          <SupportForm
            initial={editing}
            submitLabel="Save changes"
            saving={saving}
            error={error}
            onSubmit={handleEdit}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          open
          title="Delete this record?"
          subject={{
            name: deleting.name,
            detail:
              [
                deleting.amount > 0 ? naira(deleting.amount) : null,
                ...(deleting.items ?? []).map(describeItem),
              ]
                .filter(Boolean)
                .join(" · ") || undefined,
          }}
          tone="danger"
          confirmLabel="Delete"
          busyLabel="Deleting…"
          busy={saving}
          error={error}
          description="It will no longer count toward what has been received. This can't be undone."
          onConfirm={handleDelete}
          onCancel={() => !saving && setDeleting(null)}
        />
      )}
    </div>
  );
}
