// Roles are no longer a fixed list. The built-in ones below always exist;
// anyone with "Manage excos and permissions" can add more from the Roles
// & Permissions page. A role's id is a slug (e.g. "youth_pastor") and is
// what's stored on each exco; its display name lives on
// /rolesConfig/{role}.label. What each role can DO is configured on that
// same doc (see RoleConfig below) — editing a role updates everyone who
// holds it at once, rather than each exco having their own independent
// checkboxes.
// super_admin is special: it always has full access, regardless of
// whatever /rolesConfig/super_admin says (see useAuth.hasPermission) —
// there's no way to lock a super_admin out via role config.
export type ExcoRole = string;

export type BuiltInRole =
  | "super_admin"
  | "president"
  | "vice_president"
  | "financial_secretary"
  | "secretary"
  | "pr";

export interface Permissions {
  canEditFinance: boolean;
  canEditMinutes: boolean;
  canEditEvents: boolean;
  canManageRoles: boolean;
}

// /rolesConfig/{role} — the permission set for everyone holding that role.
// `label` is the display name; built-in roles don't need it stored (their
// names come from lib/roles.ts), custom roles always do.
export interface RoleConfig {
  role: ExcoRole;
  label: string;
  permissions: Permissions;
}

// /accounts/{authUid} — links a Firebase Auth login to the exco record it
// belongs to. Excos can now exist BEFORE they have a login (a youth is
// set as an exco first and invited later), so an exco's doc ID can no
// longer be the auth uid. This tiny doc is how security rules and
// useAuth find "which exco is this signed-in person?". Excos created
// before this existed have no accounts doc, and their exco doc ID *is*
// their uid — both rules and useAuth fall back to that.
export interface AccountLink {
  excoId: string;
}

export interface ExcoMember {
  id: string; // stable record ID — NOT the auth uid (see `uid`)
  name: string;
  // Set when they're invited (or, for external admins, when they're
  // added). Optional because a youth set as an exco has no email yet.
  email?: string;
  phone?: string;
  gender?: "male" | "female";
  dob?: string; // ISO date, optional
  unit?: string; // e.g. Ushering, Choir
  role: ExcoRole;
  active: boolean; // false once retired
  joinedAt: string; // ISO date
  photoURL?: string;
  youthId?: string; // the youth roster entry this exco was set from (youth excos only)
  // Firebase Auth uid once they have a login; null until they're invited.
  // Always present after lib/excos.ts normalizes a doc (older docs that
  // predate this field are treated as already having a login).
  uid: string | null;
  invitedAt?: string; // ISO timestamp of the invite
  // External admins are non-youths (e.g. the church pastor, the youth
  // pastor) added directly on the Excos page. They're always super_admin
  // and have no youth roster entry. `title` is just how they're described.
  external?: boolean;
  title?: string; // e.g. "Youth Pastor" — display only, external admins
}

export type InactiveReason = "married" | "left_church" | "other";

// The general youth department roster — no login, just records. This is
// what dues, attendance, and contributions are tracked against. Excos
// are a separate, smaller set of admins that manage this roster. A youth
// becomes one by being SET as an exco (lib/excos.ts promoteYouthToExco) —
// that only records their role; they're invited to actually log in
// afterwards, from the Excos page. External admins (pastors etc.) aren't
// on this roster at all.
export interface Youth {
  id: string;
  name: string;
  phone?: string;
  gender?: "male" | "female";
  dob?: string;
  unit?: string;
  active: boolean;
  inactiveReason?: InactiveReason; // set when active is false
  joinedAt: string; // ISO date
  linkedExcoId?: string; // the exco record ID, set once this youth has been made an exco
}

export type PaymentMethod = "cash" | "transfer";

// A single payment event — a dues doc can have several of these if an
// exco tops up an already-paid month.
export interface Payment {
  amount: number;
  method: PaymentMethod;
  date: string; // ISO date
  recordedBy: string; // uid
  // Set once per recordDuesPayment() call and copied onto every month it
  // covers, so a single real-world payment that spans several months
  // (e.g. paying Jan+Feb+Mar at once) can be reassembled into one line
  // on the financial report — "Monthly dues from X for Jan, Feb and Mar"
  // — instead of showing as three separate, seemingly-unrelated entries.
  groupId?: string;
}

