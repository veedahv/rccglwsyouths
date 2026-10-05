"use client";

import { useState } from "react";
import { setPledgeAmount, recordRedemption } from "@/lib/contributions";
import { getPledgeStatus, PLEDGE_STATUS_LABEL, PledgeStatus } from "@/lib/contributionStatus";
import { useAuth } from "@/lib/useAuth";
import { formatPersonName } from "@/lib/formatName";
import { naira, todayISO } from "@/lib/format";
import { Badge, EmptyState, Field, Notice, Tone } from "@/components/ui";
import type { Pledge, Youth, PaymentMethod } from "@/types";

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
    const amount = Number(pledgeInput[addingYouthId] ?? 0);
    if (Number.isNaN(amount) || amount < 0) return setError("Enter a valid pledge amount.");
    setSaving(true);
    setError(null);
    try {
      await setPledgeAmount(contributionId, addingYouthId, amount);
      setAddingYouthId("");
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

      {pledges.length === 0 ? (
        <EmptyState
          title="No pledges yet"
          description={canEdit ? "Add a youth below to record what they've pledged." : undefined}
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
                      <td>
                        <Badge tone={PLEDGE_TONE[status]}>{PLEDGE_STATUS_LABEL[status]}</Badge>
                      </td>
                      {canEdit && (
                        <td className="text-right">
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
                    <td colSpan={canEdit ? 6 : 5} className="py-6 text-center text-muted">
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
                  <td colSpan={canEdit ? 2 : 1}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {canEdit && youthsNotYetAdded.length > 0 && (
        <div className="mt-4 flex flex-wrap items-end gap-2">
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
                Pledged amount (₦)
              </label>
              <input
                id="add-pledge-amount"
                type="number"
                min={0}
                onChange={(e) => setPledgeInput((prev) => ({ ...prev, [addingYouthId]: e.target.value }))}
                className="input w-36"
              />
            </div>
          )}
          <button
            onClick={handleAddPledge}
            disabled={!addingYouthId || saving}
            className="btn-primary"
          >
            Add pledge
          </button>
        </div>
      )}
    </div>
  );
}
