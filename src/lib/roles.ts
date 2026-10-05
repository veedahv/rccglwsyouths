import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type { BuiltInRole, ExcoRole, Permissions, RoleConfig } from "@/types";

export const SUPER_ADMIN: BuiltInRole = "super_admin";

// The roles that always exist. Their display names are fixed here; their
// permissions are still editable from the Roles page (except super_admin).
export const BUILT_IN_ROLES: { id: BuiltInRole; label: string }[] = [
  { id: "super_admin", label: "Super Admin" },
  { id: "president", label: "President" },
  { id: "vice_president", label: "Vice President" },
  { id: "financial_secretary", label: "Financial Secretary" },
  { id: "secretary", label: "Secretary" },
  { id: "pr", label: "PR" },
];

export function isBuiltInRole(role: ExcoRole): boolean {
  return BUILT_IN_ROLES.some((r) => r.id === role);
}

// Sensible starting permissions per role — used to seed /rolesConfig the
// first time a role is encountered. After that, the Roles & Permissions
// page is the source of truth, not this function. Custom roles start
// with nothing; tick what they should be able to do on the Roles page.
export function defaultPermissionsForRole(role: ExcoRole): Permissions {
  if (role === "super_admin") {
    return { canEditFinance: true, canEditMinutes: true, canEditEvents: true, canManageRoles: true };
  }
  const base: Permissions = {
    canEditFinance: false,
    canEditMinutes: false,
    canEditEvents: false,
    canManageRoles: false,
  };
  switch (role) {
    case "financial_secretary":
      return { ...base, canEditFinance: true };
    case "secretary":
      return { ...base, canEditMinutes: true };
    case "president":
      return { ...base, canManageRoles: true, canEditEvents: true };
    case "vice_president":
      return { ...base, canEditEvents: true };
    default:
      return base;
  }
}

/** Display name for a role id when no stored label is available: built-in name, else the slug title-cased. */
export function fallbackRoleLabel(role: ExcoRole): string {
  const builtIn = BUILT_IN_ROLES.find((r) => r.id === role);
  if (builtIn) return builtIn.label;
  return role
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Builds a complete RoleConfig from whatever's stored (possibly nothing) for a role. */
export function resolveRoleConfig(role: ExcoRole, stored?: Partial<RoleConfig>): RoleConfig {
  return {
    role,
    label: stored?.label || fallbackRoleLabel(role),
    permissions: { ...defaultPermissionsForRole(role), ...(stored?.permissions ?? {}) },
  };
}

/**
 * Reads one role's config, falling back to the hardcoded default for
 * that role if /rolesConfig/{role} hasn't been created yet (e.g. a fresh
 * project, or a built-in role nobody has edited yet via the Roles page).
 */
export async function getRoleConfig(role: ExcoRole): Promise<RoleConfig> {
  const snap = await getDoc(doc(db, "rolesConfig", role));
  return resolveRoleConfig(role, snap.exists() ? (snap.data() as Partial<RoleConfig>) : undefined);
}

/**
 * Loads every role for the Roles & Permissions page and for role pickers:
 * the built-in roles first (filled in with defaults if never customized),
 * then any custom roles that have been added, alphabetically.
 */
export async function listRoleConfigs(): Promise<RoleConfig[]> {
  const snap = await getDocs(collection(db, "rolesConfig"));
  const stored = new Map(snap.docs.map((d) => [d.id, d.data() as Partial<RoleConfig>]));

  const builtIns = BUILT_IN_ROLES.map((r) => resolveRoleConfig(r.id, stored.get(r.id)));
  const custom = [...stored.entries()]
    .filter(([id]) => !isBuiltInRole(id))
    .map(([id, data]) => resolveRoleConfig(id, data))
    .sort((a, b) => a.label.localeCompare(b.label));

  return [...builtIns, ...custom];
}

export async function updateRoleConfig(role: ExcoRole, permissions: Permissions): Promise<void> {
  // merge: true so editing permissions never wipes a custom role's label.
  await setDoc(doc(db, "rolesConfig", role), { role, permissions }, { merge: true });
}

/** "Youth Pastor" → "youth_pastor". Empty string if the label has no letters or digits. */
export function roleIdFromLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export class RoleError extends Error {
  constructor(public code: "empty-name" | "already-exists" | "built-in" | "in-use", message: string) {
    super(message);
  }
}

/** Adds a new role with no permissions; the admin ticks what it should allow afterwards. */
export async function createCustomRole(label: string): Promise<RoleConfig> {
  const cleanLabel = label.trim().replace(/\s+/g, " ");
  const id = roleIdFromLabel(cleanLabel);
  if (!id) throw new RoleError("empty-name", "Give the role a name.");

  // Built-ins always "exist" even if they have no stored doc yet, so check
  // the list as well as Firestore.
  const snap = await getDoc(doc(db, "rolesConfig", id));
  if (isBuiltInRole(id) || snap.exists()) {
    throw new RoleError("already-exists", "A role with that name already exists.");
  }

  const config = resolveRoleConfig(id, { label: cleanLabel });
  await setDoc(doc(db, "rolesConfig", id), config);
  return config;
}

/**
 * Removes a custom role. Built-ins can't be removed, and neither can a
 * role somebody still holds — otherwise they'd be left with a role that
 * has no config and silently no permissions.
 */
export async function deleteCustomRole(role: ExcoRole): Promise<void> {
  if (isBuiltInRole(role)) throw new RoleError("built-in", "Built-in roles can't be removed.");

  const holders = await getDocs(query(collection(db, "excos"), where("role", "==", role), limit(1)));
  if (!holders.empty) {
    throw new RoleError("in-use", "Someone still holds this role. Change their role first.");
  }

  await deleteDoc(doc(db, "rolesConfig", role));
}
