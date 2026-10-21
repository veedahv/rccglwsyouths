"use client";

import { useEffect, useState } from "react";
import { formatDate, naira, todayISO } from "@/lib/format";
import type { ExpenseInput } from "@/lib/eventExpenses";
import Modal, { ConfirmDialog } from "@/components/Modal";
import { Badge, Card, EmptyState, Field, Notice } from "@/components/ui";
import type { BudgetItem, EventExpense, PaymentMethod } from "@/types";

/** Values to start a new record with, e.g. when recording a purchase for a sub-item. */
export interface ExpensePrefill {
  description: string;
  amount: number;
  budgetItemId: string;
  budgetSubItemId: string;
}

const SAVE_ERROR = "That didn't save. Check your connection and try again.";

interface Props {
  expenses: EventExpense[];
  budget: BudgetItem[];
  total: number;
  canEdit: boolean;
  onAdd: (data: ExpenseInput) => Promise<boolean>; // true when it saved
  onUpdate: (id: string, data: ExpenseInput) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  /** When set, opens the record dialog with these values filled in. */
  prefill: ExpensePrefill | null;
  onPrefillHandled: () => void;
}

/**
 * Money actually spent on the event. Each entry can be tied to a budget
 * line, so the budget table can show what is left on it. Recording and
 * editing happen in a dialog.
 */
