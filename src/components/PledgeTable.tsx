"use client";

import { useState } from "react";
import {
  createPledge,
  setPledgeAmount,
  setPledgeItems,
  recordRedemption,
  newItemId,
} from "@/lib/contributions";
import { getPledgeStatus, pledgeStatusLabel, PledgeStatus } from "@/lib/contributionStatus";
import { useAuth } from "@/lib/useAuth";
import { formatPersonName } from "@/lib/formatName";
import { naira, todayISO } from "@/lib/format";
import ItemEntry from "@/components/ItemEntry";
import { Badge, EmptyState, Field, Notice, Tone } from "@/components/ui";
import type { Pledge, PledgedItem, Youth, PaymentMethod } from "@/types";

interface Props {
  contributionId: string;
  pledges: Pledge[];
  youths: Youth[];
  canEdit: boolean;
  onChange: () => void; // caller refetches pledges after any write
}

const PLEDGE_TONE: Record<PledgeStatus, Tone> = {
  redeemed: "green",
  partial: "amber",
  unpaid: "red",
  unpledged: "purple",
  none: "gray",
};

export default function PledgeTable({ contributionId, pledges, youths, canEdit, onChange }: Props) {
  const { user } = useAuth();
  const [addingYouthId, setAddingYouthId] = useState("");
  const [addAmount, setAddAmount] = useState("");
  // Items entered while adding a new pledge, saved together with it.
  const [addItems, setAddItems] = useState<{ name: string; quantity: number }[]>([]);
  // Whose items panel is open, and unsaved edits to the numbers in it.
  const [itemsYouthId, setItemsYouthId] = useState<string | null>(null);
  const [itemDraft, setItemDraft] = useState<Record<string, { quantity?: string; received?: string }>>({});
  const [pledgeInput, setPledgeInput] = useState<Record<string, string>>({});
  const [redeemForm, setRedeemForm] = useState<{
    youthId: string;
    amount: string;
    method: PaymentMethod;
    date: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pledgedYouthIds = new Set(pledges.map((p) => p.youthId));
  const youthsNotYetAdded = youths.filter((y) => !pledgedYouthIds.has(y.id));

  function youthName(id: string) {
    const youth = youths.find((y) => y.id === id);
    return youth ? formatPersonName(youth.name, youth.gender) : "—";
  }

  function rawName(id: string) {
    return youths.find((y) => y.id === id)?.name ?? "";
  }

  async function handleAddPledge() {
    if (!addingYouthId) return;
    const amount = addAmount.trim() === "" ? 0 : Number(addAmount);
    if (Number.isNaN(amount) || amount < 0) return setError("Enter a valid pledge amount.");
    if (amount === 0 && addItems.length === 0) return setError("Enter an amount, add an item, or both.");
    setSaving(true);
    setError(null);
    try {
      await createPledge(contributionId, addingYouthId, amount, addItems);
      setAddingYouthId("");
      setAddAmount("");
      setAddItems([]);
      onChange();
    } catch {
      setError("Couldn't save the pledge. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditPledge(youthId: string) {
    const amount = Number(pledgeInput[youthId]);
    if (Number.isNaN(amount) || amount < 0) return;
    setSaving(true);
    setError(null);
    try {
      await setPledgeAmount(contributionId, youthId, amount);
      onChange();
    } catch {
      setError("Couldn't save the pledge. Try again.");
    } finally {
      setSaving(false);
    }
  }

  // Every change to a pledge's items is "write the whole list back".
  async function saveItems(youthId: string, items: PledgedItem[]) {
    setSaving(true);
    setError(null);
    try {
      await setPledgeItems(contributionId, youthId, items);
      onChange();
    } catch {
      setError("Couldn't save the items. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddItem(youthId: string, current: PledgedItem[], name: string, quantity: number) {
    await saveItems(youthId, [...current, { id: newItemId(), name, quantity, received: 0 }]);
  }

  async function handleSaveItem(youthId: string, current: PledgedItem[], item: PledgedItem) {
    const draft = itemDraft[item.id] ?? {};
    const quantity = draft.quantity !== undefined ? Number(draft.quantity) : item.quantity;
    const received = draft.received !== undefined ? Number(draft.received) : item.received;
    if (!Number.isInteger(quantity) || quantity < 1) return setError("The pledged number must be a whole number, 1 or more.");
    if (!Number.isInteger(received) || received < 0) return setError("The received number must be a whole number, 0 or more.");
    setItemDraft((prev) => {
      const { [item.id]: _removed, ...rest } = prev;
      return rest;
    });
    await saveItems(youthId, current.map((i) => (i.id === item.id ? { ...i, quantity, received } : i)));
  }

  async function handleMarkAllReceived(youthId: string, current: PledgedItem[], item: PledgedItem) {
    await saveItems(youthId, current.map((i) => (i.id === item.id ? { ...i, received: i.quantity } : i)));
  }

  async function handleRemoveItem(youthId: string, current: PledgedItem[], itemId: string) {
    await saveItems(youthId, current.filter((i) => i.id !== itemId));
  }

  async function handleRecordPayment() {
    if (!redeemForm || !user) return;
    const amount = Number(redeemForm.amount);
    if (!amount || amount <= 0) return setError("Enter the amount paid.");
    setSaving(true);
    setError(null);
    try {
      await recordRedemption({
        contributionId,
        youthId: redeemForm.youthId,
        amount,
        method: redeemForm.method,
        date: redeemForm.date,
        recordedBy: user.uid,
      });
      setRedeemForm(null);
      onChange();
    } catch {
      setError("Couldn't record the payment. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const sorted = [...pledges].sort((a, b) => rawName(a.youthId).localeCompare(rawName(b.youthId)));
  const visible = search.trim()
    ? sorted.filter((p) => youthName(p.youthId).toLowerCase().includes(search.trim().toLowerCase()))
    : sorted;

  const totalPledged = pledges.reduce((sum, p) => sum + p.pledgedAmount, 0);
  const totalRedeemed = pledges.reduce((sum, p) => sum + p.redeemedAmount, 0);
  const totalBalance = pledges.reduce((sum, p) => sum + Math.max(0, p.pledgedAmount - p.redeemedAmount), 0);

  const itemsPledge = itemsYouthId ? pledges.find((p) => p.youthId === itemsYouthId) : undefined;
  const itemsList = itemsPledge?.items ?? [];

  const redeemingPledge = redeemForm ? pledges.find((p) => p.youthId === redeemForm.youthId) : undefined;
  const redeemBalance = redeemingPledge
    ? Math.max(0, redeemingPledge.pledgedAmount - redeemingPledge.redeemedAmount)
    : 0;

  return (
    <div>
      {error && <Notice tone="error" className="mb-3">{error}</Notice>}

      {redeemForm && (
        <div className="panel mb-4 space-y-3">
          <p className="text-sm font-semibold text-rccg-purple-800">
            Record payment for {youthName(redeemForm.youthId)}
            {redeemBalance > 0 && (
              <span className="ml-2 font-normal text-muted">Balance {naira(redeemBalance)}</span>
            )}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Amount (₦)">
              <input
                type="number"
                min={0}
                value={redeemForm.amount}
                onChange={(e) => setRedeemForm({ ...redeemForm, amount: e.target.value })}
                className="input"
                autoFocus
              />
            </Field>
            <Field label="Method">
              <select
                value={redeemForm.method}
                onChange={(e) => setRedeemForm({ ...redeemForm, method: e.target.value as PaymentMethod })}
                className="input"
              >
                <option value="cash">Cash</option>
                <option value="transfer">Transfer</option>
              </select>
            </Field>
            <Field label="Date paid">
              <input
                type="date"
                value={redeemForm.date}
                onChange={(e) => setRedeemForm({ ...redeemForm, date: e.target.value })}
                className="input"
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleRecordPayment} disabled={saving} className="btn-primary btn-sm">
              {saving ? "Saving…" : "Save payment"}
            </button>
            <button
              onClick={() => {
                setRedeemForm(null);
                setError(null);
              }}
              className="btn-secondary btn-sm"
            >
              Cancel
            </button>
            {redeemBalance > 0 && (
              <button
                onClick={() => setRedeemForm({ ...redeemForm, amount: String(redeemBalance) })}
                className="btn-ghost"
              >
                Fill in the balance
              </button>
            )}
          </div>
        </div>
      )}

      {itemsPledge && canEdit && (
        <div className="panel mb-4 space-y-3">
          <p className="text-sm font-semibold text-rccg-purple-800">Items for {youthName(itemsPledge.youthId)}</p>

          {itemsList.length === 0 ? (
            <p className="text-sm text-muted">No items pledged yet.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {itemsList.map((item) => {
                const draft = itemDraft[item.id] ?? {};
                const dirty =
                  (draft.quantity !== undefined && draft.quantity !== String(item.quantity)) ||
                  (draft.received !== undefined && draft.received !== String(item.received));
                return (
                  <li key={item.id} className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 py-2.5 first:pt-0">
                    <p className="min-w-[8rem] font-medium">{item.name}</p>
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="text-xs text-muted">
                        Pledged
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={draft.quantity ?? String(item.quantity)}
                          onChange={(e) =>
                            setItemDraft((prev) => ({ ...prev, [item.id]: { ...prev[item.id], quantity: e.target.value } }))
                          }
                          className="input mt-0.5 w-20 py-1"
                        />
                      </label>
                      <label className="text-xs text-muted">
                        Received
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={draft.received ?? String(item.received)}
                          onChange={(e) =>
                            setItemDraft((prev) => ({ ...prev, [item.id]: { ...prev[item.id], received: e.target.value } }))
                          }
                          className="input mt-0.5 w-20 py-1"
                        />
                      </label>
                      {dirty && (
                        <button
                          onClick={() => handleSaveItem(itemsPledge.youthId, itemsList, item)}
                          disabled={saving}
                          className="btn-primary btn-sm"
                        >
                          Save
                        </button>
                      )}
                      {!dirty && item.received < item.quantity && (
                        <button
                          onClick={() => handleMarkAllReceived(itemsPledge.youthId, itemsList, item)}
                          disabled={saving}
                          className="btn-ghost whitespace-nowrap"
                        >
                          All received
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveItem(itemsPledge.youthId, itemsList, item.id)}
                        disabled={saving}
                        className="btn-ghost-danger"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <ItemEntry
            disabled={saving}
            onAdd={(name, quantity) => handleAddItem(itemsPledge.youthId, itemsList, name, quantity)}
          />
          <button
            onClick={() => {
              setItemsYouthId(null);
              setItemDraft({});
              setError(null);
            }}
            className="btn-secondary btn-sm"
          >
            Done
          </button>
        </div>
      )}

      {pledges.length === 0 ? (
        <EmptyState
          title="No pledges yet"
          description={canEdit ? "Add a youth below to record what they've pledged: money, items, or both." : undefined}
        />
      ) : (
        <>
          {pledges.length > 8 && (
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name…"
              aria-label="Search pledges by name"
              className="input mb-3 sm:max-w-xs"
            />
          )}
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Youth</th>
                  <th className="text-right">Pledged</th>
                  <th className="text-right">Redeemed</th>
                  <th className="text-right">Balance</th>
                  <th>Items</th>
                  <th>Status</th>
                  {canEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const status = getPledgeStatus(p);
                  const balance = Math.max(0, p.pledgedAmount - p.redeemedAmount);
                  const draft = pledgeInput[p.youthId];
                  const dirty = draft !== undefined && draft !== "" && Number(draft) !== p.pledgedAmount;
                  return (
                    <tr key={p.youthId}>
                      <td className="whitespace-nowrap font-medium">{youthName(p.youthId)}</td>
                      <td className="num text-right">
                        {canEdit ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <input
                              type="number"
                              min={0}
                              defaultValue={p.pledgedAmount}
                              aria-label={`Pledged amount for ${youthName(p.youthId)}`}
                              onChange={(e) =>
                                setPledgeInput((prev) => ({ ...prev, [p.youthId]: e.target.value }))
                              }
                              className="input w-28 py-1 text-right"
                            />
                            {dirty && (
                              <button
                                onClick={() => handleEditPledge(p.youthId)}
                                disabled={saving}
                                className="btn-ghost"
                              >
                                Save
                              </button>
                            )}
                          </div>
                        ) : (
                          naira(p.pledgedAmount)
                        )}
                      </td>
                      <td className="num text-right">{naira(p.redeemedAmount)}</td>
                      <td
                        className={`num text-right ${balance > 0 ? "font-medium text-rccg-red-600" : "text-muted"}`}
                      >
                        {balance > 0 ? naira(balance) : "—"}
                      </td>
                      <td className="text-sm">
                        {(p.items?.length ?? 0) === 0 ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {p.items!.map((item) => (
                              <li key={item.id} className="whitespace-nowrap">
                                <span
                                  className={`num font-medium ${item.received >= item.quantity ? "text-rccg-green-700" : ""}`}
                                >
                                  {item.received}/{item.quantity}
                                </span>{" "}
                                <span className="text-muted">{item.name}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td>
                        <Badge tone={PLEDGE_TONE[status]}>{pledgeStatusLabel(p)}</Badge>
                      </td>
                      {canEdit && (
                        <td className="whitespace-nowrap text-right">
                          <button
                            onClick={() => {
                              setError(null);
                              setItemsYouthId(p.youthId);
                              setItemDraft({});
                            }}
                            className="btn-ghost whitespace-nowrap"
                          >
                            {(p.items?.length ?? 0) > 0 ? "Items" : "Add items"}
                          </button>
                          <button
                            onClick={() => {
                              setError(null);
                              setRedeemForm({
                                youthId: p.youthId,
                                amount: "",
                                method: "cash",
                                date: todayISO(),
                              });
                            }}
                            className="btn-ghost whitespace-nowrap"
                          >
                            Record payment
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={canEdit ? 7 : 6} className="py-6 text-center text-muted">
                      No one matches “{search}”.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="num text-right">{naira(totalPledged)}</td>
                  <td className="num text-right">{naira(totalRedeemed)}</td>
                  <td className="num text-right">{totalBalance > 0 ? naira(totalBalance) : "—"}</td>
                  <td colSpan={canEdit ? 3 : 2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {canEdit && youthsNotYetAdded.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] flex-1 sm:flex-none">
              <label className="label" htmlFor="add-pledge-youth">
                Add a pledge
              </label>
              <select
                id="add-pledge-youth"
                value={addingYouthId}
                onChange={(e) => setAddingYouthId(e.target.value)}
                className="input"
              >
                <option value="">Choose a youth…</option>
                {youthsNotYetAdded.map((y) => (
                  <option key={y.id} value={y.id}>
                    {formatPersonName(y.name, y.gender)}
                  </option>
                ))}
              </select>
            </div>
            {addingYouthId && (
              <div>
                <label className="label" htmlFor="add-pledge-amount">
                  Money pledged (₦, optional)
                </label>
                <input
                  id="add-pledge-amount"
                  type="number"
                  min={0}
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  className="input w-44"
                />
              </div>
            )}
          </div>

          {addingYouthId && (
            <div className="space-y-2">
              <p className="label !mb-0">Items pledged (optional)</p>
              {addItems.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {addItems.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-1.5 rounded-full border border-line bg-white py-1 pl-3 pr-1.5 text-sm"
                    >
                      <span className="num font-medium">{item.quantity}</span> {item.name}
                      <button
                        onClick={() => setAddItems((prev) => prev.filter((_, j) => j !== i))}
                        aria-label={`Remove ${item.name}`}
                        className="rounded-full px-1.5 text-muted hover:text-rccg-red-600"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <ItemEntry
                buttonLabel="Add to pledge"
                onAdd={(name, quantity) => setAddItems((prev) => [...prev, { name, quantity }])}
              />
              <p className="hint">A pledge can be money, items, or both.</p>
            </div>
          )}

          <button onClick={handleAddPledge} disabled={!addingYouthId || saving} className="btn-primary">
            Add pledge
          </button>
        </div>
      )}
    </div>
  );
}
