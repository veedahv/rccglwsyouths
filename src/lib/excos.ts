import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  getDocs,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { auth, db, firebaseConfig } from "./firebase";
import { updateYouth } from "./youths";
import { pickShared } from "./sharedDetails";
import type { ExcoMember, ExcoRole, Youth } from "@/types";

export interface ExcoFilters {
  activeOnly?: boolean;
  unit?: string;
  search?: string; // matched client-side against name (Firestore has no substring search)
}

/** Firestore rejects `undefined` field values, so drop them before writing. */
function withoutUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

/**
 * Turns a stored /excos doc into an ExcoMember. The one wrinkle: excos
 * created before invites existed have no `uid` field — back then the doc
 * ID *was* the auth uid and they always had a login — so a missing field
 * means "has a login, uid == doc ID". Newly created excos store an
 * explicit `uid: null` until they're invited.
 */
function fromDoc(id: string, data: Record<string, unknown>): ExcoMember {
  const raw = data as Omit<ExcoMember, "id" | "uid"> & { uid?: string | null };
  return { id, ...raw, uid: raw.uid === undefined ? id : raw.uid };
}

/** True once this exco has a Firebase Auth login (i.e. they can sign in). */
export function hasLogin(exco: Pick<ExcoMember, "uid">): boolean {
  return !!exco.uid;
}

/**
 * For an exco who was made from a youth, takes name, phone, gender,
 * birthday and unit from the youth record, which is the source of truth.
 * (Writes keep the exco's own copy in step too, but an older record, or an
 * edit made by someone not allowed to touch excos, can leave it behind.)
 * External admins have no youth record and come back unchanged.
 */
export async function withYouthDetails(exco: ExcoMember): Promise<ExcoMember> {
  if (!exco.youthId) return exco;
  try {
    const snap = await getDoc(doc(db, "youths", exco.youthId));
    if (!snap.exists()) return exco;
    const y = snap.data() as Youth;
    return { ...exco, name: y.name, phone: y.phone, gender: y.gender, dob: y.dob, unit: y.unit };
  } catch {
    return exco;
  }
}