// /youths/{youthId}/dues/{yearMonth}  where yearMonth = "2026-04"
export interface DuesRecord {
  yearMonth: string;
  totalPaid: number;
  payments: Payment[];
}

// A contribution drive — e.g. "Pastor's Birthday 2026", "Love Feast" —
// tracked as pledges vs. what's actually been redeemed (given) per youth.
export interface Contribution {
  id: string;
  title: string; // what it's for
  inChargeOf: string; // excoId responsible for collecting
  notes?: string;
  // ISO dates (yyyy-MM-dd). These describe the drive's lifecycle only —
  // they never block anything. After endDate the contribution is shown as
  // "Ended", but late pledges and late payments can still be recorded
  // (e.g. the item's already been bought and a few people are settling up).
  // Contributions created before these fields existed have no startDate
  // and fall back to createdAt (see lib/contributionStatus.ts).
  startDate?: string;
  endDate?: string; // optional — unset while the drive is still open-ended
  createdBy: string; // excoId
  createdAt: string;
}

// Something a youth has pledged to bring instead of (or as well as) money —
// e.g. 10 chairs, 2 crates of drinks. `received` is how many have actually
// been brought so far.
export interface PledgedItem {
  id: string;
  name: string;
  quantity: number; // how many were pledged
  received: number; // how many have been brought so far
}

// /contributions/{contributionId}/pledges/{youthId}
// A pledge can be money, items, or both: pledgedAmount is 0 for an
// items-only pledge, and `items` is empty/absent for a money-only one.
export interface Pledge {
  youthId: string;
  pledgedAmount: number;
  redeemedAmount: number; // sum of `payments` below, denormalized
  payments: Payment[];
  items?: PledgedItem[]; // pledges made before items existed have none
}

// An item given by someone outside the youth roster — e.g. 3 packs of
// Maggi, half a bag of rice. `quantity` can be a half (0.5) so "half a
// bag" / "half a pack" can be recorded; `unit` is free text ("bags",
// "packs", "baskets") and optional, since some things just count ("5 pads").
export interface ExternalSupportItem {
  id: string;
  name: string;
  quantity: number;
  unit?: string;
}

// /contributions/{contributionId}/externalSupport/{supportId} — money
// and/or items given toward a contribution drive by someone who isn't on
// the youth roster (e.g. a parent or a pastor supporting the youths).
// Counts toward the drive's total received, but never toward total
// pledged — there's no pledge concept for external supporters, only
// direct giving. Money-only support has no `items`; items-only support has
// an `amount` of 0 (and its `method` is then just a default, unused).
export interface ExternalSupport {
  id: string;
  name: string; // free text — not a youth or exco
  amount: number; // 0 when only items were given
  method: PaymentMethod;
  date: string;
  items?: ExternalSupportItem[]; // older records predate items and have none
  recordedBy: string; // uid of the exco who recorded it
}

// Manual entries for everything that isn't a per-youth dues payment or a
// contribution-drive pledge/redemption — one-off purchases, donations,
// etc. Contributions (pledges, redemptions, external support) are
// tracked entirely under /contributions and never touch this collection
// or the financial report — they're recorded and reported separately.
export interface Transaction {
  id: string;
  type: "income" | "expense";
  category: "other";
  amount: number;
  description: string;
  note?: string; // optional context shown in the report's Notes column, e.g. "For Youth Sanitation"
  date: string;
  method?: PaymentMethod;
  createdBy: string;
  createdAt: string;
}

