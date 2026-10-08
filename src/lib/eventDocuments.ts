import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  getDoc,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import { todayISO } from "./format";
import { budgetTotal } from "./events";
import type {
  BudgetItem,
  ChurchEvent,
  DocumentSection,
  DocumentSignatory,
  EventDocument,
  EventDocumentKind,
  ExcoMember,
  NeededItem,
} from "@/types";

/* ---------------------------------------------------------------------------
 * Proposals and sponsorship requests live at /events/{eventId}/documents/{id}.
 * ------------------------------------------------------------------------ */

export const DOCUMENT_KIND_LABEL: Record<EventDocumentKind, string> = {
  proposal: "Proposal",
  sponsorship: "Sponsorship request",
  visit: "Visit request",
};

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function documentsCol(eventId: string) {
  return collection(db, `events/${eventId}/documents`);
}

export async function listEventDocuments(eventId: string): Promise<EventDocument[]> {
  const snap = await getDocs(query(documentsCol(eventId), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EventDocument, "id">) }));
}

export async function getEventDocument(eventId: string, documentId: string): Promise<EventDocument | null> {
  const snap = await getDoc(doc(db, `events/${eventId}/documents/${documentId}`));
  return snap.exists() ? { id: snap.id, ...(snap.data() as Omit<EventDocument, "id">) } : null;
}

/** Removes `undefined` values (Firestore rejects them) from a plain object, one level deep. */
function clean<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as T;
}

export async function createEventDocument(
  eventId: string,
  data: Omit<EventDocument, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const now = new Date().toISOString();
  const ref = await addDoc(documentsCol(eventId), clean({ ...data, createdAt: now, updatedAt: now }));
  return ref.id;
}

/**
 * Saves the whole editable document in one write. Everything on the page
 * is part of one letter, so it saves together. A field left `undefined`
 * is removed from the stored document (e.g. the frozen budget when a
 * signed document is reopened), rather than silently kept.
 */
export async function saveEventDocument(
  eventId: string,
  documentId: string,
  data: Omit<EventDocument, "id" | "createdAt" | "createdBy">
): Promise<void> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries({ ...data, updatedAt: new Date().toISOString() })) {
    payload[key] = value === undefined ? deleteField() : value;
  }
  await updateDoc(doc(db, `events/${eventId}/documents/${documentId}`), payload);
}

export async function deleteEventDocument(eventId: string, documentId: string): Promise<void> {
  await deleteDoc(doc(db, `events/${eventId}/documents/${documentId}`));
}

/* ------------------------------ starting points ------------------------- */

function section(heading: string, body = ""): DocumentSection {
  return { id: newId(), heading, body };
}

/**
 * The sections a new proposal starts with. They're only a starting point —
 * every one can be renamed, reordered or removed, and more can be added.
 * No budget section on purpose: that belongs to the sponsorship request.
 */
export function proposalSections(): DocumentSection[] {
  return [
    section("Introduction", "Who we are, and what this proposal is about."),
    section("Background and rationale", "Why this event, and why now."),
    section("Aim and objectives", "- \n- \n- "),
    section("Target audience and expected attendance"),
    section("Programme of activities", "A summary of what will happen on the day. The agenda added to the event is printed after this section."),
    section("Expected outcomes", "- \n- "),
    section("Organising team and responsibilities"),
    section("Conclusion", "We trust this proposal receives your kind consideration and approval."),
  ];
}

/** The sections a new sponsorship request starts with. The budget and the list of what's needed are separate parts of the form. */
export function sponsorshipSections(): DocumentSection[] {
  return [
    section("About us", "A short introduction to the Youth Department, who we are and what we do."),
    section("About the event", "What the event is, who it is for and why it matters."),
    section("Why we are seeking your support", "Explain the need, and what your support will make possible."),
    section("How your support will be used", "- \n- "),
    section("How we will acknowledge your support", "- \n- "),
    section("Conclusion", "Thank you for taking the time to consider this request. We would be glad to provide any further information you may need."),
  ];
}

/** The sections a visit-request letter starts with: asking a home or organisation whether we may visit. */
export function visitSections(): DocumentSection[] {
  return [
    section(
      "About us",
      "We are the Youth Department of the Redeemed Christian Church of God, Living Water Sanctuary. We are a body of young people committed to serving God and making a positive difference in our community."
    ),
    section(
      "Purpose of our visit",
      "As part of our outreach, we would like to visit the children in your care, spend time with them, and share gifts and essential items with the home. Our aim is to show them love, care and encouragement."
    ),
    section(
      "What the visit will involve",
      "- Meeting and spending time with the children\n- Games, songs and conversation\n- Presenting food items, clothing and other supplies\n- A short time of prayer and encouragement, only if you are comfortable with it"
    ),
    section(
      "Our request",
      "We kindly request your permission to visit on the date and at the time stated above. Please let us know whether this is convenient, or suggest another date and time that suits you better. We would also appreciate your guidance on:\n- Any rules or guidelines we should observe during the visit\n- The items the children need most, and their sizes where relevant\n- Whether photographs may be taken, which we will do only with your permission"
    ),
    section(
      "Conclusion",
      "We would be grateful for your reply at your earliest convenience. You may use the reply slip at the end of this letter, or contact us on the numbers provided. Thank you for the work you do and for considering our request."
    ),
  ];
}

