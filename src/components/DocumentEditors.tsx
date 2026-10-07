"use client";

import { useState } from "react";
import SignaturePad from "@/components/SignaturePad";
import { newId } from "@/lib/eventDocuments";
import { formatDate, todayISO } from "@/lib/format";
import type {
  DocumentContact,
  DocumentSection,
  DocumentSignatory,
  ExcoMember,
  RequestedItem,
} from "@/types";

/* -------------------------------------------------------------------------
 * The list editors used by proposals and sponsorship requests. Each one
 * edits a plain array and hands the new array back through onChange — the
 * page holds the draft and saves it all at once.
 * ---------------------------------------------------------------------- */

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/* ------------------------------ sections -------------------------------- */

export function SectionsEditor({
  sections,
  canEdit,
  onChange,
}: {
  sections: DocumentSection[];
  canEdit: boolean;
  onChange: (sections: DocumentSection[]) => void;
}) {
  function update(id: string, patch: Partial<DocumentSection>) {
    onChange(sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  return (
    <div className="space-y-4">
      {sections.length === 0 && <p className="text-sm text-muted">No sections yet.</p>}
      {sections.map((section, i) => (
        <div key={section.id} className="rounded-lg border border-line p-3">
          <div className="flex items-center gap-2">
            <input
              value={section.heading}
              onChange={(e) => update(section.id, { heading: e.target.value })}
              disabled={!canEdit}
              placeholder="Section heading"
              aria-label="Section heading"
              className="input flex-1 font-medium"
            />
            {canEdit && (
              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => onChange(move(sections, i, i - 1))}
                  disabled={i === 0}
                  className="btn-ghost"
                  aria-label="Move section up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onChange(move(sections, i, i + 1))}
                  disabled={i === sections.length - 1}
                  className="btn-ghost"
                  aria-label="Move section down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onChange(sections.filter((s) => s.id !== section.id))}
                  className="btn-ghost-danger"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
          <textarea
            value={section.body}
            onChange={(e) => update(section.id, { body: e.target.value })}
            disabled={!canEdit}
            rows={5}
            placeholder="Write this section…"
            aria-label={`${section.heading || "Section"} text`}
            className="input mt-2"
          />
        </div>
      ))}
      {canEdit && (
        <div>
          <button
            type="button"
            onClick={() => onChange([...sections, { id: newId(), heading: "", body: "" }])}
            className="btn-secondary btn-sm"
          >
            Add a section
          </button>
          <p className="hint">
            Start a line with “- ” to make it a bullet point. Leave a blank line between paragraphs. The
            ₦ sign prints as “N” in the PDF.
          </p>
        </div>
      )}
    </div>
  );
}

/* --------------------------- items being requested ---------------------- */

export function RequestedItemsEditor({
  items,
  canEdit,
  onChange,
}: {
  items: RequestedItem[];
  canEdit: boolean;
  onChange: (items: RequestedItem[]) => void;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    if (!name.trim()) return setError("Enter the item.");
    if (!quantity.trim()) return setError("Say how much or how many, e.g. “3 packs”.");
    setError(null);
    onChange([...items, { id: newId(), name: name.trim(), quantity: quantity.trim(), ...(notes.trim() ? { notes: notes.trim() } : {}) }]);
    setName("");
    setQuantity("");
    setNotes("");
  }

  function update(id: string, patch: Partial<RequestedItem>) {
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  return (
    <div>
      {items.length === 0 ? (
        <p className="mb-3 text-sm text-muted">No items added yet.</p>
      ) : (
        <div className="mb-3 overflow-x-auto rounded-lg border border-line">
          <table className="tbl">
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Notes</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>
                    <input
                      value={it.name}
                      onChange={(e) => update(it.id, { name: e.target.value })}
                      disabled={!canEdit}
                      aria-label="Item"
                      className="input min-w-[9rem]"
                    />
                  </td>
                  <td>
                    <input
                      value={it.quantity}
                      onChange={(e) => update(it.id, { quantity: e.target.value })}
                      disabled={!canEdit}
                      aria-label="Quantity"
                      className="input min-w-[9rem]"
                    />
                  </td>
                  <td>
                    <input
                      value={it.notes ?? ""}
                      onChange={(e) => update(it.id, { notes: e.target.value })}
                      disabled={!canEdit}
                      aria-label="Notes"
                      className="input min-w-[9rem]"
                    />
                  </td>
                  {canEdit && (
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => onChange(items.filter((x) => x.id !== it.id))}
                        className="btn-ghost-danger"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && (
        <div>
          <div className="flex flex-wrap items-end gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Item, e.g. Rice"
              aria-label="New item"
              className="input min-w-[9rem] flex-1"
            />
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. A big or half bag"
              aria-label="New item quantity"
              className="input min-w-[9rem] flex-1"
            />
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              aria-label="New item notes"
              className="input min-w-[9rem] flex-1"
            />
            <button type="button" onClick={add} className="btn-secondary">
              Add item
            </button>
          </div>
          {error && <p className="mt-1.5 text-sm text-rccg-red-600">{error}</p>}
          <p className="hint">Write the quantity the way you would say it: “A basket”, “3 packs”, “Half a pack”.</p>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- contacts ------------------------------ */

export function ContactsEditor({
  contacts,
  canEdit,
  onChange,
}: {
  contacts: DocumentContact[];
  canEdit: boolean;
  onChange: (contacts: DocumentContact[]) => void;
}) {
  function update(id: string, patch: Partial<DocumentContact>) {
    onChange(contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  return (
    <div className="space-y-2">
      {contacts.length === 0 && <p className="text-sm text-muted">No contact people added.</p>}
      {contacts.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center gap-2">
          <input
            value={c.name}
            onChange={(e) => update(c.id, { name: e.target.value })}
            disabled={!canEdit}
            placeholder="Name"
            aria-label="Contact name"
            className="input min-w-[9rem] flex-1"
          />
          <input
            value={c.role ?? ""}
            onChange={(e) => update(c.id, { role: e.target.value })}
            disabled={!canEdit}
            placeholder="Role, e.g. Secretary"
            aria-label="Contact role"
            className="input min-w-[9rem] flex-1"
          />
          <input
            value={c.phone ?? ""}
            onChange={(e) => update(c.id, { phone: e.target.value })}
            disabled={!canEdit}
            placeholder="Phone"
            aria-label="Contact phone"
            inputMode="tel"
            className="input w-40"
          />
          {canEdit && (
            <button
              type="button"
              onClick={() => onChange(contacts.filter((x) => x.id !== c.id))}
              className="btn-ghost-danger"
            >
              Remove
            </button>
          )}
        </div>
      ))}
      {canEdit && (
        <button
          type="button"
          onClick={() => onChange([...contacts, { id: newId(), name: "", role: "", phone: "" }])}
          className="btn-secondary btn-sm"
        >
          Add a contact
        </button>
      )}
    </div>
  );
}

/* ------------------------------- signatories ---------------------------- */

export function SignatoriesEditor({
  signatories,
  excos,
  titleFor,
  canEdit,
  onChange,
}: {
  signatories: DocumentSignatory[];
  excos: ExcoMember[];
  titleFor: (exco: ExcoMember) => string; // "President", "Youth Pastor"…
  canEdit: boolean; // false once the document is signed, or for people who can't edit events
  onChange: (signatories: DocumentSignatory[]) => void;
}) {
  const [signingId, setSigningId] = useState<string | null>(null);

  function update(id: string, patch: Partial<DocumentSignatory>) {
    onChange(signatories.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeSignature(id: string) {
    onChange(
      signatories.map((s) => {
        if (s.id !== id) return s;
        const { signatureDataUrl, signedOn, ...rest } = s;
        void signatureDataUrl;
        void signedOn;
        return rest;
      })
    );
  }

  function addFromExco(excoId: string) {
    const exco = excos.find((e) => e.id === excoId);
    if (!exco) return;
    onChange([...signatories, { id: newId(), name: exco.name, title: titleFor(exco) }]);
  }

  return (
    <div className="space-y-3">
      {signatories.map((s) => (
        <div key={s.id} className="rounded-lg border border-line p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={s.name}
              onChange={(e) => update(s.id, { name: e.target.value })}
              disabled={!canEdit}
              placeholder="Full name"
              aria-label="Signatory name"
              className="input min-w-[10rem] flex-1"
            />
            <input
              value={s.title}
              onChange={(e) => update(s.id, { title: e.target.value })}
              disabled={!canEdit}
              placeholder="Title, e.g. President"
              aria-label="Signatory title"
              className="input min-w-[10rem] flex-1"
            />
            {canEdit && (
              <button
                type="button"
                onClick={() => onChange(signatories.filter((x) => x.id !== s.id))}
                className="btn-ghost-danger"
              >
                Remove
              </button>
            )}
          </div>

          <div className="mt-3">
            {signingId === s.id ? (
              <SignaturePad
                onCancel={() => setSigningId(null)}
                onSave={(dataUrl) => {
                  update(s.id, { signatureDataUrl: dataUrl, signedOn: todayISO() });
                  setSigningId(null);
                }}
              />
            ) : s.signatureDataUrl ? (
              <div className="flex flex-wrap items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.signatureDataUrl}
                  alt={`Signature of ${s.name || "signatory"}`}
                  className="h-14 rounded border border-line bg-white px-2"
                />
                <span className="text-sm text-muted">Signed {formatDate(s.signedOn)}</span>
                {canEdit && (
                  <>
                    <button type="button" onClick={() => setSigningId(s.id)} className="btn-ghost">
                      Sign again
                    </button>
                    <button type="button" onClick={() => removeSignature(s.id)} className="btn-ghost-danger">
                      Remove signature
                    </button>
                  </>
                )}
              </div>
            ) : canEdit ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSigningId(s.id)}
                  disabled={!s.name.trim()}
                  className="btn-secondary btn-sm"
                >
                  Sign
                </button>
                <span className="text-xs text-muted">
                  {s.name.trim()
                    ? "Hand the device to them to sign, or leave it blank to sign the printed copy by hand."
                    : "Enter their name first."}
                </span>
              </div>
            ) : (
              <span className="text-sm text-muted">Not signed yet</span>
            )}
          </div>
        </div>
      ))}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onChange([...signatories, { id: newId(), name: "", title: "" }])}
            className="btn-secondary btn-sm"
          >
            Add a signatory
          </button>
          {excos.length > 0 && (
            <select
              value=""
              onChange={(e) => e.target.value && addFromExco(e.target.value)}
              aria-label="Add a signatory from the excos"
              className="input w-auto"
            >
              <option value="">Add from the excos…</option>
              {excos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({titleFor(e)})
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}
