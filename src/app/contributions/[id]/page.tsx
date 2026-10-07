"use client";

import { useEffect, useState } from "react";
import {
  getContribution,
  getPledges,
  listExternalSupport,
  computeStats,
  updateContribution,
} from "@/lib/contributions";
import { listExcos } from "@/lib/excos";
import { listYouths } from "@/lib/youths";
import { useAuth } from "@/lib/useAuth";
import { formatPersonName } from "@/lib/formatName";
import { formatDate, naira, pluralize } from "@/lib/format";
import {
  contributionPeriod,
  contributionStartDate,
  contributionTiming,
  getContributionStatus,
} from "@/lib/contributionStatus";
import RequireAuth from "@/components/RequireAuth";
import PledgeTable from "@/components/PledgeTable";
import ExternalSupportList from "@/components/ExternalSupportList";
import { Page, PageHeader, Card, Stat, Field, Loading, Notice } from "@/components/ui";
import {
  ContributionBar,
  ContributionLegend,
  ContributionStatusBadge,
} from "@/components/ContributionProgress";
import type { Contribution, Pledge, ExternalSupport, ExcoMember, Youth } from "@/types";

function ContributionDetailInner({ id }: { id: string }) {
  const { hasPermission } = useAuth();
  const [contribution, setContribution] = useState<Contribution | null>(null);
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [externalSupport, setExternalSupport] = useState<ExternalSupport[]>([]);
  const [excos, setExcos] = useState<ExcoMember[]>([]);
  const [youths, setYouths] = useState<Youth[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingInCharge, setEditingInCharge] = useState(false);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const [editingDates, setEditingDates] = useState(false);
  const [startDraft, setStartDraft] = useState("");
  const [endDraft, setEndDraft] = useState("");
  const [savingDates, setSavingDates] = useState(false);
  const [datesError, setDatesError] = useState<string | null>(null);

  const canEdit = hasPermission("canEditFinance");

  // `silent` skips the full-page loading state, so editing a pledge (or its
  // items) doesn't blank the page and close whatever panel is open.
  async function refresh(silent = false) {
    if (!silent) setLoading(true);
    const [contributionData, pledgeData, externalSupportData, excoData, youthData] = await Promise.all([
      getContribution(id),
      getPledges(id),
      listExternalSupport(id),
      listExcos({ activeOnly: true }),
      listYouths({ activeOnly: true }),
    ]);
    setContribution(contributionData);
    setPledges(pledgeData);
    setExternalSupport(externalSupportData);
    setExcos(excoData);
    setYouths(youthData);
    setNotes(contributionData?.notes ?? "");
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function excoName(excoId: string) {
    const exco = excos.find((e) => e.id === excoId);
    return exco ? formatPersonName(exco.name, exco.gender) : "—";
  }

  async function handleInChargeChange(excoId: string) {
    await updateContribution(id, { inChargeOf: excoId });
    setEditingInCharge(false);
    refresh();
  }

  async function saveNotes() {
    setSavingNotes(true);
    await updateContribution(id, { notes });
    setSavingNotes(false);
  }

  function startEditingDates() {
    if (!contribution) return;
    setStartDraft(contributionStartDate(contribution));
    setEndDraft(contribution.endDate ?? "");
    setDatesError(null);
    setEditingDates(true);
  }

  async function saveDates() {
    if (!contribution) return;
    if (!startDraft) return setDatesError("Choose a start date.");
    if (endDraft && endDraft < startDraft) return setDatesError("The end date can't be before the start date.");

    setSavingDates(true);
    setDatesError(null);
    try {
      // `null` removes the end date, which re-opens the contribution.
      await updateContribution(id, { startDate: startDraft, endDate: endDraft || null });
      setContribution({ ...contribution, startDate: startDraft, endDate: endDraft || undefined });
      setEditingDates(false);
    } catch {
      setDatesError("Couldn't save the dates. Try again.");
    } finally {
      setSavingDates(false);
    }
  }

  if (loading)
    return (
      <Page size="md">
        <Loading />
      </Page>
    );
  if (!contribution)
    return (
      <Page size="md">
        <Notice tone="error">Contribution not found.</Notice>
      </Page>
    );

  const stats = computeStats(pledges, externalSupport);
  const status = getContributionStatus(contribution);
  const owing = stats.partlyRedeemedCount + stats.unpaidCount;

  return (
    <Page size="md">
      <PageHeader title={contribution.title} backHref="/contributions" backLabel="Contributions">
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
          <ContributionStatusBadge contribution={contribution} />
          <span>{contributionPeriod(contribution)}</span>
          <span>{contributionTiming(contribution)}</span>
        </div>
      </PageHeader>

      <div className="space-y-6">
        <Card>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
            <Stat
              label="Total received"
              value={naira(stats.totalReceived)}
              tone="green"
              hint={
                stats.percentReceived !== null ? `${stats.percentReceived}% of the pledged total` : undefined
              }
            />
            <Stat
              label="Total pledged"
              value={naira(stats.totalPledged)}
              hint={stats.pledgerCount > 0 ? `from ${pluralize(stats.pledgerCount, "youth")}` : "No pledges yet"}
            />
            <Stat
              label="Outstanding pledges"
              value={naira(stats.outstanding)}
              tone={stats.outstanding > 0 ? "red" : "default"}
              hint={
                owing > 0
                  ? `${pluralize(owing, "youth")} still to give`
                  : stats.pledgerCount > 0
                  ? "All pledges paid"
                  : undefined
              }
            />
            <Stat
              label="Pledges fulfilled"
              value={`${stats.fullyRedeemedCount} of ${stats.pledgerCount}`}
              hint={
                stats.unpledgedGiverCount > 0
                  ? `${pluralize(stats.unpledgedGiverCount, "youth")} gave without a pledge`
                  : undefined
              }
            />
          </div>

          <div className="mt-6">
            <ContributionBar stats={stats} className="h-3.5" />
            <ContributionLegend stats={stats} />
          </div>
        </Card>

        {status === "ended" && (
          <Notice tone="info">
            This contribution ended on {formatDate(contribution.endDate)}. Late pledges and payments can
            still be recorded.
            {stats.outstanding > 0 && ` ${naira(stats.outstanding)} in pledges hasn't been paid yet.`}
          </Notice>
        )}

        {stats.itemTotals.length > 0 && (
          <Card title="Items pledged" description="Everything pledged as items, added up per item.">
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right">Pledged</th>
                    <th className="text-right">Received</th>
                    <th className="text-right">Still to come</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.itemTotals.map((t) => {
                    const remaining = Math.max(0, t.pledged - t.received);
                    return (
                      <tr key={t.name.toLowerCase()}>
                        <td className="font-medium">{t.name}</td>
                        <td className="num text-right">{t.pledged}</td>
                        <td className="num text-right">{t.received}</td>
                        <td
                          className={`num text-right ${remaining > 0 ? "font-medium text-rccg-red-600" : "text-muted"}`}
                        >
                          {remaining > 0 ? remaining : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {stats.externalItemTotals.length > 0 && (
          <Card
            title="Items from external supporters"
            description="Everything given as items by people outside the youth roster, added up per item."
          >
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right">Received</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.externalItemTotals.map((t) => (
                    <tr key={`${t.name}|${t.unit ?? ""}`}>
                      <td className="font-medium">{t.name}</td>
                      <td className="num text-right">
                        {Number.isInteger(t.received) ? t.received : t.received.toFixed(1)}
                        {t.unit ? ` ${t.unit}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Card
          title="Details"
          action={
            canEdit &&
            !editingDates && (
              <button onClick={startEditingDates} className="btn-ghost">
                Edit dates
              </button>
            )
          }
        >
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted">Start date</dt>
              <dd className="mt-0.5 font-medium">{formatDate(contributionStartDate(contribution))}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">End date</dt>
              <dd className="mt-0.5 font-medium">
                {contribution.endDate ? formatDate(contribution.endDate) : "Not set"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">In charge of collecting</dt>
              <dd className="mt-0.5 font-medium">
                {canEdit && editingInCharge ? (
                  <select
                    autoFocus
                    defaultValue={contribution.inChargeOf}
                    onChange={(e) => handleInChargeChange(e.target.value)}
                    onBlur={() => setEditingInCharge(false)}
                    className="input"
                  >
                    {excos.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {formatPersonName(ex.name, ex.gender)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    {excoName(contribution.inChargeOf)}
                    {canEdit && (
                      <button onClick={() => setEditingInCharge(true)} className="btn-ghost ml-1">
                        Change
                      </button>
                    )}
                  </>
                )}
              </dd>
            </div>
          </dl>

          {editingDates && (
            <div className="panel mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Start date">
                  <input
                    type="date"
                    value={startDraft}
                    onChange={(e) => setStartDraft(e.target.value)}
                    className="input"
                  />
                </Field>
                <Field label="End date">
                  <input
                    type="date"
                    value={endDraft}
                    min={startDraft || undefined}
                    onChange={(e) => setEndDraft(e.target.value)}
                    className="input"
                  />
                </Field>
              </div>
              <p className="hint">
                The contribution shows as ended once the end date has passed. It doesn't stop anyone
                from pledging or paying afterwards. Remove the end date to reopen it.
              </p>
              {datesError && <Notice tone="error">{datesError}</Notice>}
              <div className="flex flex-wrap gap-2">
                <button onClick={saveDates} disabled={savingDates} className="btn-primary btn-sm">
                  {savingDates ? "Saving…" : "Save dates"}
                </button>
                <button onClick={() => setEditingDates(false)} className="btn-secondary btn-sm">
                  Cancel
                </button>
                {endDraft && (
                  <button onClick={() => setEndDraft("")} className="btn-ghost">
                    Remove end date
                  </button>
                )}
              </div>
            </div>
          )}
        </Card>

        <Card
          title="Pledges and payments"
          description={
            canEdit
              ? "Pledges can be money, items, or both. Edit a pledge, record payments against it, or track the items as they're brought in. Payments can be topped up any time."
              : undefined
          }
        >
          <PledgeTable
            contributionId={id}
            pledges={pledges}
            youths={youths}
            canEdit={canEdit}
            onChange={() => refresh(true)}
          />
        </Card>

        <Card title="External support">
          <ExternalSupportList
            contributionId={id}
            externalSupport={externalSupport}
            canEdit={canEdit}
            onChange={() => refresh(true)}
          />
        </Card>

        <Card title="Notes">
          {canEdit ? (
            <div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="input"
                placeholder="Optional notes…"
              />
              <button onClick={saveNotes} disabled={savingNotes} className="btn-primary btn-sm mt-3">
                {savingNotes ? "Saving…" : "Save notes"}
              </button>
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-sm text-muted">{contribution.notes || "No notes."}</p>
          )}
        </Card>
      </div>
    </Page>
  );
}

export default function ContributionDetailPage({ params }: { params: { id: string } }) {
  return (
    <RequireAuth>
      <ContributionDetailInner id={params.id} />
    </RequireAuth>
  );
}
