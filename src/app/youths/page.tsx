"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  listYouths,
  createYouth,
  setYouthInactive,
  reactivateYouth,
  getYouthDeleteBlocker,
  deleteYouth,
} from "@/lib/youths";
import { promoteYouthToExco } from "@/lib/excos";
import { listRoleConfigs } from "@/lib/roles";
import { useAuth } from "@/lib/useAuth";
import { formatPersonName } from "@/lib/formatName";
import RequireAuth from "@/components/RequireAuth";
import YouthForm from "@/components/YouthForm";
import { ConfirmDialog } from "@/components/Modal";
import { Page, PageHeader, Card, Field, Badge, Loading, EmptyState, Stat } from "@/components/ui";
import type { Youth, InactiveReason, RoleConfig } from "@/types";

const INACTIVE_REASON_LABEL: Record<InactiveReason, string> = {
  married: "Married",
  left_church: "Left the church",
  other: "Other",
};

type StatusFilter = "active" | "inactive" | "all";
type YouthAction = "delete" | "exco" | "inactive" | "reactivate";

function YouthDirectoryInner() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("canManageRoles");

  // The whole roster is loaded once; the filter and search narrow it client-side
  // so the counts always cover everyone.
  const [allYouths, setAllYouths] = useState<Youth[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("active");
  // The action waiting for confirmation in a dialog, and who it's about.
  const [action, setAction] = useState<{ kind: YouthAction; youth: Youth } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteBlocker, setDeleteBlocker] = useState<string | null>(null);
  const [pickedRole, setPickedRole] = useState("");
  const [pickedReason, setPickedReason] = useState<InactiveReason | "">("");
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [unit, setUnit] = useState("");
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function refresh() {
    setAllYouths(await listYouths());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const activeCount = allYouths.filter((y) => y.active).length;
  const inactiveCount = allYouths.length - activeCount;
  const term = search.trim().toLowerCase();
  const youths = allYouths.filter(
    (y) =>
      (filter === "all" || (filter === "active") === y.active) && (!term || y.name.toLowerCase().includes(term))
  );

  function openAction(kind: YouthAction, youth: Youth) {
    setAction({ kind, youth });
    setActionError(null);
    setDeleteBlocker(null);
    setPickedRole("");
    setPickedReason("");
  }

  function closeAction() {
    if (!actionBusy) setAction(null);
  }

  // Deleting is refused for anyone with money records, so find out as soon
  // as the dialog opens rather than after they've confirmed.
  useEffect(() => {
    if (action?.kind !== "delete") return;
    let cancelled = false;
    getYouthDeleteBlocker(action.youth)
      .then((blocker) => !cancelled && setDeleteBlocker(blocker))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [action]);

  // Only people who can manage excos see "Make exco", so only they need the role list.
  useEffect(() => {
    if (canManage) listRoleConfigs().then(setRoles);
  }, [canManage]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await createYouth({
      name,
      phone: phone || "",
      gender: (gender || "") as Youth["gender"],
      unit: unit || "",
    });
    setName("");
    setPhone("");
    setGender("");
    setUnit("");
    setShowAddForm(false);
    setSaving(false);
    refresh();
  }

  async function runAction() {
    if (!action) return;
    const { kind, youth } = action;
    const who = formatPersonName(youth.name, youth.gender);
    setActionBusy(true);
    setActionError(null);
    try {
      if (kind === "delete") {
        await deleteYouth(youth.id);
      } else if (kind === "exco") {
        // Setting a youth as an exco is just a status change: pick a role
        // and it's done. No email or login here. They're invited later,
        // from the Excos page, when they're ready to sign in.
        await promoteYouthToExco(youth, pickedRole);
      } else if (kind === "inactive") {
        await setYouthInactive(youth.id, pickedReason as InactiveReason);
      } else {
        await reactivateYouth(youth.id);
      }
      setAction(null);
      await refresh();
    } catch {
      setActionError(
        kind === "delete"
          ? `Couldn't delete ${who}. Try again.`
          : kind === "exco"
            ? `Couldn't make ${who} an exco. Try again.`
            : `Couldn't update ${who}. Try again.`
      );
    } finally {
      setActionBusy(false);
    }
  }

  const editingYouth = youths.find((y) => y.id === editingId) ?? null;

  return (
    <Page>
      <PageHeader
        title="Youths"
        description="The full youth roster. Dues, attendance and contributions are tracked against these records."
        actions={
          <button onClick={() => setShowAddForm((s) => !s)} className={showAddForm ? "btn-secondary" : "btn-primary"}>
            {showAddForm ? "Cancel" : "Add youth"}
          </button>
        }
      />

      <div className="space-y-6">
        {showAddForm && (
          <Card title="Add a youth">
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name">
                  <input value={name} onChange={(e) => setName(e.target.value)} className="input" required />
                </Field>
                <Field label="Gender">
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className="input">
                    <option value="">Not specified</option>
                    <option value="male">Male (Bro)</option>
                    <option value="female">Female (Sis)</option>
                  </select>
                </Field>
                <Field label="Phone (optional)">
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
                </Field>
                <Field label="Unit (optional)">
                  <input value={unit} onChange={(e) => setUnit(e.target.value)} className="input" />
                </Field>
              </div>
              <button disabled={saving} className="btn-primary">
                {saving ? "Adding…" : "Add youth"}
              </button>
            </form>
          </Card>
        )}

        {editingYouth && (
          <YouthForm
            existing={editingYouth}
            onSaved={() => {
              setEditingId(null);
              refresh();
            }}
            onCancel={() => setEditingId(null)}
          />
        )}

        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ["active", "Active", activeCount],
              ["inactive", "Inactive", inactiveCount],
              ["all", "All youths", allYouths.length],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={[
                "card !p-4 text-left transition-colors",
                filter === value ? "!border-rccg-purple-400 bg-rccg-purple-50" : "hover:border-rccg-purple-300",
              ].join(" ")}
            >
              <Stat label={label} value={count} tone={value === "active" ? "green" : value === "all" ? "purple" : "default"} />
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            aria-label="Search by name"
            className="input sm:max-w-xs"
          />
          <p className="text-sm text-muted">
            Showing <span className="num font-semibold text-ink">{youths.length}</span>{" "}
            {filter === "all" ? "youths" : `${filter} ${youths.length === 1 ? "youth" : "youths"}`}
          </p>
        </div>

        {loading ? (
          <Loading />
        ) : youths.length === 0 ? (
          <EmptyState
            title="No youths found"
            description={
              search
                ? "Try a different spelling."
                : allYouths.length > 0
                  ? `There are no ${filter} youths.`
                  : "Add the first youth to get started."
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Unit</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {youths.map((y) => (
                  <tr key={y.id}>
                    <td className="whitespace-nowrap">
                      <Link href={`/youths/${y.id}`} className="link uppercase">
                        {formatPersonName(y.name, y.gender)}
                      </Link>
                      {y.linkedExcoId && (
                        <span className="ml-2">
                          <Badge tone="purple">Exco</Badge>
                        </span>
                      )}
                    </td>
                    <td className="text-muted">{y.unit || "—"}</td>
                    <td className="whitespace-nowrap text-muted">{y.phone || "—"}</td>
                    <td>
                      {y.active ? (
                        <Badge tone="green" dot>
                          Active
                        </Badge>
                      ) : (
                        <Badge tone="gray">
                          Inactive{y.inactiveReason && `, ${INACTIVE_REASON_LABEL[y.inactiveReason].toLowerCase()}`}
                        </Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <button onClick={() => setEditingId(y.id)} className="btn-ghost">
                        Edit
                      </button>
                      {y.active && (
                        <button onClick={() => openAction("inactive", y)} className="btn-ghost !text-muted">
                          Mark inactive
                        </button>
                      )}
                      {!y.active && (
                        <button onClick={() => openAction("reactivate", y)} className="btn-ghost">
                          Reactivate
                        </button>
                      )}
                      {canManage &&
                        (y.linkedExcoId ? (
                          <Link href={`/excos/${y.linkedExcoId}`} className="btn-ghost">
                            View exco
                          </Link>
                        ) : (
                          <button onClick={() => openAction("exco", y)} className="btn-ghost">
                            Make exco
                          </button>
                        ))}
                      {canManage && (
                        <button onClick={() => openAction("delete", y)} className="btn-ghost-danger">
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {action && (
        <ConfirmDialog
          open
          title={
            action.kind === "delete"
              ? "Delete this youth?"
              : action.kind === "exco"
                ? "Make this youth an exco?"
                : action.kind === "inactive"
                  ? "Mark this youth inactive?"
                  : "Reactivate this youth?"
          }
          subject={{
            name: formatPersonName(action.youth.name, action.youth.gender),
            detail: [action.youth.unit, action.youth.phone].filter(Boolean).join(" · ") || undefined,
          }}
          tone={action.kind === "delete" ? "danger" : "primary"}
          confirmLabel={
            action.kind === "delete"
              ? "Delete for good"
              : action.kind === "exco"
                ? "Make exco"
                : action.kind === "inactive"
                  ? "Mark inactive"
                  : "Reactivate"
          }
          busyLabel={action.kind === "delete" ? "Deleting…" : "Saving…"}
          busy={actionBusy}
          error={actionError}
          blockedReason={
            action.kind === "delete" && deleteBlocker
              ? `${deleteBlocker} You can mark them inactive instead.`
              : null
          }
          confirmDisabled={
            (action.kind === "exco" && !pickedRole) || (action.kind === "inactive" && !pickedReason)
          }
          onConfirm={runAction}
          onCancel={closeAction}
          description={
            action.kind === "delete" ? (
              <>This permanently removes their record. It can&apos;t be undone.</>
            ) : action.kind === "exco" ? (
              <>
                They&apos;ll appear on the Excos page as &ldquo;Not invited&rdquo;. You can invite them to sign in
                from there when they&apos;re ready.
              </>
            ) : action.kind === "inactive" ? (
              <>They&apos;ll leave the active roster, and their records are kept.</>
            ) : (
              <>They&apos;ll go back on the active roster.</>
            )
          }
        >
          {action.kind === "exco" && (
            <Field label="Role">
              <select value={pickedRole} onChange={(e) => setPickedRole(e.target.value)} className="input">
                <option value="" disabled>
                  Choose a role…
                </option>
                {roles.map((r) => (
                  <option key={r.role} value={r.role}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {action.kind === "inactive" && (
            <Field label="Reason">
              <select
                value={pickedReason}
                onChange={(e) => setPickedReason(e.target.value as InactiveReason)}
                className="input"
              >
                <option value="" disabled>
                  Choose a reason…
                </option>
                {Object.entries(INACTIVE_REASON_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </ConfirmDialog>
      )}
    </Page>
  );
}

export default function YouthDirectoryPage() {
  return (
    <RequireAuth>
      <YouthDirectoryInner />
    </RequireAuth>
  );
}
