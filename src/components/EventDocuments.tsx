"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DOCUMENT_KIND_LABEL,
  createEventDocument,
  newDocumentData,
  suggestedSignatories,
} from "@/lib/eventDocuments";
import { fallbackRoleLabel } from "@/lib/roles";
import { formatDate } from "@/lib/format";
import { Badge, EmptyState, Field, Notice } from "@/components/ui";
import type { ChurchEvent, EventDocument, EventDocumentKind, ExcoMember } from "@/types";

interface Props {
  event: ChurchEvent;
  documents: EventDocument[];
  excos: ExcoMember[];
  createdBy: string;
  canEdit: boolean;
}

/** The event page's "Documents" card: the proposal and any sponsorship requests, plus buttons to start new ones. */
export default function EventDocuments({ event, documents, excos, createdBy, canEdit }: Props) {
  const router = useRouter();
  const [askingRecipient, setAskingRecipient] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(kind: EventDocumentKind) {
    setCreating(true);
    setError(null);
    try {
      const id = await createEventDocument(
        event.id,
        newDocumentData({
          kind,
          event,
          createdBy,
          recipientName: recipient,
          signatories: suggestedSignatories(excos, fallbackRoleLabel),
        })
      );
      router.push(`/events/${event.id}/documents/${id}`);
    } catch {
      setError("Couldn't create the document. Try again.");
      setCreating(false);
    }
  }

  const hasProposal = documents.some((d) => d.kind === "proposal");

  return (
    <div>
      {documents.length === 0 ? (
        <EmptyState
          title="No proposal or sponsorship request yet"
          description="A proposal makes the case for the event. A sponsorship request asks for support: it includes the budget and exactly what is needed."
        />
      ) : (
        <ul className="divide-y divide-line/70 rounded-lg border border-line">
          {documents.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <div className="min-w-0">
                <Link href={`/events/${event.id}/documents/${d.id}`} className="link">
                  {d.kind === "sponsorship" && d.recipientName
                    ? `${DOCUMENT_KIND_LABEL[d.kind]} to ${d.recipientName}`
                    : d.title}
                </Link>
                <p className="text-xs text-muted">
                  {DOCUMENT_KIND_LABEL[d.kind]} · {formatDate(d.documentDate)}
                </p>
              </div>
              <Badge tone={d.status === "signed" ? "green" : "amber"} dot>
                {d.status === "signed" ? "Signed" : "Draft"}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {error && <Notice tone="error" className="mt-3">{error}</Notice>}

      {canEdit && (
        <div className="mt-4">
          {askingRecipient ? (
            <div className="panel space-y-3">
              <Field label="Who is the request addressed to?" hint="A person, a company or an organisation. You can change it later.">
                <input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="input"
                  placeholder="e.g. The Managing Director, Sunrise Foods Ltd"
                  autoFocus
                />
              </Field>
              <div className="flex gap-2">
                <button onClick={() => create("sponsorship")} disabled={creating} className="btn-primary btn-sm">
                  {creating ? "Creating…" : "Create request"}
                </button>
                <button onClick={() => setAskingRecipient(false)} className="btn-secondary btn-sm">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => create("proposal")} disabled={creating} className="btn-secondary btn-sm">
                {hasProposal ? "New proposal" : "Write a proposal"}
              </button>
              <button onClick={() => setAskingRecipient(true)} disabled={creating} className="btn-secondary btn-sm">
                New sponsorship request
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