export default function EventExpenses({ expenses, budget, total, canEdit, onAdd, onUpdate, onDelete, prefill, onPrefillHandled }: Props) {
  const [editing, setEditing] = useState<EventExpense | "new" | null>(null);
  const [activePrefill, setActivePrefill] = useState<ExpensePrefill | null>(null);
  const [deleting, setDeleting] = useState<EventExpense | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lineName = (id?: string) => budget.find((b) => b.id === id)?.item;
  const childName = (lineId?: string, childId?: string) =>
    budget.find((b) => b.id === lineId)?.children?.find((c) => c.id === childId)?.name;

  function open(target: EventExpense | "new") {
    setError(null);
    setActivePrefill(null);
    setEditing(target);
  }

  // A purchase started from a sub-item pill opens the dialog already filled in.
  useEffect(() => {
    if (!prefill) return;
    setError(null);
    setActivePrefill(prefill);
    setEditing("new");
    onPrefillHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  async function save(data: ExpenseInput) {
    if (editing === null) return;
    setSaving(true);
    setError(null);
    const ok = editing === "new" ? await onAdd(data) : await onUpdate(editing.id, data);
    setSaving(false);
    if (ok) setEditing(null);
    else setError(SAVE_ERROR);
  }

  async function remove() {
    if (!deleting) return;
    setSaving(true);
    setError(null);
    const ok = await onDelete(deleting.id);
    setSaving(false);
    if (ok) setDeleting(null);
    else setError(SAVE_ERROR);
  }

  return (
    <Card
      title="Spending"
      description="Money spent on the event so far."
      action={
        canEdit ? (
          <button type="button" onClick={() => open("new")} className="btn-primary btn-sm">
            Record spending
          </button>
        ) : undefined
      }
    >
      {expenses.length === 0 ? (
        <EmptyState
          title="Nothing spent yet"
          description={canEdit ? "Record each purchase or payment so you can see what is left." : undefined}
          action={
            canEdit ? (
              <button type="button" onClick={() => open("new")} className="btn-secondary btn-sm">
                Record the first one
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>What</th>
                <th>Budget item</th>
                <th className="text-right">Amount</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => {
                const line = lineName(e.budgetItemId);
                const part = childName(e.budgetItemId, e.budgetSubItemId);
                const detail = [e.method === "cash" ? "Cash" : e.method === "transfer" ? "Transfer" : null, e.note]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap">{formatDate(e.date)}</td>
                    <td>
                      <p className="font-medium">{e.description}</p>
                      {detail && <p className="text-xs text-muted">{detail}</p>}
                    </td>
                    <td>
                      {line ? (
                        <>
                          {line}
                          {part && <span className="text-muted"> › {part}</span>}
                        </>
                      ) : (
                        <Badge tone="amber">Not on the budget</Badge>
                      )}
                    </td>
                    <td className="num text-right">{naira(e.amount)}</td>
                    {canEdit && (
                      <td className="text-right">
                        <button type="button" onClick={() => open(e)} className="btn-ghost" aria-label={`Edit ${e.description}`}>
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Total spent</td>
                <td className="num text-right">{naira(total)}</td>
                {canEdit && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {editing !== null && (
        <ExpenseModal
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
          prefill={editing === "new" ? activePrefill : null}
          budget={budget}
          saving={saving}
          error={error}
          onSave={save}
          onClose={() => setEditing(null)}
          onRemove={() => {
            if (editing !== "new") setDeleting(editing);
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          open
          title="Delete this record?"
          subject={{ name: deleting.description, detail: `${naira(deleting.amount)} · ${formatDate(deleting.date)}` }}
          tone="danger"
          confirmLabel="Delete"
          busyLabel="Deleting…"
          busy={saving}
          error={error}
          description="It will no longer count as spent. This can't be undone."
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      )}
    </Card>
  );
}

function ExpenseModal({
  initial,
  prefill,
  budget,
  saving,
  error,
  onSave,
  onClose,
  onRemove,
}: {
  initial: EventExpense | null;
  prefill: ExpensePrefill | null;
  budget: BudgetItem[];
  saving: boolean;
  error: string | null;
  onSave: (data: ExpenseInput) => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  const [description, setDescription] = useState(initial?.description ?? prefill?.description ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : prefill ? String(prefill.amount) : "");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  // A line that was removed from the budget since is treated as "not on the budget".
  const startLine = initial?.budgetItemId ?? prefill?.budgetItemId;
  const [budgetItemId, setBudgetItemId] = useState(startLine && budget.some((b) => b.id === startLine) ? startLine : "");
  const [budgetSubItemId, setBudgetSubItemId] = useState(initial?.budgetSubItemId ?? prefill?.budgetSubItemId ?? "");
  const subItems = budget.find((b) => b.id === budgetItemId)?.children ?? [];
  const [method, setMethod] = useState<PaymentMethod | "">(initial?.method ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!description.trim()) return setFormError("Enter what the money was spent on.");
    if (amount.trim() === "" || Number.isNaN(value) || value <= 0) return setFormError("Enter an amount above ₦0.");
    if (!date) return setFormError("Pick the date.");
    setFormError(null);
    onSave({
      description: description.trim(),
      amount: value,
      date,
      ...(budgetItemId ? { budgetItemId } : {}),
      ...(budgetItemId && subItems.some((c) => c.id === budgetSubItemId) ? { budgetSubItemId } : {}),
      ...(method ? { method } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  }

  return (
    <Modal
      open
      title={initial ? "Edit spending" : "Record spending"}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          {initial && (
            <button type="button" onClick={onRemove} disabled={saving} className="btn-ghost-danger mr-auto">
              Delete
            </button>
          )}
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" form="expense-form" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : initial ? "Save changes" : "Record"}
          </button>
        </>
      }
    >
      <form id="expense-form" onSubmit={submit} className="space-y-4">
        <Field label="What was it for">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. 2 bags of rice"
            className="input"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₦)">
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="input"
            />
          </Field>
          <Field label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          </Field>
        </div>
        <Field label="Budget item" hint="Pick the budget item this belongs to, to see what is left on it.">
          <select
            value={budgetItemId}
            onChange={(e) => {
              setBudgetItemId(e.target.value);
              setBudgetSubItemId("");
            }}
            className="input"
          >
            <option value="">Not on the budget</option>
            {budget.map((b) => (
              <option key={b.id} value={b.id}>
                {b.item}
              </option>
            ))}
          </select>
        </Field>
        {subItems.length > 0 && (
          <Field label="Which part (optional)" hint="Logs that sub-item off as bought.">
            <select value={budgetSubItemId} onChange={(e) => setBudgetSubItemId(e.target.value)} className="input">
              <option value="">The item in general</option>
              {subItems.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Paid by (optional)">
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod | "")} className="input">
              <option value="">Not stated</option>
              <option value="cash">Cash</option>
              <option value="transfer">Transfer</option>
            </select>
          </Field>
          <Field label="Note (optional)">
            <input value={note} onChange={(e) => setNote(e.target.value)} className="input" />
          </Field>
        </div>
        {(formError || error) && <Notice tone="error">{formError ?? error}</Notice>}
      </form>
    </Modal>
  );
}
