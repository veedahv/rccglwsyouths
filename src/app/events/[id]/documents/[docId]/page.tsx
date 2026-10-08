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
import { createEventDocumentPdfBytes, downloadEventDocumentPdf } from "@/lib/eventDocumentPdf";
import { fallbackRoleLabel } from "@/lib/roles";
import { formatDate, formatDateTime, naira } from "@/lib/format";
import { useAuth } from "@/lib/useAuth";
import RequireAuth from "@/components/RequireAuth";
import Modal, { ConfirmDialog } from "@/components/Modal";
import PdfPreview from "@/components/PdfPreview";
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
  const [preview, setPreview] = useState<ArrayBuffer | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirm, setConfirm] = useState<"reopen" | "delete" | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

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
  const isVisit = draft.kind === "visit";
  const isLetter = isSponsorship || isVisit; // addressed to someone
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

  async function persist(next: EventDocument, success: string): Promise<boolean> {
    setSaving(true);
    setMessage(null);
    try {
      await saveEventDocument(eventId, documentId, strip(next));
      setDraft(next);
      setSavedJson(JSON.stringify(strip(next)));
      setMessage({ tone: "success", text: success });
      return true;
    } catch {
      setMessage({ tone: "error", text: "Couldn't save. Check your connection and try again." });
      return false;
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
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      const ok = await persist(
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
      if (ok) setConfirm(null);
      else setConfirmError("Couldn't reopen it. Check your connection and try again.");
    } finally {
      setConfirmBusy(false);
    }
  }

  // Builds the PDF from what's on screen right now (saved or not) and shows it in a dialog.
  async function handlePreview() {
    if (!draft || !event) return;
    setPreviewing(true);
    try {
      setPreview(await createEventDocumentPdfBytes(draft, event, { ownerNames }));
    } catch {
      setMessage({ tone: "error", text: "Couldn't build the preview. Try again." });
    } finally {
      setPreviewing(false);
    }
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
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      await deleteEventDocument(eventId, documentId);
      router.push(`/events/${eventId}`);
    } catch {
      setConfirmError("Couldn't delete this. Check your connection and try again.");
      setConfirmBusy(false);
    }
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
            <button onClick={handlePreview} disabled={previewing} className="btn-secondary btn-sm">
              {previewing ? "Preparing…" : "Preview"}
            </button>
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
                <button onClick={() => { setConfirmError(null); setConfirm("reopen"); }} disabled={saving} className="link">
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
            {draft.kind === "proposal" && (
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

        {isLetter && (
          <Card
            title="Addressed to"
            description={isVisit ? "The place you are asking to visit. The venue from the event is filled in for you." : undefined}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name or title">
                <input
                  value={draft.recipientName ?? ""}
                  onChange={(e) => set({ recipientName: e.target.value })}
                  disabled={!canEdit}
                  placeholder={isVisit ? "e.g. The Director" : "e.g. The Managing Director"}
                  className="input"
                />
              </Field>
              <Field label={isVisit ? "Home or organisation" : "Company or organisation"}>
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
              : isVisit
                ? "The letter itself. Your contact people are added before the last section, and a reply slip follows the signatures."
                : "Every section can be renamed, moved or removed. The event’s agenda is printed after the programme section automatically."
          }
        >
          <SectionsEditor
            sections={draft.sections}
            canEdit={canEdit}
            onChange={(sections) => set({ sections })}
          />
        </Card>

        {draft.kind === "proposal" && (
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

        {isVisit && (
          <Card title="Contact and reply" description="So they know who to call or reply to.">
            <div className="space-y-5">
              <div>
                <span className="label">Who to contact</span>
                <ContactsEditor
                  contacts={draft.contacts ?? []}
                  canEdit={canEdit}
                  onChange={(contacts) => set({ contacts })}
                />
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={draft.includeReplySlip !== false}
                  onChange={(e) => set({ includeReplySlip: e.target.checked })}
                  disabled={!canEdit}
                />
                <span>
                  Add a reply slip after the signatures
                  <span className="hint block">
                    They tick whether the date suits them (or suggest another), add any rules or items needed,
                    and sign and stamp it, so you can get a clear answer back.
                  </span>
                </span>
              </label>
            </div>
          </Card>
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
              <button onClick={() => { setConfirmError(null); setConfirm("delete"); }} className="btn-ghost-danger">
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
      {preview && (
        <Modal
          open
          size="xl"
          title={`Preview: ${draft.title || DOCUMENT_KIND_LABEL[draft.kind]}`}
          onClose={() => setPreview(null)}
          footer={
            <>
              <span className="mr-auto self-center text-xs text-muted">
                {dirty ? "Shows your changes, including ones not saved yet." : "Shows the document as saved."}
              </span>
              <button onClick={handleDownload} disabled={downloading} className="btn-secondary btn-sm">
                {downloading ? "Preparing…" : "Download PDF"}
              </button>
              <button onClick={() => setPreview(null)} className="btn-primary btn-sm">
                Close
              </button>
            </>
          }
        >
          <PdfPreview data={preview} />
        </Modal>
      )}

      {confirm && (
        <ConfirmDialog
          open
          title={confirm === "delete" ? "Delete this document?" : "Reopen for editing?"}
          subject={{ name: draft.title || DOCUMENT_KIND_LABEL[draft.kind] }}
          tone={confirm === "delete" ? "danger" : "primary"}
          confirmLabel={confirm === "delete" ? "Delete" : "Reopen"}
          busyLabel={confirm === "delete" ? "Deleting…" : "Reopening…"}
          busy={confirmBusy}
          error={confirmError}
          description={
            confirm === "delete"
              ? "This can't be undone."
              : "Changing a signed document makes the signatures invalid, so they will be cleared and everyone signs again."
          }
          onConfirm={confirm === "delete" ? handleDelete : handleReopen}
          onCancel={() => !confirmBusy && setConfirm(null)}
        />
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
