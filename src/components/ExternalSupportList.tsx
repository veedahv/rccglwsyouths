"use client";

import { useState } from "react";
import { addExternalSupport } from "@/lib/contributions";
import { useAuth } from "@/lib/useAuth";
import { formatDate, naira, todayISO } from "@/lib/format";
import { EmptyState, Field, Notice } from "@/components/ui";
import type { ExternalSupport, PaymentMethod } from "@/types";

interface Props {
  contributionId: string;
  externalSupport: ExternalSupport[];
  canEdit: boolean;
  onChange: () => void; // caller refetches after a write
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !amount || !user) return;
    setSaving(true);
    setError(null);
    try {
      await addExternalSupport(contributionId, {
        name: name.trim(),
        amount: Number(amount),
        method,
        date,
        recordedBy: user.uid,
      });
      setName("");
      setAmount("");
      setShowForm(false);
      onChange();
    } catch {
      setError("Couldn't save this. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const total = externalSupport.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        From people outside the youth roster, such as parents or pastors. Counts toward total received,
        never total pledged.
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
                <th>Method</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {externalSupport.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.name}</td>
                  <td className="whitespace-nowrap text-muted">{formatDate(s.date)}</td>
                  <td className="capitalize text-muted">{s.method}</td>
                  <td className="num text-right">{naira(s.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Total</td>
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
                <Field label="Amount (₦)">
                  <input
                    type="number"
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="input"
                    required
                  />
                </Field>
                <Field label="Method">
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                    className="input"
                  >
                    <option value="cash">Cash</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </Field>
                <Field label="Date received">
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
                </Field>
              </div>
              {error && <Notice tone="error">{error}</Notice>}
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="btn-primary btn-sm">
                  {saving ? "Saving…" : "Add support"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary btn-sm">
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
