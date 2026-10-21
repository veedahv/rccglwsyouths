"use client";

import { useState } from "react";
import { naira } from "@/lib/format";
import { newId } from "@/lib/eventDocuments";
import type { BudgetLineSpend, SpendingBreakdown, SubItemState, SubItemStatus } from "@/lib/eventBudget";
import Modal, { ConfirmDialog } from "@/components/Modal";
import { Card, EmptyState, Field, Notice } from "@/components/ui";
import type { BudgetItem, BudgetSubItem } from "@/types";

const SAVE_ERROR = "That didn't save. Check your connection and try again.";

const PILL: Record<SubItemStatus, string> = {
  pending: "border-rccg-purple-200 bg-rccg-purple-50 text-rccg-purple-700",
  bought: "border-rccg-green-200 bg-rccg-green-50 text-rccg-green-700",
  donated: "border-rccg-purple-300 bg-rccg-purple-100 text-rccg-purple-700",
};

const STATUS_WORD: Record<SubItemStatus, string> = {
  pending: "Not sorted yet",
  bought: "Bought",
  donated: "Donated",
};

interface Props {
  budget: BudgetItem[];
  breakdown: SpendingBreakdown;
  total: number;
  canEdit: boolean;
  /** Whether the person can record a purchase (opens the spending dialog). */
  canRecord: boolean;
  onChange: (items: BudgetItem[]) => Promise<boolean>; // caller persists; true when it saved
  onRecordPurchase: (line: BudgetItem, child: BudgetSubItem) => void;
}

/**
 * The event's budget. Each item can be broken into sub-items (rice, meat…)
 * shown as pills, and the item's budget is their total. A sub-item is
 * logged off when it is donated or when a purchase is recorded for it.
 * Adding and editing happen in dialogs.
 */
