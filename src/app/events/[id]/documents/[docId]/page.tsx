"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getEvent, budgetTotal } from "@/lib/events";
import { listExcos } from "@/lib/excos";
import {
  DOCUMENT_KIND_LABEL,
  deleteEventDocument,
  documentBudget,
  documentItems,
  documentProblems,
  getEventDocument,
  saveEventDocument,
} from "@/lib/eventDocuments";
import { downloadEventDocumentPdf } from "@/lib/eventDocumentPdf";
import { fallbackRoleLabel } from "@/lib/roles";
import { formatDate, formatDateTime, naira } from "@/lib/format";
import { useAuth } from "@/lib/useAuth";
import RequireAuth from "@/components/RequireAuth";
import {
  ContactsEditor,
  RequestedItemsPicker,
  SectionsEditor,
  SignatoriesEditor,
} from "@/components/DocumentEditors";
import { Page, PageHeader, Card, Badge, Field, Loading, Notice } from "@/components/ui";
import type { ChurchEvent, EventDocument, ExcoMember } from "@/types";

function strip(d: EventDocument) {
  const { id, createdAt, createdBy, ...rest } = d;
  void id;
  void createdAt;
  void createdBy;
  return rest;
}

function EventDocumentInner({ eventId, documentId }: { eventId: string; documentId: string }) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [event, setEvent] = useState<ChurchEvent | null>(null);
  const [excos, setExcos] = useState<ExcoMember[]>([]);
  const [draft, setDraft] = useState<EventDocument | null>(null);
  const [savedJson, setSavedJson] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const canEditEvents = hasPermission("canEditEvents");

  useEffect(() => {
    (async () => {
      const [eventData, documentData, excoData] = await Promise.all([
        getEvent(eventId),
        getEventDocument(eventId, documentId),
        listExcos({ activeOnly: true }),
      ]);
      setEvent(eventData);
      setExcos(excoData);
      setDraft(documentData);
      setSavedJson(documentData ? JSON.stringify(strip(documentData)) : "");
      setLoading(false);
    })();
  }, [eventId, documentId]);

  const dirty = draft ? JSON.stringify(strip(draft)) !== savedJson : false;

  // Don't lose a half-written letter to an accidental tab close.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const ownerNames = useMemo(() => Object.fromEntries(excos.map((e) => [e.id, e.name])), [excos]);

  if (loading) {
    return (
      <Page size="md">
        <Loading />
      </Page>
    );
  }
  if (!event || !draft) {
    return (
      <Page size="md">
        <Notice tone="error">Document not found.</Notice>
      </Page>
    );
  }

  const isSponsorship = draft.kind === "sponsorship";
  const signed = draft.status === "signed";
  const canEdit = canEditEvents && !signed;
  const budget = documentBudget(draft, event);
  const problems = documentProblems(draft, event);
  const named = draft.signatories.filter((s) => s.name.trim());
  const unsigned = named.filter((s) => !s.signatureDataUrl);
  const readyToSign = problems.length === 0 && named.length > 0 && unsigned.length === 0;

  function set(patch: Partial<EventDocument>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setMessage(null);
  }

  async function persist(next: EventDocument, success: string) {
    setSaving(true);
    setMessage(null);
    try {
      await saveEventDocument(eventId, documentId, strip(next));
      setDraft(next);
      setSavedJson(JSON.stringify(strip(next)));
      setMessage({ tone: "success", text: success });
    } catch {
      setMessage({ tone: "error", text: "Couldn't save. Check your connection and try again." });
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!draft) return;
    await persist(draft, "Saved.");
  }

  async function handleMarkSigned() {
    if (!draft || !event || !readyToSign) return;
    await persist(
      {
        ...draft,
        status: "signed",
        // A sponsorship request keeps the budget it was actually sent with,
        // even if the event's budget changes afterwards.
        ...(draft.kind === "sponsorship"
          ? { budgetSnapshot: event.budget ?? [], itemsSnapshot: documentItems(draft, event) }
          : {}),
      },
      "Marked as signed."
    );
  }

  async function handleReopen() {
    if (!draft) return;
    if (
      !window.confirm(
        "Reopen this for editing? Changing a signed document makes the signatures invalid, so they will be cleared and everyone signs again."
      )
    )
      return;
    await persist(
      {
        ...draft,
        status: "draft",
        budgetSnapshot: undefined,
        itemsSnapshot: undefined,
        signatories: draft.signatories.map(({ signatureDataUrl, signedOn, ...rest }) => {
          void signatureDataUrl;
          void signedOn;
          return rest;
        }),
      },
      "Reopened. The signatures were cleared."
    );
  }

  async function handleDownload() {
    if (!draft || !event) return;
    setDownloading(true);
    try {
      await downloadEventDocumentPdf(draft, event, { ownerNames });
    } catch {
      setMessage({ tone: "error", text: "Couldn't create the PDF. Try again." });
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this document? This can't be undone.")) return;
    await deleteEventDocument(eventId, documentId);
    router.push(`/events/${eventId}`);
  }

  return (
    <Page size="md">
      <PageHeader
        title={draft.title || DOCUMENT_KIND_LABEL[draft.kind]}
        backHref={`/events/${eventId}`}
        backLabel={event.title}
        description={`${DOCUMENT_KIND_LABEL[draft.kind]} · ${formatDate(event.date)}`}
        actions={
          <>
            <Badge tone={signed ? "green" : "amber"} dot>
              {signed ? "Signed" : "Draft"}
            </Badge>
            <button onClick={handleDownload} disabled={downloading} className="btn-secondary btn-sm">
              {downloading ? "Preparing…" : "Download PDF"}
            </button>
          </>
        }
      />

      <div className="space-y-6 pb-24">
        {signed && (
          <Notice tone="success">
            This {DOCUMENT_KIND_LABEL[draft.kind].toLowerCase()} has been signed and is locked.
            {canEditEvents && (
              <>
                {" "}
                <button onClick={handleReopen} disabled={saving} className="link">
                  Reopen for editing
                </button>
              </>
            )}
          </Notice>
        )}

        <Card title="Details">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title" className="sm:col-span-2">
              <input
                value={draft.title}
                onChange={(e) => set({ title: e.target.value })}
                disabled={!canEdit}
                className="input"
              />
            </Field>
            <Field label="Date of the document">
              <input
                type="date"
                value={draft.documentDate}
                onChange={(e) => set({ documentDate: e.target.value })}
                disabled={!canEdit}
                className="input"
              />
            </Field>
            <Field label="Reference (optional)">
              <input
                value={draft.ref ?? ""}
                onChange={(e) => set({ ref: e.target.value })}
                disabled={!canEdit}
                placeholder="e.g. LWS/YD/2026/014"
                className="input"
              />
            </Field>
            {!isSponsorship && (
              <Field label="Submitted to" className="sm:col-span-2">
                <input
                  value={draft.submittedTo ?? ""}
                  onChange={(e) => set({ submittedTo: e.target.value })}
                  disabled={!canEdit}
                  placeholder="e.g. The Pastor-in-Charge"
                  className="input"
                />
              </Field>
            )}
          </div>
          <p className="hint">
            The event’s title, theme, date and time, venue and expected attendance are taken from the event
            ({formatDateTime(event.date, event.time)}
            {event.venue ? ` · ${event.venue}` : " · no venue yet"}). Change them on the{" "}
            <Link href={`/events/${eventId}`} className="link">
              event page
            </Link>
            .
          </p>
        </Card>

        {isSponsorship && (
          <Card title="Addressed to">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name or title">
                <input
                  value={draft.recipientName ?? ""}
                  onChange={(e) => set({ recipientName: e.target.value })}
                  disabled={!canEdit}
                  placeholder="e.g. The Managing Director"
                  className="input"
                />
              </Field>
              <Field label="Company or organisation">
                <input
                  value={draft.recipientOrganisation ?? ""}
                  onChange={(e) => set({ recipientOrganisation: e.target.value })}
                  disabled={!canEdit}
                  className="input"
                />
              </Field>
              <Field label="Address (optional)" className="sm:col-span-2">
                <textarea
                  value={draft.recipientAddress ?? ""}
                  onChange={(e) => set({ recipientAddress: e.target.value })}
                  disabled={!canEdit}
                  rows={2}
                  className="input"
                />
              </Field>
            </div>
          </Card>
        )}

        <Card
          title="Content"
          description={
            isSponsorship
              ? "The letter itself. The budget and the list of what you need are added automatically before the last section."
              : "Every section can be renamed, moved or removed. The event’s agenda is printed after the programme section automatically."
          }
        >
          <SectionsEditor
            sections={draft.sections}
            canEdit={canEdit}
            onChange={(sections) => set({ sections })}
          />
        </Card>

        {!isSponsorship && (
          <Notice tone="info">
            A proposal doesn’t list a budget. Use a sponsorship request when you need to show costs and ask for support.
            {event.agenda.length > 0
              ? ` The ${event.agenda.length} agenda ${event.agenda.length === 1 ? "item" : "items"} on the event will be printed as the order of programme.`
              : " Add an agenda on the event page and it will be printed as the order of programme."}
          </Notice>
        )}

        {isSponsorship && (
          <>
            <Card
              title="Budget"
              description="Taken from the event’s budget. It is frozen the moment the request is signed."
              action={
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.includeBudget !== false}
                    onChange={(e) => set({ includeBudget: e.target.checked })}
                    disabled={!canEdit}
                  />
                  Show in the letter
                </label>
              }
            >
              {budget.length === 0 ? (
                <p className="text-sm text-muted">
                  The event has no budget yet.{" "}
                  <Link href={`/events/${eventId}`} className="link">
                    Add one on the event page
                  </Link>
                  .
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th className="text-right">Estimated cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budget.map((b) => (
                        <tr key={b.id}>
                          <td>{b.item}</td>
                          <td className="num text-right">{naira(b.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>Total</td>
                        <td className="num text-right">{naira(budgetTotal(budget))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Card>

            <Card
              title="What you are requesting"
              description="Cash, items, or both. Items are picked from the event’s “Items needed” list."
            >
              <div className="space-y-5">
                <Field label="Cash requested (₦)" hint="Leave blank if you are only asking for items.">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={draft.cashRequested ?? ""}
                      onChange={(e) =>
                        set({ cashRequested: e.target.value === "" ? null : Number(e.target.value) })
                      }
                      disabled={!canEdit}
                      className="input w-48"
                    />
                    {canEdit && budget.length > 0 && (
                      <button
                        type="button"
                        onClick={() => set({ cashRequested: budgetTotal(budget) })}
                        className="btn-secondary btn-sm"
                      >
                        Use the budget total ({naira(budgetTotal(budget))})
                      </button>
                    )}
                  </div>
                </Field>

                <div>
                  <span className="label">Items requested</span>
                  {(event.neededItems?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted">
                      The event has no items listed yet.{" "}
                      <Link href={`/events/${eventId}`} className="link">
                        Add them under “Items needed” on the event page
                      </Link>
                      , then tick the ones to ask this sponsor for.
                    </p>
                  ) : (
                    <>
                      <RequestedItemsPicker
                        items={signed ? documentItems(draft, event) : event.neededItems ?? []}
                        selectedIds={signed ? documentItems(draft, event).map((i) => i.id) : draft.requestedItemIds ?? []}
                        canEdit={canEdit}
                        onChange={(requestedItemIds) => set({ requestedItemIds })}
                      />
                      <p className="hint">
                        Tick what to ask this sponsor for. Quantities and notes come from the event’s list, so
                        update “what we’ve gotten” there and it shows here.
                      </p>
                    </>
                  )}
                </div>

                <Field label="Payment details (optional)" hint="Where cash should be paid, e.g. account name, number and bank.">
                  <textarea
                    value={draft.paymentDetails ?? ""}
                    onChange={(e) => set({ paymentDetails: e.target.value })}
                    disabled={!canEdit}
                    rows={3}
                    className="input"
                  />
                </Field>

                <div>
                  <span className="label">Who to contact</span>
                  <ContactsEditor
                    contacts={draft.contacts ?? []}
                    canEdit={canEdit}
                    onChange={(contacts) => set({ contacts })}
                  />
                </div>
              </div>
            </Card>
          </>
        )}

        <Card title="Signatures" description="Printed at the end of the document, each with their name and title.">
          <SignatoriesEditor
            signatories={draft.signatories}
            excos={excos}
            titleFor={(e) => e.title || fallbackRoleLabel(e.role)}
            canEdit={canEdit}
            onChange={(signatories) => set({ signatories })}
          />
        </Card>

        {canEditEvents && !signed && (
          <Card title="Finish">
            {readyToSign ? (
              <p className="mb-3 text-sm text-muted">
                Everyone has signed. Marking it as signed locks the document
                {isSponsorship ? " and freezes the budget and items it shows" : ""}.
              </p>
            ) : (
              <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-muted">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
                {unsigned.length > 0 && (
                  <li>
                    Still to sign: {unsigned.map((s) => s.name).join(", ")}. (If they will sign the printed
                    copy by hand, just download the PDF.)
                  </li>
                )}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <button onClick={handleMarkSigned} disabled={!readyToSign || saving || dirty} className="btn-primary btn-sm">
                Mark as signed
              </button>
              <button onClick={handleDelete} className="btn-ghost-danger">
                Delete document
              </button>
            </div>
            {dirty && readyToSign && <p className="hint">Save your changes first.</p>}
          </Card>
        )}
      </div>

      {canEdit && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 py-3 backdrop-blur md:left-64">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-muted" role="status">
              {message ? (
                <span className={message.tone === "error" ? "text-rccg-red-600" : "text-rccg-green-700"}>
                  {message.text}
                </span>
              ) : dirty ? (
                "You have unsaved changes."
              ) : (
                "All changes saved."
              )}
            </span>
            <button onClick={handleSave} disabled={!dirty || saving} className="btn-primary">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </Page>
  );
}

export default function EventDocumentPage({ params }: { params: { id: string; docId: string } }) {
  return (
    <RequireAuth>
      <EventDocumentInner eventId={params.id} documentId={params.docId} />
    </RequireAuth>
  );
}