// /openingBalances/{year} — money carried over into the start of a year,
// for when the records only begin part-way through the money's life (e.g.
// the system started this year but last year's balance was moved across).
// It's the starting point for that year's reports: the balance on 1 Jan,
// split by how it's held. Anything recorded before that year is not added
// on top of it.
export interface OpeningBalance {
  year: number;
  cash: number; // ₦ held as cash
  transfer: number; // ₦ held in the account (transfers)
  note?: string; // e.g. "Handed over by the outgoing financial secretary"
  updatedBy: string; // uid
  updatedAt: string;
}

// Who a meeting is for, which decides who shows up on its attendance list:
//   excos    — the active excos (external admins aren't included)
//   youths   — every active youth
//   selected — a hand-picked group of youths (see attendeeIds)
// Meetings created before this existed have no audience and are treated
// as "youths", which is how they always behaved.
export type MeetingAudience = "excos" | "youths" | "selected";

export interface Meeting {
  id: string;
  title: string;
  date: string;
  audience?: MeetingAudience;
  attendeeIds?: string[]; // youth IDs; only meaningful when audience is "selected"
  minutesContent: string;
  // Follow-ups agreed in the meeting (e.g. "design the sports flyer").
  // Same shape as an event task: who, what, optional due date, status.
  // Older meetings have none.
  actionItems?: MeetingActionItem[];
  createdBy: string;
  createdAt: string;
}

export interface AgendaItem {
  item: string;
  time?: string;
  owner?: string; // excoId
}

export interface EventTask {
  id: string;
  title: string;
  assignedTo: string; // an excoId OR a youthId — excos are listed first in the UI, but anyone can be assigned
  status: "pending" | "in_progress" | "done";
  dueDate?: string;
}

// An after-meeting action: same fields as an event task, so the same
// assignment UI is reused. "Pending" for counting means anything not done.
export type MeetingActionItem = EventTask;

// One line of an event's budget — what it is and what it's expected to cost.
export interface BudgetItem {
  id: string;
  item: string;
  price: number; // ₦
}

// Something the event needs people to bring or give — clothes, a bag of
// rice, chairs. `quantity` is free text, phrased the way people say it
// ("A big or half bag", "3 packs"). `note` is for what has been gotten so
// far ("2 bags already received"), and is printed beside the item on a
// sponsorship request.
export interface NeededItem {
  id: string;
  name: string;
  quantity: string;
  note?: string;
}

export interface ChurchEvent {
  id: string;
  title: string;
  date: string;
  time?: string; // "HH:mm", 24-hour as the time input gives it; blank until decided
  venue?: string;
  expectedAttendance?: string; // free text, e.g. "About 60 youths and 40 children"
  neededItems?: NeededItem[]; // the event's shopping/wish list, shared by its sponsorship requests
  // Optional, and often decided late in the planning, so it can be left
  // blank at first and added or changed at any time. Empty means "none yet".
  theme?: string;
  budget?: BudgetItem[]; // the total is always derived (see lib/events.ts budgetTotal)
  agenda: AgendaItem[];
  tasks: EventTask[];
  planningNotes?: string; // freeform thoughts/suggestions while planning, before the event happens
  afterEventReport?: string; // what used to be called "minutes" for an event — written once it's concluded
  contributionId?: string; // set once a contribution drive has been started for this event
  programmeId?: string; // set when the event was created from a programme on the yearly planner
  createdBy: string;
  createdAt: string;
}

// A programme on the yearly planner (/programmes/{id}) — an idea for
// something to do in a given year, before it's an actual event. It moves
// suggested → approved (or declined); once an event has been created from
// it, `eventId` points at that event.
export type ProgrammeStatus = "suggested" | "approved" | "declined";

export interface Programme {
  id: string;
  title: string;
  idea?: string; // what it is and why
  year: number; // the year it's planned for
  month?: number | null; // 1–12 suggested month; null/absent = not decided yet
  timeNote?: string; // free-text timeline, e.g. "Two-day retreat, late March"
  estimatedBudget?: number | null; // ₦, rough figure while still an idea
  status: ProgrammeStatus;
  eventId?: string; // set once an event has been created from this programme
  createdBy: string; // uid of whoever suggested it
  createdByName: string; // their display name at the time (denormalised for the list)
  createdAt: string;
  decidedByName?: string | null; // who approved/declined it
  decidedAt?: string | null;
}