export default function BudgetLines({ budget, breakdown, total, canEdit, canRecord, onChange, onRecordPurchase }: Props) {
  const [editing, setEditing] = useState<BudgetItem | "new" | null>(null);
  const [deleting, setDeleting] = useState<BudgetItem | null>(null);
  const [sorting, setSorting] = useState<{ lineId: string; childId: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spendOf = (id: string): BudgetLineSpend | undefined => breakdown.lines.find((l) => l.line.id === id);
  const spentOn = (id: string) => spendOf(id)?.spent ?? 0;

  function open(target: BudgetItem | "new") {
    setError(null);
    setEditing(target);
  }

  async function save(item: BudgetItem) {
    setSaving(true);
    setError(null);
    const next = editing === "new" ? [...budget, item] : budget.map((b) => (b.id === item.id ? item : b));
    const ok = await onChange(next);
    setSaving(false);
    if (ok) setEditing(null);
    else setError(SAVE_ERROR);
  }

  async function remove() {
    if (!deleting) return;
    setSaving(true);
    setError(null);
    const ok = await onChange(budget.filter((b) => b.id !== deleting.id));
    setSaving(false);
    if (ok) setDeleting(null);
    else setError(SAVE_ERROR);
  }

  /** Changes one sub-item (marks it donated, or not) and saves. */
  async function updateChild(lineId: string, childId: string, patch: (c: BudgetSubItem) => BudgetSubItem): Promise<boolean> {
    const next = budget.map((b) =>
      b.id === lineId ? { ...b, children: (b.children ?? []).map((c) => (c.id === childId ? patch(c) : c)) } : b
    );
    return onChange(next);
  }

  const addButton = canEdit ? (
    <button type="button" onClick={() => open("new")} className="btn-primary btn-sm">
      Add item
    </button>
  ) : undefined;

  const totalOver = total > 0 && breakdown.totalSpent > total;
  const sortingLine = sorting ? spendOf(sorting.lineId) : undefined;
  const sortingState = sortingLine?.children.find((c) => c.child.id === sorting?.childId);

  return (
    <Card
      title="Budget"
      description="What the event is expected to cost. Break an item into sub-items to see what is bought and what is donated."
      action={addButton}
    >
      {budget.length === 0 ? (
        <EmptyState
          title="No budget items yet"
          description={canEdit ? "Add what the event will need and what each item is expected to cost." : undefined}
          action={
            canEdit ? (
              <button type="button" onClick={() => open("new")} className="btn-secondary btn-sm">
                Add the first item
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="tbl">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">Budget</th>
                <th className="text-right">Spent</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {budget.map((b) => {
                const spent = spentOn(b.id);
                const children = spendOf(b.id)?.children ?? [];
                const own = spendOf(b.id)?.own ?? null;
                return (
                  <tr key={b.id}>
                    <td>
                      <p className="font-medium">{b.item}</p>
                      {children.length > 0 && (
                        <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label={`Parts of ${b.item}`}>
                          {children.map((c) => (
                            <li key={c.child.id}>
                              <SubItemPill state={c} interactive={canEdit || canRecord} onClick={() => setSorting({ lineId: b.id, childId: c.child.id })} />
                            </li>
                          ))}
                        </ul>
                      )}
                      {own && own.status !== "pending" && (
                        <p className="mt-1.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${PILL[own.status]}`}
                            title={own.viaItem ? `Covered in Items needed (${own.viaItem})` : undefined}
                          >
                            {own.status === "donated" ? "Donated" : "Bought"}
                            {own.viaItem && <span className="opacity-80">· via Items needed</span>}
                          </span>
                        </p>
                      )}
                    </td>
                    <td className="num text-right align-top">{naira(b.price)}</td>
                    <td className={`num text-right align-top ${spent > b.price ? "font-medium text-rccg-red-600" : ""}`}>
                      {spent > 0 ? naira(spent) : <span className="text-muted">—</span>}
                    </td>
                    {canEdit && (
                      <td className="text-right align-top">
                        <button type="button" onClick={() => open(b)} className="btn-ghost" aria-label={`Edit ${b.item}`}>
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {breakdown.unbudgeted > 0 && (
                <tr>
                  <td className="text-muted">Not on the budget</td>
                  <td className="num text-right text-muted">—</td>
                  <td className="num text-right">{naira(breakdown.unbudgeted)}</td>
                  {canEdit && <td />}
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="num text-right">{naira(total)}</td>
                <td className={`num text-right ${totalOver ? "text-rccg-red-600" : ""}`}>{naira(breakdown.totalSpent)}</td>
                {canEdit && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {editing !== null && (
        <BudgetLineModal
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
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
          title="Remove this budget item?"
          subject={{ name: deleting.item, detail: naira(deleting.price) }}
          tone="danger"
          confirmLabel="Remove"
          busyLabel="Removing…"
          busy={saving}
          error={error}
          description={
            spentOn(deleting.id) > 0
              ? `${naira(spentOn(deleting.id))} of spending is recorded against it. That spending stays, and will show as not on the budget.`
              : "It will come off the budget total."
          }
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      )}

      {sorting && sortingLine && sortingState && (
        <SubItemModal
          line={sortingLine.line}
          state={sortingState}
          canEdit={canEdit}
          canRecord={canRecord}
          onClose={() => setSorting(null)}
          onDonated={(donatedBy) =>
            updateChild(sortingLine.line.id, sortingState.child.id, (c) => {
              const { donatedBy: _old, ...rest } = c;
              void _old;
              return { ...rest, donated: true, ...(donatedBy ? { donatedBy } : {}) };
            })
          }
          onNotDonated={() =>
            updateChild(sortingLine.line.id, sortingState.child.id, (c) => {
              const { donated: _d, donatedBy: _by, ...rest } = c;
              void _d;
              void _by;
              return rest;
            })
          }
          onRecordPurchase={() => {
            onRecordPurchase(sortingLine.line, sortingState.child);
            setSorting(null);
          }}
        />
      )}
    </Card>
  );
}

/* ---- The pill for one sub-item ----------------------------------------- */

function SubItemPill({ state, interactive, onClick }: { state: SubItemState; interactive: boolean; onClick: () => void }) {
  const { child, status } = state;
  const label = (
    <>
      <span className="font-medium">{child.name}</span>
      {status === "donated" ? (
        <span className="opacity-80">· Donated</span>
      ) : (
        <span className="num opacity-80">
          {naira(status === "bought" ? state.spent : child.price)}
          {status === "bought" && " · Bought"}
        </span>
      )}
    </>
  );
  const classes = `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${PILL[status]}`;
  const title = state.viaItem ? `Covered in Items needed (${state.viaItem})` : undefined;
  return interactive ? (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`${classes} transition-colors hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rccg-purple-500`}
      aria-label={`${child.name}: ${STATUS_WORD[status]}. Open to update`}
    >
      {label}
    </button>
  ) : (
    <span className={classes} title={title}>
      {label}
    </span>
  );
}

/* ---- Log a sub-item off: donated, or a purchase ------------------------- */

function SubItemModal({
  line,
  state,
  canEdit,
  canRecord,
  onClose,
  onDonated,
  onNotDonated,
  onRecordPurchase,
}: {
  line: BudgetItem;
  state: SubItemState;
  canEdit: boolean;
  canRecord: boolean;
  onClose: () => void;
  onDonated: (donatedBy: string) => Promise<boolean>;
  onNotDonated: () => Promise<boolean>;
  onRecordPurchase: () => void;
}) {
  const { child, status, spent } = state;
  const [donatedBy, setDonatedBy] = useState(child.donatedBy ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<boolean>) {
    setBusy(true);
    setError(null);
    const ok = await action();
    setBusy(false);
    if (ok) onClose();
    else setError(SAVE_ERROR);
  }

  return (
    <Modal
      open
      title={child.name}
      onClose={onClose}
      busy={busy}
      footer={
        <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">
          Close
        </button>
      }
    >
      <p className="text-sm text-muted">
        Part of <span className="font-medium text-ink">{line.item}</span> · expected cost{" "}
        <span className="num font-medium text-ink">{naira(child.price)}</span>
      </p>

      <div className={`rounded-lg border px-3 py-2.5 text-sm ${PILL[status]}`}>
        {status === "pending" && "Not sorted yet. Mark it as donated, or record the purchase when you buy it."}
        {status === "donated" &&
          (state.viaItem ? (
            <>
              Covered by “{state.viaItem}” in Items needed, so nothing needs buying. The {naira(child.price)} stays unspent.
            </>
          ) : (
            <>
              Donated{child.donatedBy ? ` by ${child.donatedBy}` : ""}. Nothing was spent on it, so the {naira(child.price)} stays unspent.
            </>
          ))}
        {status === "bought" && <>Bought. {naira(spent)} recorded as spent on it.</>}
      </div>

      {state.linked.length > 0 && (
        <p className="text-xs text-muted">
          Linked to {state.linked.length === 1 ? "the needed item" : "the needed items"}{" "}
          <span className="font-medium text-ink">{state.linked.map((l) => l.name).join(", ")}</span>. It counts as donated once{" "}
          {state.linked.length === 1 ? "that is" : "one of those is"} covered, and recording a purchase here counts{" "}
          {state.linked.length === 1 ? "it" : "them"} as covered there.
        </p>
      )}

      {canEdit && status === "pending" && (
        <Field label="Donated by (optional)" hint="Who gave it, if you want to note it.">
          <input value={donatedBy} onChange={(e) => setDonatedBy(e.target.value)} placeholder="e.g. Sis Ada" className="input" />
        </Field>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      <div className="flex flex-wrap gap-2">
        {canEdit && status === "pending" && (
          <button type="button" disabled={busy} onClick={() => run(() => onDonated(donatedBy.trim()))} className="btn-primary btn-sm">
            Mark as donated
          </button>
        )}
        {canEdit && status === "donated" && child.donated && (
          <button type="button" disabled={busy} onClick={() => run(onNotDonated)} className="btn-secondary btn-sm">
            Not donated after all
          </button>
        )}
        {canRecord && (
          <button
            type="button"
            disabled={busy}
            onClick={onRecordPurchase}
            className="btn-secondary btn-sm"
          >
            {status === "bought" ? "Record another purchase" : "Record purchase"}
          </button>
        )}
      </div>
    </Modal>
  );
}

/* ---- Add / edit an item, with its sub-items ----------------------------- */

interface ChildDraft {
  id: string;
  name: string;
  price: string;
  donated?: boolean;
  donatedBy?: string;
}

function BudgetLineModal({
  initial,
  saving,
  error,
  onSave,
  onClose,
  onRemove,
}: {
  initial: BudgetItem | null;
  saving: boolean;
  error: string | null;
  onSave: (item: BudgetItem) => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(initial?.item ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [children, setChildren] = useState<ChildDraft[]>(
    (initial?.children ?? []).map((c) => ({ ...c, price: String(c.price) }))
  );
  const [formError, setFormError] = useState<string | null>(null);

  const hasChildren = children.length > 0;
  const childrenTotal = children.reduce((sum, c) => sum + (Number(c.price) || 0), 0);

  function setChild(id: string, patch: Partial<ChildDraft>) {
    setChildren((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function removeChild(id: string) {
    const next = children.filter((c) => c.id !== id);
    // Back to a single price: keep the total the item had so nothing is lost.
    if (next.length === 0) setPrice(String(childrenTotal));
    setChildren(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setFormError("Enter what the item is.");

    if (hasChildren) {
      for (const c of children) {
        const value = Number(c.price);
        if (!c.name.trim()) return setFormError("Every sub-item needs a name.");
        if (c.price.trim() === "" || Number.isNaN(value) || value < 0) return setFormError(`Enter a price of ₦0 or more for ${c.name.trim()}.`);
      }
      setFormError(null);
      const cleaned: BudgetSubItem[] = children.map((c) => ({
        id: c.id,
        name: c.name.trim(),
        price: Number(c.price),
        // Optional fields only when set: Firestore rejects `undefined`.
        ...(c.donated ? { donated: true } : {}),
        ...(c.donated && c.donatedBy ? { donatedBy: c.donatedBy } : {}),
      }));
      // The item's price is always its sub-items' total.
      onSave({ id: initial?.id ?? newId(), item: name.trim(), price: cleaned.reduce((s, c) => s + c.price, 0), children: cleaned });
      return;
    }

    const amount = Number(price);
    if (price.trim() === "" || Number.isNaN(amount) || amount < 0) return setFormError("Enter a price of ₦0 or more.");
    setFormError(null);
    onSave({ id: initial?.id ?? newId(), item: name.trim(), price: amount });
  }

  return (
    <Modal
      open
      size="lg"
      title={initial ? "Edit budget item" : "Add budget item"}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          {initial && (
            <button type="button" onClick={onRemove} disabled={saving} className="btn-ghost-danger mr-auto">
              Remove
            </button>
          )}
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" form="budget-line-form" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : initial ? "Save changes" : "Add item"}
          </button>
        </>
      }
    >
      <form id="budget-line-form" onSubmit={submit} className="space-y-4">
        <Field label="Item">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jollof rice" className="input" />
        </Field>

        {hasChildren ? (
          <div>
            <p className="label">Sub-items</p>
            <ul className="space-y-2">
              {children.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <input
                    value={c.name}
                    onChange={(e) => setChild(c.id, { name: e.target.value })}
                    placeholder="e.g. Rice"
                    aria-label="Sub-item name"
                    className="input min-w-0 flex-1"
                  />
                  <input
                    type="number"
                    min={0}
                    value={c.price}
                    onChange={(e) => setChild(c.id, { price: e.target.value })}
                    placeholder="₦"
                    aria-label="Sub-item price"
                    className="input w-32 shrink-0"
                  />
                  <button type="button" onClick={() => removeChild(c.id)} className="btn-ghost shrink-0" aria-label={`Remove ${c.name || "sub-item"}`}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setChildren((list) => [...list, { id: newId(), name: "", price: "" }])}
                className="btn-secondary btn-sm"
              >
                + Add sub-item
              </button>
              <p className="text-sm text-muted">
                Item budget: <span className="num font-semibold text-ink">{naira(childrenTotal)}</span>
              </p>
            </div>
          </div>
        ) : (
          <>
            <Field label="Expected price (₦)">
              <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" className="input" />
            </Field>
            <div className="rounded-lg border border-dashed border-line px-3 py-2.5 text-sm text-muted">
              Made up of several things, like rice and meat for jollof?{" "}
              <button
                type="button"
                onClick={() => setChildren([{ id: newId(), name: "", price: price.trim() }])}
                className="font-medium text-rccg-purple-600 underline underline-offset-2"
              >
                Break it into sub-items
              </button>
              . The item’s budget becomes their total.
            </div>
          </>
        )}

        {(formError || error) && <Notice tone="error">{formError ?? error}</Notice>}
      </form>
    </Modal>
  );
}