export async function listExcos(filters: ExcoFilters = {}): Promise<ExcoMember[]> {
  const clauses = [];
  if (filters.activeOnly) clauses.push(where("active", "==", true));

  const snap = await getDocs(query(collection(db, "excos"), ...clauses));
  let excos = await Promise.all(snap.docs.map((d) => withYouthDetails(fromDoc(d.id, d.data()))));

  // Filtered and sorted here, after the youth details are in, so a youth's
  // current name and unit are what's matched (not a stale copy).
  if (filters.unit) excos = excos.filter((m) => m.unit === filters.unit);
  if (filters.search) {
    const term = filters.search.toLowerCase();
    excos = excos.filter((m) => m.name.toLowerCase().includes(term));
  }
  return excos.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getExco(id: string): Promise<ExcoMember | null> {
  const snap = await getDoc(doc(db, "excos", id));
  return snap.exists() ? withYouthDetails(fromDoc(snap.id, snap.data())) : null;
}

/**
 * The youths who can still be picked on their own: anyone who is already
 * in the given list of excos is left out. Use this wherever a list of
 * excos and a list of youths are offered side by side, so the same person
 * can't be chosen twice (once as an exco, once as a youth).
 */
export function youthsNotInExcos(youths: Youth[], excos: ExcoMember[]): Youth[] {
  const youthIds = new Set(excos.map((e) => e.youthId).filter((x): x is string => !!x));
  const excoIds = new Set(excos.map((e) => e.id));
  return youths.filter((y) => !youthIds.has(y.id) && !(y.linkedExcoId && excoIds.has(y.linkedExcoId)));
}

function generateDefaultPassword(length = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/**
 * Sets an existing youth as an exco. This is just a status change: it
 * records the role and links the two records both ways (exco.youthId /
 * youth.linkedExcoId). It does NOT create a login or need an email — the
 * new exco shows up on the Excos page as "Not invited", and an admin
 * invites them from there when they're ready (see inviteExco).
 *
 * Name/phone/gender/dob/unit are copied from the youth record.
 */
export async function promoteYouthToExco(youth: Youth, role: ExcoRole): Promise<string> {
  const profile: Omit<ExcoMember, "id"> = withoutUndefined({
    name: youth.name,
    phone: youth.phone,
    gender: youth.gender,
    dob: youth.dob,
    unit: youth.unit,
    role,
    youthId: youth.id,
    uid: null,
    active: true,
    joinedAt: new Date().toISOString().slice(0, 10),
  });

  const ref = await addDoc(collection(db, "excos"), profile);
  await updateYouth(youth.id, { linkedExcoId: ref.id });
  return ref.id;
}

export interface ExternalAdminInput {
  name: string;
  title?: string; // e.g. "Church Pastor", "Youth Pastor"
  email: string;
  phone?: string;
}

/**
 * Adds an external admin — someone outside the youth roster, like the
 * church pastor or youth pastor. They're always super_admin. Like any
 * exco they have no login until inviteExco is called for them.
 */
export async function createExternalAdmin(input: ExternalAdminInput): Promise<string> {
  const profile: Omit<ExcoMember, "id"> = withoutUndefined({
    name: input.name.trim(),
    title: input.title?.trim() || undefined,
    email: input.email.trim(),
    phone: input.phone?.trim() || undefined,
    role: "super_admin",
    external: true,
    uid: null,
    active: true,
    joinedAt: new Date().toISOString().slice(0, 10),
  });

  const ref = await addDoc(collection(db, "excos"), profile);
  return ref.id;
}

/**
 * Invites an exco: creates their Firebase Auth login, links it to their
 * exco record (/accounts/{uid} + exco.uid), and emails them a link to
 * set their own password.
 *
 * Runs entirely client-side, no Cloud Function required. The trick:
 * calling createUserWithEmailAndPassword on the *primary* auth instance
 * would sign the admin out and sign them in as the new exco instead.
 * To avoid that, we spin up a throwaway secondary Firebase app (same
 * project, separate auth session), create the account there, then tear
 * it down — leaving the admin's own session on the primary app untouched.
 *
 * Also returns the generated temporary password so the admin can hand it
 * over directly if the email doesn't arrive — it's never written to
 * Firestore, and they should change it after first sign-in. `emailSent`
 * says whether the set-password email went out.
 */
export async function inviteExco(
  exco: Pick<ExcoMember, "id" | "uid">,
  email: string
): Promise<{ password: string; emailSent: boolean }> {
  if (hasLogin(exco)) throw new Error("already-invited");

  const cleanEmail = email.trim();
  const password = generateDefaultPassword();

  const secondaryApp = initializeApp(firebaseConfig, `invite-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, password);
    const uid = cred.user.uid;

    // These two writes use the admin's own session (the primary app).
    await setDoc(doc(db, "accounts", uid), { excoId: exco.id });
    await updateDoc(doc(db, "excos", exco.id), {
      uid,
      email: cleanEmail,
      invitedAt: new Date().toISOString(),
    });

    let emailSent = false;
    try {
      await sendPasswordResetEmail(secondaryAuth, cleanEmail);
      emailSent = true;
    } catch {
      // The login exists either way; the admin can share the password
      // directly or use "Resend invite" later.
    }

    return { password, emailSent };
  } finally {
    // Tear down the secondary session/app either way, so it doesn't
    // linger or leak the temporary auth state.
    await signOut(secondaryAuth).catch(() => {});
    await deleteApp(secondaryApp).catch(() => {});
  }
}

/** Re-sends the set-password email to an exco who already has a login. */
export async function resendInvite(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Updates an exco. For someone made from a youth, their shared details
 * (name, phone, gender, birthday, unit) are written to the youth record
 * first, since that's the source of truth, and then to the exco record.
 * If the youth write isn't allowed this throws, so the edit doesn't look
 * saved when it wasn't.
 */
export async function updateExco(id: string, data: Partial<ExcoMember>): Promise<void> {
  const shared = pickShared(data as Record<string, unknown>);
  if (Object.keys(shared).length > 0) {
    const snap = await getDoc(doc(db, "excos", id));
    const youthId = snap.exists() ? (snap.data() as { youthId?: string }).youthId : undefined;
    if (youthId) await updateDoc(doc(db, "youths", youthId), shared);
  }
  await updateDoc(doc(db, "excos", id), withoutUndefined(data));
}

/** Retires an exco: marks them inactive so security rules (isExco()) lock them out. */
export async function retireExco(id: string): Promise<void> {
  await updateDoc(doc(db, "excos", id), { active: false });
}

export async function reinstateExco(id: string): Promise<void> {
  await updateDoc(doc(db, "excos", id), { active: true });
}
