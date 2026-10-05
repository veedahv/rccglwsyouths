"use client";

import { useEffect, useState } from "react";
import {
  listRoleConfigs,
  updateRoleConfig,
  createCustomRole,
  deleteCustomRole,
  isBuiltInRole,
  RoleError,
} from "@/lib/roles";
import { useAuth } from "@/lib/useAuth";
import RequireAuth from "@/components/RequireAuth";
import { Page, PageHeader, Card, Field, Loading, Notice } from "@/components/ui";
import type { RoleConfig, Permissions, ExcoRole } from "@/types";

const PERMISSION_LABEL: Record<keyof Permissions, string> = {
  canEditFinance: "Edit finance (dues, contributions, transactions)",
  canEditMinutes: "Edit meeting minutes and attendance",
  canEditEvents: "Edit events (agenda, tasks, attendance)",
  canManageRoles: "Manage excos and permissions",
};
const PERMISSION_KEYS = Object.keys(PERMISSION_LABEL) as (keyof Permissions)[];
const SHORT_LABEL: Record<keyof Permissions, string> = {
  canEditFinance: "Finance",
  canEditMinutes: "Minutes",
  canEditEvents: "Events",
  canManageRoles: "Roles",
};

function RolesInner() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("canManageRoles");

  const [configs, setConfigs] = useState<RoleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState<ExcoRole | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [addingRole, setAddingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setConfigs(await listRoleConfigs());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function togglePermission(config: RoleConfig, key: keyof Permissions) {
    if (!canEdit || config.role === "super_admin") return; // super_admin is always full access, not editable
    setSavingRole(config.role);
    const nextPermissions = { ...config.permissions, [key]: !config.permissions[key] };
    setConfigs((prev) =>
      prev.map((c) => (c.role === config.role ? { ...c, permissions: nextPermissions } : c))
    );
    await updateRoleConfig(config.role, nextPermissions);
    setSavingRole(null);
  }

  async function handleAddRole(e: React.FormEvent) {
    e.preventDefault();
    setRoleError(null);
    setAddingRole(true);
    try {
      await createCustomRole(newRoleName);
      setNewRoleName("");
      await refresh();
    } catch (err) {
      setRoleError(err instanceof RoleError ? err.message : "Couldn't add this role. Try again.");
    } finally {
      setAddingRole(false);
    }
  }

  async function handleDeleteRole(config: RoleConfig) {
    setRoleError(null);
    try {
      await deleteCustomRole(config.role);
      await refresh();
    } catch (err) {
      setRoleError(err instanceof RoleError ? err.message : "Couldn't remove this role. Try again.");
    }
  }

  return (
    <Page size="md">
      <PageHeader
        title="Roles and permissions"
        description={
          canEdit
            ? "Visible to every exco. Editing a role here changes what everyone with that role can do. You can also add new roles."
            : "Visible to every exco. Only someone with “Manage excos and permissions” can change these."
        }
      />

      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          {roleError && <Notice tone="error">{roleError}</Notice>}

          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Role</th>
                  {PERMISSION_KEYS.map((key) => (
                    <th key={key} className="text-center">
                      {SHORT_LABEL[key]}
                    </th>
                  ))}
                  {canEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {configs.map((config) => {
                  const isSuperAdmin = config.role === "super_admin";
                  return (
                    <tr key={config.role}>
                      <td className="whitespace-nowrap font-medium">{config.label}</td>
                      {PERMISSION_KEYS.map((key) => (
                        <td key={key} className="text-center">
                          <input
                            type="checkbox"
                            checked={isSuperAdmin ? true : config.permissions[key]}
                            disabled={!canEdit || isSuperAdmin || savingRole === config.role}
                            onChange={() => togglePermission(config, key)}
                            aria-label={`${config.label}: ${PERMISSION_LABEL[key]}`}
                            className="h-4 w-4 accent-rccg-green-600"
                          />
                        </td>
                      ))}
                      {canEdit && (
                        <td className="whitespace-nowrap text-right">
                          {!isBuiltInRole(config.role) && (
                            <button onClick={() => handleDeleteRole(config)} className="btn-ghost !text-muted">
                              Remove
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {canEdit && (
            <Card
              title="Add a role"
              description="New roles start with no permissions. Tick what they should be able to do in the table above."
            >
              <form onSubmit={handleAddRole} className="flex max-w-md flex-wrap items-end gap-3">
                <Field label="Role name" className="min-w-0 flex-1">
                  <input
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="e.g. Welfare Officer"
                    className="input"
                    required
                  />
                </Field>
                <button type="submit" disabled={addingRole} className="btn-primary">
                  {addingRole ? "Adding…" : "Add role"}
                </button>
              </form>
            </Card>
          )}

          <Card title="What each permission allows">
            <dl className="space-y-2 text-sm">
              {PERMISSION_KEYS.map((key) => (
                <div key={key} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                  <dt className="w-20 shrink-0 font-semibold text-rccg-purple-800">{SHORT_LABEL[key]}</dt>
                  <dd className="text-muted">{PERMISSION_LABEL[key]}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-muted">
              Super Admin always has full access and can't be restricted from this table.
            </p>
          </Card>
        </div>
      )}
    </Page>
  );
}

export default function RolesPage() {
  return (
    <RequireAuth>
      <RolesInner />
    </RequireAuth>
  );
}
