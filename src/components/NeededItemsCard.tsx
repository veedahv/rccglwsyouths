"use client";

import { useState } from "react";
import { formatQuantity, naira } from "@/lib/format";
import { newId } from "@/lib/eventDocuments";
import { targetKey, targetLabel } from "@/lib/eventBudget";
import type { ItemCheck, ItemStatus, ItemsCheckResult } from "@/lib/eventBudget";
import Modal, { ConfirmDialog } from "@/components/Modal";
import { Badge, Card, EmptyState, Field, Notice, Tone } from "@/components/ui";
import type { BudgetItem, NeededItem } from "@/types";

const SAVE_ERROR = "That didn't save. Check your connection and try again.";

const STATUS: Record<ItemStatus, { label: string; tone: Tone }> = {
  enough: { label: "Enough", tone: "green" },
  partial: { label: "Some", tone: "amber" },
  none: { label: "None yet", tone: "gray" },
};

const withUnit = (n: number, unit?: string) => `${formatQuantity(n)}${unit ? ` ${unit}` : ""}`;

/** "Bought" when it counts as covered only because a purchase was recorded; otherwise the usual status. */
function statusOf(c: ItemCheck): { label: string; tone: Tone } {
  return c.status === "enough" && c.bought && !c.coveredAlone ? { label: "Bought", tone: "green" } : STATUS[c.status];
}

interface Props {
  items: NeededItem[];
  budget: BudgetItem[];
  result: ItemsCheckResult;
  hasContribution: boolean;
  canEdit: boolean;
  /** Caller persists. `budget` is passed when the item was added to the budget at the same time. */
  onChange: (items: NeededItem[], budget?: BudgetItem[]) => Promise<boolean>;
}

/** "3 packs" from the number and unit; older items that only have the free-text quantity fall back to it. */
function neededLabel(item: NeededItem): string {
  return item.target ? withUnit(item.target, item.unit) : item.quantity;
}

/**
 * What the event needs people to bring or give, and whether there is
 * enough. "Have" adds what came in through the contribution drive (matched
 * by item name) to anything got outside it. "Check items" opens a
 * checklist to confirm item by item.
 */