/** Titles of the people who usually sign: the roles worth pre-filling from the exco list. */
const SIGNING_ROLES = ["president", "secretary"];

/**
 * Suggested signatories: the president and secretary if they exist, and
 * any external admin titled as a pastor (e.g. "Youth Pastor"), since a
 * pastor's endorsement is normal on a request like this. All editable.
 */
export function suggestedSignatories(excos: ExcoMember[], roleLabel: (role: string) => string): DocumentSignatory[] {
  const active = excos.filter((e) => e.active);
  const picks: DocumentSignatory[] = [];
  for (const role of SIGNING_ROLES) {
    const exco = active.find((e) => e.role === role && !e.external);
    if (exco) picks.push({ id: newId(), name: exco.name, title: roleLabel(exco.role) });
  }
  for (const exco of active.filter((e) => e.external && /pastor/i.test(e.title ?? ""))) {
    picks.push({ id: newId(), name: exco.name, title: exco.title ?? "Pastor" });
  }
  // Always at least one line to sign on.
  return picks.length > 0 ? picks : [{ id: newId(), name: "", title: "" }];
}

export function newDocumentData(params: {
  kind: EventDocumentKind;
  event: ChurchEvent;
  createdBy: string;
  signatories: DocumentSignatory[];
  recipientName?: string;
}): Omit<EventDocument, "id" | "createdAt" | "updatedAt"> {
  const { kind, event, createdBy, signatories, recipientName } = params;
  const base = {
    kind,
    status: "draft" as const,
    documentDate: todayISO(),
    signatories,
    createdBy,
  };
  if (kind === "proposal") {
    return { ...base, title: `Proposal for ${event.title}`, sections: proposalSections() };
  }
  if (kind === "visit") {
    return {
      ...base,
      title: `Request for a visit: ${event.title}`,
      sections: visitSections(),
      recipientName: recipientName?.trim() || undefined,
      recipientOrganisation: event.venue?.trim() || undefined, // the place being visited
      includeReplySlip: true,
      contacts: [],
    };
  }
  return {
    ...base,
    title: `Request for sponsorship: ${event.title}`,
    sections: sponsorshipSections(),
    recipientName: recipientName?.trim() || undefined,
    includeBudget: true,
    requestedItemIds: [],
    contacts: [],
  };
}

/* ------------------------------ derived values -------------------------- */

/** The budget a sponsorship request shows: the frozen copy once signed, otherwise the event's live budget. */
export function documentBudget(document: EventDocument, event: ChurchEvent): BudgetItem[] {
  return document.budgetSnapshot ?? event.budget ?? [];
}

export function documentBudgetTotal(document: EventDocument, event: ChurchEvent): number {
  return budgetTotal(documentBudget(document, event));
}

/**
 * The items a sponsorship request asks for: the frozen copy once signed,
 * otherwise whichever of the event's needed items are ticked (so notes
 * such as "2 bags received" stay current while it's still a draft).
 */
export function documentItems(document: EventDocument, event: ChurchEvent): NeededItem[] {
  if (document.itemsSnapshot) return document.itemsSnapshot;
  const chosen = new Set(document.requestedItemIds ?? []);
  return (event.neededItems ?? []).filter((i) => chosen.has(i.id));
}

/** Everything a signed document needs to be complete — shown as a checklist before signing. */
export function documentProblems(document: EventDocument, event: ChurchEvent): string[] {
  const problems: string[] = [];
  if (!document.title.trim()) problems.push("Give it a title.");
  if (document.sections.every((s) => !s.body.trim())) problems.push("Write at least one section.");
  if (document.signatories.every((s) => !s.name.trim())) problems.push("Add who is signing.");
  if (document.kind === "visit" && !document.recipientName?.trim() && !document.recipientOrganisation?.trim()) {
    problems.push("Say who the letter is addressed to.");
  }
  if (document.kind === "sponsorship") {
    if (!document.recipientName?.trim()) problems.push("Say who the request is addressed to.");
    const hasCash = (document.cashRequested ?? 0) > 0;
    const hasItems = documentItems(document, event).length > 0;
    if (!hasCash && !hasItems) problems.push("State what you're asking for: an amount, or tick items from the event's list, or both.");
    if (document.includeBudget !== false && (event.budget?.length ?? 0) === 0 && !document.budgetSnapshot) {
      problems.push("The event has no budget yet. Add one on the event page, or switch the budget off for this letter.");
    }
  }
  return problems;
}