// /meetings/{id}/attendance/{youthId} and /events/{id}/attendance/{youthId}
// For an exco meeting, an exco who is also a youth is marked under their
// youthId (so it shows on their youth profile); an exco with no youth
// record (e.g. the manually created first super admin) is marked under
// their exco ID instead.
// youthId is duplicated into the doc (even though it's also the doc ID)
// so a collectionGroup("attendance") query can filter by it directly —
// needed to pull one youth's attendance across both meetings and events.
export interface AttendanceRecord {
  youthId: string;
  present: true;
  markedBy: string; // uid of the exco who marked it
  markedAt: string;
}

// Anyone who can appear on an attendance checklist — a youth, or an exco
// (see the note on AttendanceRecord about how excos are keyed). A Youth
// already fits this shape.
export interface Attendee {
  id: string;
  name: string;
  gender?: "male" | "female";
}

export interface ActivityLogEntry {
  id: string;
  actorUid: string;
  actorName: string;
  action: string; // e.g. "created_transaction", "edited_minutes"
  targetType: string; // e.g. "transaction", "meeting"
  targetId: string;
  timestamp: string;
}

/* -------------------------------------------------------------------------
 * Event documents — /events/{eventId}/documents/{documentId}
 *
 * Two kinds, both printable as a PDF that ends with signatures:
 *   proposal     — the case for the event: background, objectives, audience,
 *                  programme, expected outcomes. Deliberately has NO budget.
 *   sponsorship  — a letter to a sponsor: the event in detail, the budget,
 *                  and exactly what is being asked for (cash and/or items).
 *   visit        — a letter to the place being visited (e.g. an orphanage)
 *                  asking whether they accept the visit, with a reply slip
 *                  they can fill in and send back.
 * ---------------------------------------------------------------------- */

export type EventDocumentKind = "proposal" | "sponsorship" | "visit";

// "draft" while it's being written; "signed" once it's been finalised, at
// which point a sponsorship request freezes the budget it was sent with.
export type EventDocumentStatus = "draft" | "signed";

// A titled block of text. Both kinds are built from these so every part is
// editable, reorderable and removable. Lines starting with "- " print as bullets.
export interface DocumentSection {
  id: string;
  heading: string;
  body: string;
}

export interface DocumentSignatory {
  id: string;
  name: string;
  title: string; // e.g. "President", "Youth Pastor"
  // A drawn signature, stored as a small PNG data URL (a few KB). Absent
  // until they've signed; the PDF then leaves a blank line to sign by hand.
  signatureDataUrl?: string;
  signedOn?: string; // ISO date
}

export interface DocumentContact {
  id: string;
  name: string;
  role?: string;
  phone?: string;
}

export interface EventDocument {
  id: string;
  kind: EventDocumentKind;
  title: string; // e.g. "Proposal for Orphanage Visit"
  status: EventDocumentStatus;
  ref?: string; // optional reference number printed on the letter
  documentDate: string; // ISO date printed on it
  sections: DocumentSection[];
  signatories: DocumentSignatory[];
  // Proposal only — who it's submitted to (e.g. "The Pastor-in-Charge").
  submittedTo?: string;
  // Sponsorship and visit letters (addressed to someone) below.
  recipientName?: string;
  recipientOrganisation?: string;
  recipientAddress?: string;
  cashRequested?: number | null; // ₦ asked for in cash; null/absent = none
  // Which of the event's needed items this letter asks for (picked by
  // checkbox from the event's list).
  requestedItemIds?: string[];
  itemsSnapshot?: NeededItem[]; // frozen copy of those items, taken when signed
  includeBudget?: boolean; // show the event's budget breakdown (default true)
  includeReplySlip?: boolean; // visit letters: print a slip for them to accept or suggest another date (default true)
  budgetSnapshot?: BudgetItem[]; // frozen copy taken when signed
  paymentDetails?: string; // where cash should be paid
  contacts?: DocumentContact[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