export default function NeededItemsCard({ items, budget, result, hasContribution, canEdit, onChange }: Props) {
  const [editing, setEditing] = useState<NeededItem | "new" | null>(null);
  const [deleting, setDeleting] = useState<NeededItem | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { checks, otherContributed, coveredCount } = result;

  function open(target: NeededItem | "new") {
    setError(null);
    setEditing(target);
  }

  async function save(item: NeededItem, budgetNext?: BudgetItem[]) {
    setSaving(true);
    setError(null);
    const next = editing === "new" ? [...items, item] : items.map((i) => (i.id === item.id ? item : i));
    const ok = await onChange(next, budgetNext);
    setSaving(false);
    if (ok) setEditing(null);
    else setError(SAVE_ERROR);
  }

  async function remove() {
    if (!deleting) return;
    setSaving(true);
    setError(null);
    const ok = await onChange(items.filter((i) => i.id !== deleting.id));
    setSaving(false);
    if (ok) setDeleting(null);
    else setError(SAVE_ERROR);
  }

  const actions = (
    <div className="flex flex-wrap gap-2">
      {items.length > 0 && (
        <button type="button" onClick={() => setChecking(true)} className="btn-secondary btn-sm">
          Check items
        </button>
      )}
      {canEdit && (
        <button type="button" onClick={() => open("new")} className="btn-primary btn-sm">
          Add item
        </button>
      )}
    </div>
  );

  return (
    <Card
      title="Items needed"
      description={
        items.length > 0
          ? `${coveredCount} of ${items.length} ${items.length === 1 ? "item" : "items"} covered. Sponsorship requests pick from this list.`
          : "What the event needs people to bring or give. Sponsorship requests pick from this list."
      }
      action={actions}
    >
      {items.length === 0 ? (
        <EmptyState
          title="Nothing listed yet"
          description={canEdit ? "Add what the event needs people to bring or give." : undefined}
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
                <th className="text-right">Have</th>
                <th className="text-right">Need</th>
                <th>Status</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => {
                const linkLabel = targetLabel(budget, c.item.budgetItemId, c.item.budgetSubItemId);
                return (
                <tr key={c.item.id}>
                  <td>
                    <p className="font-medium">{c.item.name}</p>
                    {(c.target === null && c.item.quantity) || c.item.note ? (
                      <p className="text-xs text-muted">
                        {[c.target === null ? c.item.quantity : "", c.item.note].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                    {linkLabel && <p className="text-xs text-rccg-purple-600">Also in the budget: {linkLabel}</p>}
                  </td>
                  <td className="num text-right text-nowrap">
                    {c.total > 0 ? formatQuantity(c.total) : c.bought ? "Bought" : <span className="text-muted">—</span>}
                  </td>
                  <td className="num text-right text-nowrap">
                    {c.target !== null ? withUnit(c.target, c.item.unit) : <span className="text-muted">—</span>}
                  </td>
                  <td>
                    <Badge tone={statusOf(c).tone} dot>
                      {statusOf(c).label}
                    </Badge>
                  </td>
                  {canEdit && (
                    <td className="text-right">
                      <button type="button" onClick={() => open(c.item)} className="btn-ghost" aria-label={`Edit ${c.item.name}`}>
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {otherContributed.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          Also contributed, but not on this list:{" "}
          {otherContributed.map((l) => `${l.name} ${withUnit(l.quantity, l.unit)}`).join(", ")}. Add them to the list to track them.
        </p>
      )}
      {items.length > 0 && !hasContribution && (
        <p className="mt-3 text-xs text-muted">
          No contribution has been started, so “Have” only counts what was marked as got elsewhere.
        </p>
      )}

      {editing !== null && (
        <NeededItemModal
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
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
          title="Remove this item?"
          subject={{ name: deleting.name, detail: neededLabel(deleting) }}
          tone="danger"
          confirmLabel="Remove"
          busyLabel="Removing…"
          busy={saving}
          error={error}
          description="It will come off the list, and off any sponsorship request that has not been signed yet."
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      )}

      {checking && (
        <CheckItemsModal
          items={items}
          result={result}
          canEdit={canEdit}
          onChange={onChange}
          onClose={() => setChecking(false)}
        />
      )}
    </Card>
  );
}

/* ---- Check items ------------------------------------------------------- */

function CheckItemsModal({
  items,
  result,
  canEdit,
  onChange,
  onClose,
}: {
  items: NeededItem[];
  result: ItemsCheckResult;
  canEdit: boolean;
  onChange: (items: NeededItem[]) => Promise<boolean>;
  onClose: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { checks, coveredCount } = result;
  const allCovered = checks.length > 0 && coveredCount === checks.length;
  const stillNeeded = checks.filter((c) => c.status !== "enough");

  async function toggle(c: ItemCheck) {
    setBusyId(c.item.id);
    setError(null);
    const next = items.map((i) => {
      if (i.id !== c.item.id) return i;
      if (c.item.enough) {
        const { enough: _enough, ...rest } = i;
        void _enough;
        return rest;
      }
      return { ...i, enough: true };
    });
    const ok = await onChange(next);
    setBusyId(null);
    if (!ok) setError(SAVE_ERROR);
  }

  return (
    <Modal
      open
      size="lg"
      title="Check items needed"
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className="btn-primary">
          Done
        </button>
      }
    >
      <Notice tone={allCovered ? "success" : "warning"}>
        {allCovered
          ? "You have enough of everything on the list."
          : `${coveredCount} of ${checks.length} covered. Still to get: ${stillNeeded
              .map((c) => (c.short !== null && c.short > 0 ? `${c.item.name} (${withUnit(c.short, c.item.unit)} more)` : c.item.name))
              .join(", ")}.`}
      </Notice>

      {canEdit && (
        <p className="text-xs text-muted">
          Tick an item to confirm you have enough of it. Items with a number tick themselves once the count is reached.
        </p>
      )}

      <ul className="divide-y divide-line rounded-lg border border-line">
        {checks.map((c) => {
          const autoEnough = (c.target !== null && c.total >= c.target) || c.bought;
          const pct = c.target !== null ? Math.min(100, (c.total / c.target) * 100) : null;
          const parts = [
            c.contributed > 0 ? `${formatQuantity(c.contributed)} from contributions` : null,
            c.gotten > 0 ? `${formatQuantity(c.gotten)} got elsewhere` : null,
          ].filter(Boolean);
          return (
            <li key={c.item.id}>
              <label className={`flex items-start gap-3 px-3 py-3 ${canEdit && !autoEnough ? "cursor-pointer" : ""}`}>
                <input
                  type="checkbox"
                  checked={c.status === "enough"}
                  disabled={!canEdit || autoEnough || busyId === c.item.id}
                  onChange={() => toggle(c)}
                  className="mt-1 h-4 w-4 shrink-0 accent-rccg-green-600"
                  aria-label={`Enough ${c.item.name}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{c.item.name}</span>
                    <Badge tone={statusOf(c).tone} dot>
                      {statusOf(c).label}
                    </Badge>
                  </span>
                  <span className="block text-xs text-muted">Needed: {neededLabel(c.item)}</span>
                  <span className="mt-1 block text-sm">
                    {c.target !== null ? (
                      <>
                        <span className="num font-semibold">{formatQuantity(c.total)}</span> of {withUnit(c.target, c.item.unit)}
                        {c.short !== null && c.short > 0 && <span className="text-muted"> · {formatQuantity(c.short)} more to get</span>}
                      </>
                    ) : c.total > 0 ? (
                      <>
                        <span className="num font-semibold">{formatQuantity(c.total)}</span> received
                        <span className="text-muted"> · no number set, so confirm by ticking</span>
                      </>
                    ) : (
                      <span className="text-muted">Nothing received yet</span>
                    )}
                  </span>
                  {pct !== null && (
                    <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-rccg-purple-100" aria-hidden="true">
                      <span className="block h-full bg-rccg-green-500" style={{ width: `${pct}%` }} />
                    </span>
                  )}
                  {parts.length > 0 && <span className="mt-1 block text-xs text-muted">{parts.join(" + ")}</span>}
                  {c.bought && <span className="mt-1 block text-xs text-muted">A purchase is recorded for it in the budget.</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {error && <Notice tone="error">{error}</Notice>}
    </Modal>
  );
}

/* ---- Add / edit -------------------------------------------------------- */

type BudgetMode = "none" | "new" | "existing";
const NEW_BUDGET_ITEM = "__new__";

/** Older items only have text like "3 packs": pull the number and unit out so editing starts filled in. */
function parseLegacyQuantity(text: string): { number: string; unit: string } {
  const m = text.trim().match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  return m ? { number: m[1], unit: m[2].trim() } : { number: "", unit: "" };
}

function NeededItemModal({
  initial,
  budget,
  saving,
  error,
  onSave,
  onClose,
  onRemove,
}: {
  initial: NeededItem | null;
  budget: BudgetItem[];
  saving: boolean;
  error: string | null;
  onSave: (item: NeededItem, budget?: BudgetItem[]) => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  const legacy = initial && !initial.target ? parseLegacyQuantity(initial.quantity) : null;
  const [name, setName] = useState(initial?.name ?? "");
  const [target, setTarget] = useState(initial?.target ? String(initial.target) : legacy?.number ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? legacy?.unit ?? "");
  const [gotten, setGotten] = useState(initial?.gotten ? String(initial.gotten) : "");
  const [note, setNote] = useState(initial?.note ?? "");

  // Whether the item is also in the budget, and how. A link whose target was since removed starts as "not in the budget".
  const existingLink =
    initial?.budgetItemId && targetLabel(budget, initial.budgetItemId, initial.budgetSubItemId)
      ? targetKey(initial.budgetItemId, initial.budgetSubItemId)
      : "";
  const [mode, setMode] = useState<BudgetMode>(existingLink ? "existing" : "none");
  const [link, setLink] = useState(existingLink); // "itemId" or "itemId/subItemId"
  const [parentId, setParentId] = useState(NEW_BUDGET_ITEM); // where a new budget entry goes
  const [cost, setCost] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const isHalves = (n: number) => Number.isInteger(n * 2);
  const parent = budget.find((b) => b.id === parentId);
  const parentIsSingleCost = !!parent && !(parent.children && parent.children.length > 0) && parent.price > 0;
  const hasExistingTargets = budget.length > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const targetNum = Number(target);
    const gottenNum = gotten.trim() === "" ? 0 : Number(gotten);
    if (!name.trim()) return setFormError("Enter the item.");
    if (target.trim() === "" || Number.isNaN(targetNum) || targetNum <= 0 || !isHalves(targetNum)) {
      return setFormError("Enter how many are needed, as a whole number or a half (0.5, 1, 1.5…).");
    }
    if (Number.isNaN(gottenNum) || gottenNum < 0 || !isHalves(gottenNum)) {
      return setFormError("The number already got should be a whole number or a half, or left blank.");
    }

    // Work out the budget link, and any new budget entry that goes with it.
    let linkItemId = "";
    let linkSubId = "";
    let budgetNext: BudgetItem[] | undefined;

    if (mode === "existing") {
      if (!link) return setFormError("Choose which budget entry it is.");
      [linkItemId, linkSubId = ""] = link.split("/");
    } else if (mode === "new") {
      const costNum = Number(cost);
      if (cost.trim() === "" || Number.isNaN(costNum) || costNum < 0) {
        return setFormError("Enter what it is expected to cost, or ₦0 if it won't be bought.");
      }
      if (!parent) {
        // Its own budget item, with no parts.
        const line: BudgetItem = { id: newId(), item: name.trim(), price: costNum };
        budgetNext = [...budget, line];
        linkItemId = line.id;
      } else {
        // A new part of an existing budget item. An item that only had a single price keeps it as "Other", so nothing is lost.
        const sub = { id: newId(), name: name.trim(), price: costNum };
        const parts =
          parent.children && parent.children.length > 0
            ? [...parent.children, sub]
            : parent.price > 0
              ? [{ id: newId(), name: "Other", price: parent.price }, sub]
              : [sub];
        budgetNext = budget.map((b) =>
          b.id === parent.id ? { ...b, price: parts.reduce((sum, p) => sum + p.price, 0), children: parts } : b
        );
        linkItemId = parent.id;
        linkSubId = sub.id;
      }
    }

    setFormError(null);
    const unitText = unit.trim();
    // Optional fields are only included when they have a value: Firestore rejects `undefined`.
    onSave(
      {
        id: initial?.id ?? newId(),
        name: name.trim(),
        // Printed on letters and sponsorship requests; always the number and unit.
        quantity: `${formatQuantity(targetNum)}${unitText ? ` ${unitText}` : ""}`,
        target: targetNum,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(unitText ? { unit: unitText } : {}),
        ...(gottenNum > 0 ? { gotten: gottenNum } : {}),
        ...(initial?.enough ? { enough: true } : {}),
        ...(linkItemId ? { budgetItemId: linkItemId } : {}),
        ...(linkItemId && linkSubId ? { budgetSubItemId: linkSubId } : {}),
      },
      budgetNext
    );
  }

  const modes: { value: BudgetMode; label: string; show: boolean }[] = [
    { value: "none", label: "Not in the budget", show: true },
    { value: "new", label: "Add to the budget", show: true },
    { value: "existing", label: "Already in the budget", show: hasExistingTargets },
  ];

  return (
    <Modal
      open
      size="lg"
      title={initial ? "Edit item" : "Add item"}
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
          <button type="submit" form="needed-item-form" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : initial ? "Save changes" : "Add item"}
          </button>
        </>
      }
    >
      <form id="needed-item-form" onSubmit={submit} className="space-y-4">
        <Field label="Item">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rice" className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Number needed">
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="e.g. 3"
              className="input"
            />
          </Field>
          <Field label="Unit (optional)">
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. bags" className="input" />
          </Field>
        </div>
        <Field
          label="Already got elsewhere (optional)"
          hint="Bought or handed over outside the contribution drive. Anything contributed through the drive is counted automatically."
        >
          <input
            type="number"
            min={0}
            step={0.5}
            value={gotten}
            onChange={(e) => setGotten(e.target.value)}
            placeholder="0"
            className="input"
          />
        </Field>

        <fieldset>
          <legend className="label">Also in the budget?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {modes
              .filter((m) => m.show)
              .map((m) => (
                <label
                  key={m.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    mode === m.value ? "border-rccg-purple-500 bg-rccg-purple-50 font-medium text-rccg-purple-700" : "border-line"
                  }`}
                >
                  <input
                    type="radio"
                    name="budget-mode"
                    checked={mode === m.value}
                    onChange={() => setMode(m.value)}
                    className="accent-rccg-purple-600"
                  />
                  {m.label}
                </label>
              ))}
          </div>
          <p className="hint mt-1.5">
            Use this when you might buy it instead of getting it donated. Covered here, the budget shows it as donated. Bought there, it counts as covered here.
          </p>
        </fieldset>

        {mode === "new" && (
          <div className="space-y-4 rounded-lg border border-line bg-rccg-purple-50/40 p-3">
            <Field label="Put it under">
              <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="input">
                <option value={NEW_BUDGET_ITEM}>A new budget item of its own</option>
                {budget.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.item}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Expected cost (₦)" hint="What it would cost if you bought it. This adds to the budget.">
              <input type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" className="input" />
            </Field>
            {parentIsSingleCost && parent && (
              <p className="text-xs text-muted">
                {parent.item} is currently a single {naira(parent.price)}. That stays as a part called “Other”, and {name.trim() || "this item"} is added beside it. Both can be edited in the budget.
              </p>
            )}
          </div>
        )}

        {mode === "existing" && (
          <Field label="Which budget entry">
            <select value={link} onChange={(e) => setLink(e.target.value)} className="input">
              <option value="">Choose…</option>
              {budget.map((b) =>
                b.children && b.children.length > 0 ? (
                  <optgroup key={b.id} label={b.item}>
                    {b.children.map((c) => (
                      <option key={c.id} value={targetKey(b.id, c.id)}>
                        {b.item} › {c.name}
                      </option>
                    ))}
                  </optgroup>
                ) : (
                  <option key={b.id} value={targetKey(b.id)}>
                    {b.item}
                  </option>
                )
              )}
            </select>
          </Field>
        )}

        <Field label="Note (optional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 2 bags promised by Sis Ada" className="input" />
        </Field>
        {(formError || error) && <Notice tone="error">{formError ?? error}</Notice>}
      </form>
    </Modal>
  );
}
