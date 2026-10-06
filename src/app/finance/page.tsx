"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  generateMonthlyReport,
  generateQuarterlyReport,
  generateYearlyReport,
  MonthlyReport,
  YearlyReport,
  ReportLineItem,
} from "@/lib/reports";
import { downloadMonthlyReportPdf, downloadQuarterlyReportPdf } from "@/lib/reportPdf";
import { createTransaction } from "@/lib/transactions";
import { saveOpeningBalance, openingTotal } from "@/lib/openingBalances";
import { useAuth } from "@/lib/useAuth";
import { formatDate, naira, todayISO } from "@/lib/format";
import RequireAuth from "@/components/RequireAuth";
import { Page, PageHeader, Card, Stat, Field, Loading, Notice } from "@/components/ui";
import type { OpeningBalance, Transaction } from "@/types";

function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function currentYear() {
  return new Date().getFullYear();
}

function formatMonth(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("default", { month: "long", year: "numeric" });
}

function methodLabel(method?: Transaction["method"]) {
  if (!method) return "—";
  return method[0].toUpperCase() + method.slice(1);
}

function LineItemTable({ items }: { items: ReportLineItem[] }) {
  if (items.length === 0) return <p className="text-sm text-muted">None this month.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="tbl">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Type</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td className="whitespace-nowrap text-muted">{formatDate(item.date)}</td>
              <td>
                {item.description}
                {item.note && <span className="block text-xs text-muted">{item.note}</span>}
              </td>
              <td className="text-muted">{methodLabel(item.method)}</td>
              <td className="num text-right">{naira(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function YearlySummaryCard({ report }: { report: YearlyReport }) {
  return (
    <Card title={`${report.year} summary`}>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-5">
        <Stat label="Opening balance" value={naira(report.openingBalance)} />
        <Stat label="Total dues" value={naira(report.totalDues)} />
        <Stat label="Total incoming" value={naira(report.totalIncoming)} tone="green" />
        <Stat label="Total outgoing" value={naira(report.totalOutgoing)} tone="red" />
        <Stat label="Balance" value={naira(report.closingBalance)} tone="purple" />
      </div>
      <p className="mt-4 text-xs text-muted">
        Doesn't include contributions (pledges, payments and external support). Those are tracked on the{" "}
        <Link href="/contributions" className="link">
          Contributions
        </Link>{" "}
        pages.
      </p>
    </Card>
  );
}

function OpeningBalanceCard({
  year,
  entry,
  canEdit,
  onSaved,
}: {
  year: number;
  entry: OpeningBalance | null;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [cash, setCash] = useState("");
  const [transfer, setTransfer] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setCash(entry ? String(entry.cash) : "");
    setTransfer(entry ? String(entry.transfer) : "");
    setNote(entry?.note ?? "");
    setError(null);
    setEditing(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const cashAmount = Number(cash || 0);
    const transferAmount = Number(transfer || 0);
    if (cashAmount < 0 || transferAmount < 0 || Number.isNaN(cashAmount + transferAmount)) {
      return setError("Amounts can't be negative.");
    }
    if (cashAmount + transferAmount === 0) {
      return setError("Enter the cash amount, the transfer amount, or both.");
    }
    setSaving(true);
    setError(null);
    try {
      await saveOpeningBalance({ year, cash: cashAmount, transfer: transferAmount, note, updatedBy: user.uid });
      setEditing(false);
      onSaved();
    } catch {
      setError("Couldn't save the opening balance. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title={`Opening balance ${year}`}
      description="Money carried over from the year before, as at 1 January. It's where this year's reports start from."
      action={
        canEdit && !editing ? (
          <button onClick={startEditing} className="btn-secondary btn-sm">
            {entry ? "Edit" : "Set opening balance"}
          </button>
        ) : undefined
      }
    >
      {editing ? (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="In cash (₦)">
              <input
                type="number"
                min={0}
                value={cash}
                onChange={(e) => setCash(e.target.value)}
                placeholder="0"
                className="input"
              />
            </Field>
            <Field label="In the account, by transfer (₦)">
              <input
                type="number"
                min={0}
                value={transfer}
                onChange={(e) => setTransfer(e.target.value)}
                placeholder="0"
                className="input"
              />
            </Field>
          </div>
          <p className="num text-sm text-muted">
            Total: <span className="font-semibold text-ink">{naira(Number(cash || 0) + Number(transfer || 0))}</span>
          </p>
          <Field label="Note (optional)" hint="e.g. who handed it over.">
            <input value={note} onChange={(e) => setNote(e.target.value)} className="input" />
          </Field>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex gap-2">
            <button disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Save opening balance"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      ) : entry ? (
        <div>
          <div className="grid grid-cols-3 gap-x-6">
            <Stat label="Cash" value={naira(entry.cash)} />
            <Stat label="Transfer" value={naira(entry.transfer)} />
            <Stat label="Total" value={naira(openingTotal(entry))} tone="purple" />
          </div>
          {entry.note && <p className="mt-3 text-sm text-muted">{entry.note}</p>}
        </div>
      ) : (
        <p className="text-sm text-muted">
          No opening balance recorded for {year}.
          {canEdit && " Set it if money was carried over from last year."}
        </p>
      )}
    </Card>
  );
}

function FinanceInner() {
  const { user, hasPermission } = useAuth();
  const canEdit = hasPermission("canEditFinance");

  const [year, setYear] = useState(currentYear());
  const [yearlyReport, setYearlyReport] = useState<YearlyReport | null>(null);

  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<Transaction["type"]>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => todayISO());
  const [method, setMethod] = useState<Transaction["method"]>("cash");
  const [saving, setSaving] = useState(false);

  // PDF export
  const [pdfNotes, setPdfNotes] = useState("");
  const [downloading, setDownloading] = useState<"month" | "quarter" | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  async function refreshMonthly() {
    setLoading(true);
    setReport(await generateMonthlyReport(yearMonth));
    setLoading(false);
  }

  async function refreshYearly() {
    setYearlyReport(await generateYearlyReport(year));
  }

  useEffect(() => {
    refreshMonthly();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearMonth]);

  useEffect(() => {
    refreshYearly();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const [selYear, selMonth] = yearMonth.split("-").map(Number);
  const selQuarter = (Math.floor((selMonth - 1) / 3) + 1) as 1 | 2 | 3 | 4;

  async function handleDownloadMonth() {
    if (!report) return;
    setDownloading("month");
    setPdfError(null);
    try {
      await downloadMonthlyReportPdf(report, { notes: pdfNotes });
    } catch {
      setPdfError("Couldn't create the PDF. Try again.");
    } finally {
      setDownloading(null);
    }
  }

  async function handleDownloadQuarter() {
    setDownloading("quarter");
    setPdfError(null);
    try {
      const quarterly = await generateQuarterlyReport(selYear, selQuarter);
      await downloadQuarterlyReportPdf(quarterly, { notes: pdfNotes });
    } catch {
      setPdfError("Couldn't create the PDF. Try again.");
    } finally {
      setDownloading(null);
    }
  }

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !description.trim() || !user) return;
    setSaving(true);
    await createTransaction({
      type,
      category: "other",
      amount: Number(amount),
      description,
      note,
      date,
      method,
      createdBy: user.uid,
    });
    setAmount("");
    setDescription("");
    setNote("");
    setShowForm(false);
    setSaving(false);
    refreshMonthly();
    refreshYearly();
  }

  return (
    <Page size="md">
      <PageHeader
        title="Financial report"
        description="Yearly totals and a month-by-month breakdown of what came in and went out."
        actions={
          canEdit && (
            <button onClick={() => setShowForm((s) => !s)} className={showForm ? "btn-secondary" : "btn-primary"}>
              {showForm ? "Cancel" : "Add entry"}
            </button>
          )
        }
      />

      <div className="space-y-6">
        <Notice tone="info">
          Recording monthly dues? Use the{" "}
          <Link href="/dues" className="link">
            Dues
          </Link>{" "}
          page instead. It's tied to each youth and splits a payment across the months it covers. This
          form is for everything else: purchases, donations and one-off income.
        </Notice>

        {showForm && (
          <Card title="Add entry">
            <form onSubmit={handleAddEntry} className="space-y-4">
              <fieldset>
                <legend className="label">Type</legend>
                <div className="flex gap-5 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="entry-type"
                      checked={type === "income"}
                      onChange={() => setType("income")}
                      className="accent-rccg-green-600"
                    />
                    Income
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="entry-type"
                      checked={type === "expense"}
                      onChange={() => setType("expense")}
                      className="accent-rccg-green-600"
                    />
                    Expense
                  </label>
                </div>
              </fieldset>

              <Field label="Description">
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Gloves and face masks"
                  className="input"
                  required
                />
              </Field>

              <Field label="Note (optional)" hint="Shown in the Notes column of the PDF, e.g. “For Youth Sanitation”.">
                <input value={note} onChange={(e) => setNote(e.target.value)} className="input" />
              </Field>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Amount (₦)">
                  <input
                    type="number"
                    min={0}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="input"
                    required
                  />
                </Field>
                <Field label="Method">
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as Transaction["method"])}
                    className="input"
                  >
                    <option value="cash">Cash</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </Field>
                <Field label="Date">
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
                </Field>
              </div>

              <button disabled={saving} className="btn-primary">
                {saving ? "Saving…" : "Save entry"}
              </button>
            </form>
          </Card>
        )}

        <div className="flex items-center gap-2">
          <label htmlFor="report-year" className="text-sm font-medium">
            Year
          </label>
          <select
            id="report-year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="input w-auto"
          >
            {Array.from({ length: 5 }, (_, i) => currentYear() - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {yearlyReport && <YearlySummaryCard report={yearlyReport} />}

        {yearlyReport && (
          <OpeningBalanceCard
            year={year}
            entry={yearlyReport.openingEntry}
            canEdit={canEdit}
            onSaved={() => {
              refreshYearly();
              refreshMonthly();
            }}
          />
        )}

        <Card
          title={report ? formatMonth(report.yearMonth) : "Monthly report"}
          action={
            report && (
              <div className="flex flex-wrap justify-end gap-2">
                <button onClick={handleDownloadMonth} disabled={downloading !== null} className="btn-secondary btn-sm">
                  {downloading === "month" ? "Preparing…" : "Download PDF"}
                </button>
                <button onClick={handleDownloadQuarter} disabled={downloading !== null} className="btn-secondary btn-sm">
                  {downloading === "quarter" ? "Preparing…" : `Q${selQuarter} ${selYear} PDF`}
                </button>
              </div>
            )
          }
        >
          <div className="mb-5 flex items-center gap-2">
            <label htmlFor="report-month" className="text-sm font-medium">
              Month
            </label>
            <input
              id="report-month"
              type="month"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              className="input w-auto"
            />
          </div>

          <Field
            label="Notes for the PDF (optional)"
            hint="Printed at the bottom of the downloaded report, e.g. cash handed over to the treasurer."
            className="mb-5"
          >
            <textarea value={pdfNotes} onChange={(e) => setPdfNotes(e.target.value)} rows={2} className="input" />
          </Field>
          {pdfError && <Notice tone="error" className="mb-4">{pdfError}</Notice>}

          {loading || !report ? (
            <Loading />
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-rccg-green-700">Incoming</h3>
                <LineItemTable items={report.incomingBreakdown} />
                <p className="num mt-2 text-right text-sm font-semibold">
                  Total incoming {naira(report.totalIncoming)}
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-rccg-red-600">Outgoing</h3>
                <LineItemTable items={report.outgoingBreakdown} />
                <p className="num mt-2 text-right text-sm font-semibold">
                  Total outgoing {naira(report.totalOutgoing)}
                </p>
              </div>

              <div className="panel text-sm">
                <div className="flex justify-between py-0.5">
                  <span className="text-muted">Opening balance</span>
                  <span className="num">{naira(report.openingBalance)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted">Total incoming</span>
                  <span className="num text-rccg-green-700">+{naira(report.totalIncoming)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted">Total outgoing</span>
                  <span className="num text-rccg-red-600">-{naira(report.totalOutgoing)}</span>
                </div>
                <div className="mt-1.5 flex justify-between border-t border-line pt-2 font-semibold">
                  <span>Closing balance</span>
                  <span className="num">{naira(report.closingBalance)}</span>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}

export default function FinancePage() {
  return (
    <RequireAuth>
      <FinanceInner />
    </RequireAuth>
  );
}
