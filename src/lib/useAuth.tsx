"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import { fallbackRoleLabel, resolveRoleConfig } from "./roles";
import type { ExcoMember, Permissions, RoleConfig } from "@/types";

interface AuthContextValue {
  user: FirebaseUser | null;
  exco: ExcoMember | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  hasPermission: (perm: keyof Permissions) => boolean;
  roleLabel: string; // display name of the signed-in exco's role ("" until loaded)
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Logins are created only by inviting an exco from the Excos page
// (lib/excos.ts inviteExco), which creates the Firebase Auth account and
// links it to the exco's record via /accounts/{uid}. There's no public
// self-signup. An exco record can exist before it has a login (a youth set
// as an exco, not yet invited) — those people just can't sign in yet.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [exco, setExco] = useState<ExcoMember | null>(null);
  const [roleConfig, setRoleConfig] = useState<RoleConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setExco(null);
        setLoading(false);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    let cancelled = false;
    let unsubExco: (() => void) | undefined;

    (async () => {
      // Find which exco record this login belongs to. Newer excos are
      // linked through /accounts/{uid}; excos created before that existed
      // have no link doc, and their record ID *is* the uid.
      let excoId = user.uid;
      try {
        const link = await getDoc(doc(db, "accounts", user.uid));
        if (link.exists()) excoId = (link.data() as { excoId: string }).excoId;
      } catch {
        // Fall through to the legacy lookup below.
      }
      if (cancelled) return;

      unsubExco = onSnapshot(
        doc(db, "excos", excoId),
        (snap) => {
          if (snap.exists()) {
            setExco({ uid: user.uid, ...(snap.data() as Omit<ExcoMember, "id" | "uid">), id: snap.id });
            setError(null);
          } else {
            // Signed in with Firebase Auth but no matching exco record —
            // shouldn't normally happen, but guard against it rather than
            // silently granting access.
            setExco(null);
            setError("No exco profile found for this account.");
          }
          setLoading(false);
        },
        () => {
          setError("Couldn't load your profile. Try again.");
          setLoading(false);
        }
      );
    })();

    return () => {
      cancelled = true;
      unsubExco?.();
    };
  }, [user]);

  // Permissions now live on the exco's ROLE (/rolesConfig/{role}), not on
  // the exco doc itself — so re-subscribe whenever the role changes.
  // super_admin is handled entirely in hasPermission below and never
  // needs this doc, but we still fetch it so the Roles page has
  // something sane to show if someone looks.
  useEffect(() => {
    if (!exco) {
      setRoleConfig(null);
      return;
    }
    const ref = doc(db, "rolesConfig", exco.role);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setRoleConfig(resolveRoleConfig(exco.role, snap.exists() ? (snap.data() as Partial<RoleConfig>) : undefined));
      },
      () => {
        // If this fails (e.g. the role doc genuinely doesn't exist and
        // rules deny the read), fall back to the hardcoded default
        // rather than leaving permissions in limbo.
        setRoleConfig(resolveRoleConfig(exco.role));
      }
    );
    return () => unsub();
  }, [exco?.role]);

  async function signIn(email: string, password: string) {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError("Incorrect email or password.");
      throw new Error("sign-in-failed");
    }
  }

  async function signOutUser() {
    await firebaseSignOut(auth);
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email);
  }

  function hasPermission(perm: keyof Permissions) {
    if (!exco?.active) return false;
    if (exco.role === "super_admin") return true; // always full access, no exceptions
    return !!roleConfig?.permissions?.[perm];
  }

  const roleLabel = exco ? roleConfig?.label ?? fallbackRoleLabel(exco.role) : "";

  return (
    <AuthContext.Provider
      value={{ user, exco, loading, error, signIn, signOutUser, resetPassword, hasPermission, roleLabel }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
