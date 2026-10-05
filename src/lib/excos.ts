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
  orderBy,
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

export async function listExcos(filters: ExcoFilters = {}): Promise<ExcoMember[]> {
  const clauses = [];
  if (filters.activeOnly) clauses.push(where("active", "==", true));
  if (filters.unit) clauses.push(where("unit", "==", filters.unit));

  const q = query(collection(db, "excos"), ...clauses, orderBy("name"));
  const snap = await getDocs(q);
  let excos = snap.docs.map((d) => fromDoc(d.id, d.data()));

  if (filters.search) {
    const term = filters.search.toLowerCase();
    excos = excos.filter((m) => m.name.toLowerCase().includes(term));
  }

  return excos;
}

export async function getExco(id: string): Promise<ExcoMember | null> {
  const snap = await getDoc(doc(db, "excos", id));
  return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
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

export async function updateExco(id: string, data: Partial<ExcoMember>): Promise<void> {
  await updateDoc(doc(db, "excos", id), withoutUndefined(data));
}

/** Retires an exco: marks them inactive so security rules (isExco()) lock them out. */
export async function retireExco(id: string): Promise<void> {
  await updateDoc(doc(db, "excos", id), { active: false });
}

export async function reinstateExco(id: string): Promise<void> {
  await updateDoc(doc(db, "excos", id), { active: true });
}
