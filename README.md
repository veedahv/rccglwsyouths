# Youth Exco Platform — Scaffold

Two distinct kinds of people in this system:
- **Excos** (`/excos`) — the committee who run the platform. Permission-gated via their **role**, retired rather than deleted. There are two ways to become one: a youth is **set as an exco** from the Youths page (just pick a role — no email, no login yet), or an **external admin** (the church pastor, the youth pastor, anyone who isn't a youth) is added directly on the Excos page; external admins are always super admins. Either way, an exco has no login until someone clicks **Invite** on the Excos page — that's when their email is collected and their login is created.
- **Youths** (`/youths`) — the full youth department roster. No login. This is who dues, attendance, and contributions are tracked against. Can be active or marked inactive (married, left the church, other).

Permissions are **per-role, not per-exco**: `/rolesConfig/{role}` holds one permission set shared by everyone with that role (president, financial secretary, etc.), edited from `/roles`. The six built-in roles always exist, and anyone with `canManageRoles` can **add more roles** from `/roles` (e.g. "Welfare Officer"); a custom role starts with no permissions until they're ticked. `super_admin` is a special role that always has full access in code, regardless of what's stored in its config — it can't be restricted.

## ⚠️ Required one-time setup: creating the first super_admin
This is the single most important thing to do before anything else works, so it's at the top rather than buried in "not yet built."

Making someone an exco (or adding an external admin, or inviting them) from inside the app requires `canManageRoles` — which only an existing exco can grant. On a brand-new project, **no excos exist yet**, so nobody can use the app to create the first one. This is a standard bootstrap problem for a Cloud-Function-free, invite-only auth system, and it's solved the same way everywhere: **the very first account is created manually, once, outside the app**, via the Firebase Console:

1. **Authentication → Users → Add user.** Create the super admin's account with their real email and a password.
2. Copy the generated **User UID**.
3. **Firestore Database → Start collection → `excos`.** Create a document whose **Document ID is that UID**, with these fields:
   - `name` (string) — their name
   - `email` (string) — same email as step 1
   - `role` (string) — `super_admin`
   - `active` (boolean) — `true`
   - `joinedAt` (string) — today's date, e.g. `2026-10-03`
4. Sign in to the app with that email/password. Because `role == 'super_admin'`, `hasPermission()` returns true for everything immediately — no `/rolesConfig` seeding required (see the comment on `hasPermission` in `firestore.rules` for why the super_admin check has to come first).

From there, the super admin can set any youth as an exco in any role (including another super_admin), add external admins, and invite everyone, entirely from the UI — this manual step is only needed once per project. (This first doc keeps working as-is: excos whose record ID is their auth UID don't need an `/accounts` link, see below.)

## What's here
- `lib/firebase.ts` — Firebase client init (fill in `.env.local` from `.env.local.example`); also exports `firebaseConfig` for the secondary-app trick below
- `types/index.ts` — shared TypeScript types (excos, youths, role configs, dues, contributions, transactions, meetings, events, attendance, activity log)
- `lib/excos.ts` — exco records and invites, all client-side, no Cloud Function. `promoteYouthToExco(youth, role)` sets a youth as an exco: copies name/phone/gender/dob/unit, links the records both ways (`exco.youthId` / `youth.linkedExcoId`), and creates **no login**. `createExternalAdmin(...)` adds a non-youth super admin. `inviteExco(exco, email)` creates the Firebase Auth login, links it via `/accounts/{uid}`, stores `uid` on the exco, and emails a set-password link. `hasLogin(exco)` says whether someone has been invited. `resendInvite(email)` re-sends the link
- `lib/roles.ts` — `/rolesConfig` CRUD, now dynamic: `listRoleConfigs` (built-in roles first, filled in with defaults, then any custom roles), `getRoleConfig`, `updateRoleConfig`, `createCustomRole(label)` (the role ID is a slug of the name, e.g. `youth_pastor`), `deleteCustomRole` (refused for built-ins and for roles someone still holds). Also owns the built-in role list and `defaultPermissionsForRole`
- `lib/youths.ts` — youth roster CRUD: `listYouths`, `createYouth` (plain auto-ID, no auth account), `setYouthInactive(id, reason)` / `reactivateYouth`
- `lib/dues.ts` — dues payment logic against `/youths/{youthId}/dues`: multi-month selection, even/manual split, and the merge rule (a month that's already paid gets topped up, not overwritten); `getDuesGridForYear(year)` pulls everyone's dues for a year in one `collectionGroup` query, for the grid below
- `app/dues/page.tsx` — the Monthly Dues grid: every active youth as a row, Jan–Dec as columns, amount paid per month (or "—"), a yearly total per person and a "Monthly total" footer row — same shape as the original paper spreadsheet. "Add payment" opens `DuesForm` inline and refreshes the grid on save
- `lib/meetings.ts`, `lib/events.ts` — CRUD for meetings (title, date, **audience**, minutes) and events (title, date, optional **theme**, **budget**, agenda, tasks, notes). `budgetTotal()` derives an event's total budget from its items (never stored)
- `lib/attendance.ts` — marks/unmarks a youth present for a meeting or event, and `getYouthAttendance` pulls one youth's attendance across both via a `collectionGroup` query
- `lib/useAuth.tsx` — auth context: Firebase Auth → `/accounts/{uid}` link (falling back to `/excos/{uid}` for excos that predate it) → exco profile + `/rolesConfig/{role}` subscription, `hasPermission()` (super_admin bypasses everything), `changePassword()` (re-checks the current password, then updates it), and `roleLabel`
- `components/RequireAuth.tsx` — gates a page/section by sign-in or a specific permission
- `components/ExcoForm.tsx` — **edit-only** (name, phone, role, etc. for an existing exco). External admins get a Title field and a fixed Super Admin role; the email is editable until the exco has a login
- `components/InviteExcoForm.tsx` — invites an exco from the Excos page: asks for an email, creates the login, then shows the temporary password once (in case the email doesn't arrive)
- `components/ExternalAdminForm.tsx` — adds an external admin (name, title, email, phone) and optionally invites them in the same step
- `components/DuesForm.tsx` — dues entry UI against the youth roster: select youth, amount, month picker (current month pre-selected), split mode, merge-confirmation warning
- `components/AttendanceChecklist.tsx` — present/absent toggle for whatever list of people it's given (`people`), plus **"+ Someone not on this list"** to add a new youth on the spot and mark them present in one step (can be switched off, as it is for exco meetings)
- `components/MeetingAudienceFields.tsx` — the "Who is this meeting for?" picker (Excos / All youths / Selected group, with a searchable youth checklist for a group), used when creating a meeting and when changing it later
- `lib/contributions.ts` — contribution drives (e.g. Pastor's Birthday, Love Feast): `createContribution` (title, who's in charge of collecting, notes), `createPledge` / `setPledgeAmount` per youth, `recordRedemption` (tops up, same merge pattern as dues), `setPledgeItems`, `computeTotals` for pledged-vs-received. A pledge can be **money, items, or both** (see "Pledging items" below)
- `components/PledgeTable.tsx` — per-youth pledged/redeemed table: edit a pledge amount, record a payment, manage a pledge's items, add a youth not yet in the drive (money, items, or both)
- `components/ItemEntry.tsx` — the "item name + how many" entry used wherever items are pledged
- `components/BudgetEditor.tsx` — an event's budget: items with a price each, editable in place, with the total
- `components/AgendaEditor.tsx` — event agenda items, with an optional exco owner
- `components/TaskAssignment.tsx` — event tasks: assignable to an exco **or a youth** (the select groups excos first, then youths), with status
- `components/EditableSection.tsx` — reusable view/edit toggle (text view + "Edit" button → textarea → "Save" returns to text view), used for an event's Planning Notes and After-Event Report
- `components/StartEventContribution.tsx` — starts a contribution drive from an event: just a description and who's in charge of collecting — the title is always the event's own title, not asked for separately
- `app/contributions/page.tsx` + `[id]` — list/create (gated `canEditFinance`) and detail (totals, in-charge exco, notes, pledge table)
- `app/excos/page.tsx` + `[id]` — exco directory (gated by `canManageRoles`: **Add external admin**, **Invite** / **Resend invite**, edit, retire; each row shows whether they have a login yet) and profile (role, permissions inherited from that role)
- `app/youths/page.tsx` + `[id]` — youth directory (add, mark inactive with a reason, **"Make exco"** per youth: pick a role and it's done) and profile (dues history + attendance)
- `app/meetings/page.tsx` + `[id]` — meeting list/create and detail (minutes editor + attendance checklist). Every meeting has an **audience** that decides who's on its attendance list: **Excos** (the active excos; external admins such as the pastors aren't included), **All youths** (every active youth), or a **Selected group** of youths (`attendeeIds`). Meetings created before this existed have no audience and are treated as All youths. The audience can be changed from the meeting's Attendance card; attendance already marked is kept. For exco meetings an exco who is also a youth is marked under their youth ID (so it shows on their youth profile), one with no youth record (e.g. the first super admin created by hand) under their exco ID
- `app/events/page.tsx` + `[id]` — event list (Upcoming/Concluded badges) and detail, which now has: editable title/date/**theme** (optional, can be added or changed any time; the list and header show it when set), Agenda, Tasks, a **Budget** (item + price lines, with the total shown), **Planning Notes** (freeform thoughts while still planning, via `EditableSection`), a linked **Contribution** (start one from the event — title is auto-set to the event's title; gated by needing *both* `canEditFinance` and `canEditEvents`, since starting one is really two writes: creating the contribution and linking it back to the event), and an **After-Event Report** (renamed from "minutes" — an event isn't a live meeting, so that word didn't fit) + **Attendance**, both of which only appear once the event's date has arrived — hidden entirely before then
- `lib/transactions.ts` — manual income/expense entries (e.g. one-off purchases, donations) at `/transactions`
- `lib/reports.ts` — the financial report's engine. **Deliberately excludes contributions** (pledges, redemptions, external support) — those are tracked and reported entirely on their own `/contributions` pages now, never folded into this report.
  - `generateMonthlyReport(yearMonth)` — each line item now has **date, description, amount, and payment type** (not just a label + amount). Dues payments are reconstructed from each youth's individual `Payment` records, regrouped by the `groupId` written when they were recorded (see `lib/dues.ts`) so a single real payment covering several months shows as *one* line — "Monthly dues from Sis Deborah for Jan 2026, Feb 2026 and Mar 2026" — not three disconnected ones. Every line is bucketed into the report month based on **when it was actually paid** (`payment.date`), not which month(s) the dues cover — paying in March for Jan–Mar dues shows entirely in March, matching how the original paper reports worked and fixing a real inaccuracy in the previous version (which bucketed by coverage month instead).
  - `generateYearlyReport(year)` — the new year-level summary: total dues, total incoming, total outgoing, and the closing (ending) balance for the year.
- `lib/reportPdf.ts` — `downloadMonthlyReportPdf(report, orgName)`: renders the same shape as a PDF via `jspdf`, triggered by "Download PDF" on `/finance`. Amounts show the actual ₦ symbol — since jsPDF's built-in fonts don't include that glyph and there's no network access here to fetch a Unicode font, it's drawn as small vector strokes (an "N" with two bars through it) positioned right before each number, rather than as text
- `lib/dashboard.ts` — dashboard aggregations: events handled this year, next upcoming / last concluded event, recent minutes, the most recently created contribution's pledged-vs-received totals. Money in/out now just calls `generateYearlyReport()` from `lib/reports.ts` directly, rather than keeping its own separate (and previously slightly different) calculation — so the dashboard and the financial report can never show two different numbers for the same year.
- `components/AppChrome.tsx` — the nav shown once an exco is signed in; renders nothing extra on `/login`. A fixed left **sidebar** at `md:` breakpoint and up (logo, nav links with the current page highlighted via `usePathname`, name + sign-out pinned to the bottom); below `md`, it's a top bar with a hamburger that opens a slide-out drawer with the same `SidebarContent`, so the two never drift out of sync
- `components/Logo.tsx` — **placeholder mark, not the real RCCG logo** — swap in the actual artwork (see note below)
- `app/dashboard/page.tsx` — the landing page after sign-in: money in/out vs. last year, events handled, next/last event, recent minutes, ongoing contribution
- `app/finance/page.tsx` — now has **two levels**: a year summary card (total dues, total incoming, total outgoing, balance — pick a year) above the existing month-by-month report (pick a month, download as PDF), each Incoming/Outgoing line shown as a proper date/description/type/amount row instead of a flat label. "Add entry" is for income/expense entries not related to dues (purchases, donations, one-off income), gated `canEditFinance` — points to `/dues` for anything dues-related, and contributions are never entered here at all.
- `app/roles/page.tsx` — Roles & Permissions: a role × permission grid, visible to every exco (per the original brief), but the checkboxes only respond for someone with `canManageRoles`. That person can also **add a role** and remove custom roles nobody holds. The `super_admin` row is always shown fully checked and disabled — it's not configurable, it's just true in code
- `app/page.tsx` — root route; redirects to `/dashboard` if signed in, `/login` otherwise
- `app/login/page.tsx` — sign-in, redirects to `/dashboard` on success, with a "Forgot password?" link
- `app/forgot-password/page.tsx` — public. Asks for an email and sends Firebase's reset link. Shows the same "check your email" message whether or not the address has an account, so it can't be used to discover which emails are excos
- `app/reset-password/page.tsx` — public. Where the reset email's link lands: verifies the code, shows which account it's for, takes a new password + confirmation (min 8 chars). Also serves invitees setting their password for the first time, since invites send the same email
- `app/recover-email/page.tsx` — public. Where the "your sign-in email was changed" link lands: asks for one click to restore the previous email (not automatic, so mail scanners can't use up the link), then offers a password-reset email
- `app/auth/action/page.tsx` — the single "action URL" Firebase sends every email link to; forwards by `mode` to the two pages above. **Set the template action URL to `https://YOUR-DOMAIN/auth/action`** — see `docs/email-templates.md` for the updated email wording and steps
- `app/planner/page.tsx` — the **yearly planner**. Pick a year (opens on next year from October), then collect programme ideas and move them through suggested → approved / declined. Two views: **By month** (12 month cards plus a "Month not decided" card; events already on the calendar that didn't come from a programme show as muted links) and **By status**. Any exco can suggest a programme and edit/delete their own while it's still a suggestion; approving, declining, editing others' and **Create event** need `canEditEvents`. Creating an event copies the title/date (you choose them), turns the idea into the event's planning notes and any rough budget into one budget line, then links the two (the programme shows "Event created" / "Open event", the event shows "From yearly planner")
- `lib/programmes.ts` — planner data: `listProgrammes(year)` (single-field query, no index needed), create/update/delete, `setProgrammeStatus`, and `createEventFromProgramme` (one atomic batch, so no duplicate events or half-linked records)
- `components/ProgrammeForm.tsx` / `components/ProgrammeCard.tsx` — the suggest/edit form and the expandable programme card with its actions
- `lib/eventDocuments.ts` + `lib/eventDocumentPdf.ts` — **proposals and sponsorship requests** for an event, stored at `/events/{eventId}/documents/{id}` (readable by any exco; writes need `canEditEvents`). A **proposal** has no budget: header details, editable sections (introduction, objectives, audience, programme, outcomes, team, conclusion — all renameable, reorderable, removable) and the event's agenda printed as the order of programme. A **sponsorship request** is a letter to a named recipient: the same editable sections, plus the event's **budget** (frozen to a snapshot once signed), exactly **what is being requested** (cash and/or items ticked from the event's **Items needed** list), payment details and contact people. Both end with signature blocks; `buildEventDocumentPdf` renders them on the same letterhead as the financial reports (the Naira sign inside free text prints as "N", since jsPDF's built-in fonts have no ₦ glyph)
- **Events now carry** an optional **time** (shown with the date on one line), **venue**, **expected attendance** and an **Items needed** list (item, quantity in plain words, and a note for what has been gotten so far; `components/NeededItemsEditor.tsx`). Proposals and sponsorship requests read these from the event instead of keeping their own copies. A sponsorship request picks its items with checkboxes (`RequestedItemsPicker`) and freezes them, with the budget, when signed
- **Youths and excos share one set of personal details.** A youth made an exco still has two records, but name, phone, gender, birthday and unit now come from the youth record (`lib/sharedDetails.ts`): `listExcos`/`getExco` and the signed-in profile read them from there (`withYouthDetails`), `updateYouth` writes changes through to the exco, and `updateExco` writes them to the youth first. Role, email, login and title stay on the exco record only. `youthsNotInExcos` keeps anyone who is already in the exco list out of the youth list wherever both are offered side by side (the task and action "Assign to" picker), so no one can be picked twice
- **Confirmations are dialogs, not inline buttons or `window.confirm`** (`components/Modal.tsx`: `Modal`, `ConfirmDialog`, `Subject`). Anything that acts on a person or record opens a dialog with the name shown large in a tinted box (plus unit/phone/role/email so two people with the same name can be told apart): on the Youths page Delete (checks up front whether they have money records and blocks with the reason), Make exco (role picked in the dialog), Mark inactive (reason picked in the dialog) and Reactivate; on the Excos page Retire, Reinstate and Resend invite; plus removing a role, deleting a programme, and deleting or reopening an event document. Destructive dialogs focus Cancel first; Esc, ✕ and clicking outside close them unless something is saving
- **Item counts next to the money.** `computeStats` now also returns `itemsPledged`, `itemsReceived` (youths' pledged items received + everything outside supporters gave), `itemsReceivedFromExternal` and `receivedItemLines`. The contribution page and the dashboard show an "Items received" stat; the contributions list, the event's contribution card and the dashboard show an `ItemsLine` ("6 of 8 pledged items received", with a short Rice 2, Maggi 3… breakdown). A contribution with no items looks exactly as before
- **External support can be edited and deleted** (`updateExternalSupport` / `deleteExternalSupport`, same `canEditFinance` rule as adding): Edit opens the same form in a dialog — fix the name, date, amount or method, add more items, or remove ones — and Delete asks first with the supporter's name highlighted
- **Visit-request letter** (third document kind, `visit`): a letter to the place being visited (addressee defaults to the event's venue) asking whether they accept the date and time, with contact people and an optional **reply slip** after the signatures (tick "happy to receive you" or suggest another date, items needed / rules, name, position, signature and stamp, date). **Letterhead:** the first page of proposals, sponsorship requests and visit letters now has both crests and three lines, "Redeemed Christian Church of God" (green), "Living Water Sanctuary" (red) and "Youth Department"; later pages and the financial reports keep the slim "Youth Department, LWS, RCCG" header
- **In-app document preview**: the document editor's **Preview** button builds the PDF from what is on screen (saved or not) and shows its pages in a large dialog (`components/PdfPreview.tsx`, using `pdfjs-dist` 3.11 drawn onto canvases, so it works on phones too, where an embedded PDF often doesn't), with Download PDF alongside. The visit letter leaves out the Event and Venue rows, since it is addressed to the place being visited. `next.config.js` aliases the Node-only `canvas` package to `false` for pdf.js — run `npm install` after pulling this change
- `components/EventDocuments.tsx` — the event page's "Proposal and sponsorship requests" card: list, "Write a proposal", "New sponsorship request"
- `app/events/[id]/documents/[docId]/page.tsx` — the editor: details, addressee, sections, budget, request, signatures, **Download PDF**, **Mark as signed** (needs everyone named to have signed, locks the document and freezes the budget; **Reopen** clears the signatures, because editing a signed letter invalidates them)
- `components/DocumentEditors.tsx` / `components/SignaturePad.tsx` — the list editors (sections, requested items, contacts, signatories) and a draw-your-signature box (a small transparent PNG stored on the document; the PDF leaves a blank line for anyone who hasn't signed on screen)
- **External contributions can now be items, not just money**: `ExternalSupport` has optional `items` (name, quantity, unit — halves allowed, so "half a bag of rice" works) and an `amount` of 0 for an items-only gift. `ExternalSupportList` records them; `computeStats` adds `externalItemTotals` (same item and unit add up), shown on the contribution page and the event's contribution card
- `app/profile/page.tsx` — "My profile" for any signed-in exco (admin or not): shows account details and a Change password form (current password → new → confirm). Linked from the sidebar
- `lib/authErrors.ts` — friendly messages for Firebase auth error codes and the shared password rule (`MIN_PASSWORD_LENGTH`)
- `components/AuthShell.tsx` / `components/PasswordInput.tsx` — the shared signed-out page layout, and a password field with Show/Hide
- `firestore.rules` — financial-secretary-only writes to finance data, minutes/events writable only by the relevant permission, any exco can manage the youth roster and mark attendance, exco records, `/accounts` links and role-config edits gated to `canManageRoles` (or bypassed entirely by `super_admin`)

## How invites avoid needing a Cloud Function
Calling `createUserWithEmailAndPassword` directly would sign the admin out
and sign them in as the new exco instead — the classic problem with
client-side account creation. `inviteExco` works around it by spinning up
a throwaway **secondary Firebase app instance** (same project, separate
auth session), creating the account there, then tearing it down — the
admin's own session on the primary app is never touched. The new login is
created with a random password and Firebase's "reset password" email is
sent straight away, so the invitee sets their own; the temporary password
is also shown once to the admin as a fallback and is never written to
Firestore. (You can reword that email under Authentication → Templates in
the Firebase console so it reads as a welcome rather than a reset.)

## Why there's an `/accounts` collection
An exco record can now exist *before* the person has a login, so an exco's
doc ID can't be their auth UID any more. `/accounts/{authUid}` → `{ excoId }`
is the link that `useAuth` and the security rules follow to find "which exco
is this signed-in person". **Excos created before this change need no
migration**: with no `/accounts` doc, both the app and the rules fall back
to treating the auth UID as the exco record ID, and a missing `uid` field on
an old exco record is read as "already has a login".

**After deploying this update, republish `firestore.rules`** (the planner adds a `/programmes` rule, and the invite flow needs `/accounts`) — the app
writes to `/accounts` and the old rules don't allow it.

## About the logo
I can't fetch or reproduce the actual RCCG logo here — it's the church's trademarked mark, and this environment has no image-fetch access regardless. `components/Logo.tsx` is a generic placeholder monogram so the app ships with *something*. To use the real one: drop the file in `public/` (e.g. `public/logo.png`) and swap the `<svg>` in `Logo.tsx` for an `<img src="/logo.png" ... />` — everywhere else just imports `<Logo />`, so this is a one-file change.

## About the session fix
Two real bugs, now fixed:
1. `app/login/page.tsx` called `signIn()` but never navigated anywhere after success — you'd sign in and just... stay on the login page with no visible sign of it working. It now `router.push("/dashboard")`s on success.
2. `RequireAuth` showed an error message when signed out instead of redirecting — now it `router.replace("/login")`s, so an expired session bounces you to sign-in instead of stranding you on a page.

Session persistence itself (surviving a browser close/reopen) was already Firebase's default — `lib/firebase.ts` now sets `browserLocalPersistence` explicitly rather than relying on that default silently.

## A Firestore index you'll need to create once
`getDuesGridForYear` (powering `/dues`) runs a *range-filtered* `collectionGroup` query — `where("yearMonth", ">=", "2026-01")` and `<= "2026-12"` across every youth's `dues` subcollection at once. Firestore doesn't auto-create collection-group-scope indexes; the first time this query runs against your real project, it will fail with an error that includes a direct link to create the needed index in the Firebase console — click it once, wait a minute or two for the index to build, and it'll work from then on. (The other `collectionGroup` queries elsewhere in the app — `dues`, `pledges`, `externalSupport`, `attendance` — don't need this, since they fetch everything with no `where` filter.)

## Not yet built (next steps)
- A persisted/cached version of the monthly/yearly report (`financeReports` collection exists in the rules but isn't written to yet — currently every report is recomputed live from dues + transactions, which is fine at this data volume but would be worth caching later)
- Activity log + notifications — the current rules assume these are written by a Cloud Function; since exco creation avoids one, you may want these to switch to direct client writes too

## Project structure
Everything app-specific lives under `src/` (`src/app`, `src/lib`, `src/components`, `src/types`) — standard Next.js `src/` layout. Config files (`next.config.js`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `package.json`) stay at the project root, which is where Next.js and the tooling expect to find them. `@/*` resolves to `./src/*` via `tsconfig.json`.

## Setup
```bash
npm install
cp .env.local.example .env.local   # fill in Firebase project config
npm run dev
```

Deploy rules with:
```bash
firebase deploy --only firestore:rules
```

Then follow **"Required one-time setup"** above before signing in for the first time.


## Event themes, budgets and item pledges
- **Theme** — `ChurchEvent.theme` is optional and can be left blank at creation, then added or changed later (an empty string means none yet).
- **Budget** — `ChurchEvent.budget` is a list of `{ id, item, price }`. The total is always computed from the list (`budgetTotal()` in `lib/events.ts`), never stored, so it can't drift. Events created before this have no budget and simply show an empty one.
- **Pledging items** — a `Pledge` can now carry `items: { id, name, quantity, received }[]` as well as (or instead of) `pledgedAmount`. An items-only pledge has `pledgedAmount: 0`. Money works exactly as before; for items, you record how many were pledged and how many have been brought so far. Pledge status (`getPledgeStatus`) looks at money and items together: *fulfilled* once everything pledged has come in, *part-fulfilled* once some has, otherwise *nothing given yet*. Pledges made before this have no `items` and behave as they always did (including their original "Redeemed / Part-paid / Not yet paid" labels).
- **Item totals** — `computeStats().itemTotals` adds items up **per item name** (case-insensitive), so 10 chairs and 2 crates of drinks are never summed into one meaningless number. These show on the contribution page and, as a one-line summary, on the event page. The money figures (pledged, received, outstanding, the progress bar) are money-only and unchanged.
- External support is still money-only.
- No Firestore rules change: items live inside the pledge doc and the budget inside the event doc, which are already covered by the existing finance and event permissions.

## UI refresh and contribution dates

- **Theme** — official RCCG colours : blue/purple `#180C62` (sidebar, headings), green `#028A2C` (primary actions, money received), red `#D61812` (outstanding/overdue). Tokens live in `tailwind.config.js` under `rccg`; shared classes (`btn-primary`, `input`, `card`, `tbl`, `badge`) are in `app/globals.css`; shared React pieces in `components/ui.tsx`. Fonts: Figtree (body) and Bricolage Grotesque (headings) via `next/font/google` — needs internet at build time.
- **Contribution start/end dates** — `Contribution` now has `startDate` and an optional `endDate`. These only drive a status badge (Upcoming / Ongoing / Ended). They never block anything: pledges and payments can still be recorded after a contribution has ended. Existing contributions have no `startDate`; they fall back to their `createdAt` date, so no migration is needed. Status logic is in `lib/contributionStatus.ts`.
- **Contribution stats** — `computeStats()` in `lib/contributions.ts` gives total pledged, total received (youth + external), outstanding pledges, fully-paid counts and percent received. Shown on the contributions list, detail page, dashboard and event page.
- `lib/format.ts` has `naira`, `formatDate` and `todayISO` (local-timezone date; the old `toISOString().slice(0,10)` returned the UTC date, which is yesterday for the first hour after midnight in Nigeria).

## PDF financial reports

`lib/reportPdf.ts` builds the exported reports to match the department's manual report: **Incoming Money** (dues grouped by date with one line per person, then other income), **Outgoing Money** (with a Notes column), **Summary**, and a free-text **Notes** section. Both crests (RCCG + Young Adults & Youths) appear in the header; the logo files are shrunk before embedding so PDFs stay small.

- **Monthly PDF** and **Quarterly PDF** (three months + a quarter summary with the end-of-quarter closing balance) are both on the Finance page.
- **Notes for the PDF** (Finance page) is printed at the bottom of whichever PDF you download, e.g. cash handed to the treasurer.
- **Note** on a new income/expense entry fills the Notes column (e.g. "For Youth Sanitation"). It's optional; older entries simply have none.
- The ₦ sign is drawn as vector lines because jsPDF's built-in fonts don't include it.
- Figures come from the app's data, so they always add up. The manual Q1 sample doesn't (see below), so don't expect a one-to-one match with it.
