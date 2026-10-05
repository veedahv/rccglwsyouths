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

// /contributions/{contributionId}/pledges/{youthId}
export interface Pledge {
  youthId: string;
  pledgedAmount: number;
  redeemedAmount: number; // sum of `payments` below, denormalized
  payments: Payment[];
}

// /contributions/{contributionId}/externalSupport/{supportId} — money
// given toward a contribution drive by someone who isn't on the youth
// roster (e.g. a parent or a pastor supporting the youths). Counts
// toward the drive's total received, but never toward total pledged —
// there's no pledge concept for external supporters, only direct giving.
export interface ExternalSupport {
  id: string;
  name: string; // free text — not a youth or exco
  amount: number;
  method: PaymentMethod;
  date: string;
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

// Who a meeting is for, which decides who shows up on its attendance list:
//   excos    — the active excos (including external admins)
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

export interface ChurchEvent {
  id: string;
  title: string;
  date: string;
  agenda: AgendaItem[];
  tasks: EventTask[];
  planningNotes?: string; // freeform thoughts/suggestions while planning, before the event happens
  afterEventReport?: string; // what used to be called "minutes" for an event — written once it's concluded
  contributionId?: string; // set once a contribution drive has been started for this event
  createdBy: string;
  createdAt: string;
}

// /meetings/{id}/attendance/{youthId} and /events/{id}/attendance/{youthId}
// For an exco meeting, an exco who is also a youth is marked under their
// youthId (so it shows on their youth profile); an exco with no youth
// record (an external admin) is marked under their exco ID instead.
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
