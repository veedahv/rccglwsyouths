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
import { Page, PageHeader, Card, Field, Badge, Loading, EmptyState, Notice, Stat } from "@/components/ui";
import type { Youth, InactiveReason, RoleConfig } from "@/types";

const INACTIVE_REASON_LABEL: Record<InactiveReason, string> = {
  married: "Married",
  left_church: "Left the church",
  other: "Other",
};

type StatusFilter = "active" | "inactive" | "all";

function YouthDirectoryInner() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("canManageRoles");

  // The whole roster is loaded once; the filter and search narrow it client-side
  // so the counts always cover everyone.
  const [allYouths, setAllYouths] = useState<Youth[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("active");
  const [deletingId, setDeletingId] = useState<string | null>(null); // row showing the confirm
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [unit, setUnit] = useState("");
  const [saving, setSaving] = useState(false);
  const [retiringId, setRetiringId] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [promoteError, setPromoteError] = useState<string | null>(null);
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

  async function handleDelete(youth: Youth) {
    setDeleteError(null);
    setBusyDeleteId(youth.id);
    try {
      const blocker = await getYouthDeleteBlocker(youth);
      if (blocker) {
        setDeleteError(`Can't delete ${formatPersonName(youth.name, youth.gender)}. ${blocker}`);
      } else {
        await deleteYouth(youth.id);
        await refresh();
      }
    } catch {
      setDeleteError(`Couldn't delete ${formatPersonName(youth.name, youth.gender)}. Try again.`);
    } finally {
      setBusyDeleteId(null);
      setDeletingId(null);
    }
  }

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

  async function handleSetInactive(id: string, reason: InactiveReason) {
    await setYouthInactive(id, reason);
    setRetiringId(null);
    refresh();
  }

  // Setting a youth as an exco is just a status change: pick a role and
  // it's done. No email or login here. They're invited later, from the
  // Excos page, when they're ready to sign in.
  async function handleMakeExco(youth: Youth, role: string) {
    setPromoteError(null);
    try {
      await promoteYouthToExco(youth, role);
      setPromotingId(null);
      refresh();
    } catch {
      setPromoteError(`Couldn't make ${formatPersonName(youth.name, youth.gender)} an exco. Try again.`);
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

        {promoteError && <Notice tone="error">{promoteError}</Notice>}
        {deleteError && <Notice tone="error">{deleteError}</Notice>}

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
                      {y.active &&
                        (retiringId === y.id ? (
                          <select
                            autoFocus
                            onChange={(e) => handleSetInactive(y.id, e.target.value as InactiveReason)}
                            onBlur={() => setRetiringId(null)}
                            aria-label="Reason for marking inactive"
                            className="input ml-1 w-auto py-1 text-xs"
                            defaultValue=""
                          >
                            <option value="" disabled>
                              Reason…
                            </option>
                            {Object.entries(INACTIVE_REASON_LABEL).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <button onClick={() => setRetiringId(y.id)} className="btn-ghost !text-muted">
                            Mark inactive
                          </button>
                        ))}
                      {!y.active && (
                        <button onClick={() => reactivateYouth(y.id).then(refresh)} className="btn-ghost">
                          Reactivate
                        </button>
                      )}
                      {canManage &&
                        (y.linkedExcoId ? (
                          <Link href={`/excos/${y.linkedExcoId}`} className="btn-ghost">
                            View exco
                          </Link>
                        ) : promotingId === y.id ? (
                          <select
                            autoFocus
                            onChange={(e) => handleMakeExco(y, e.target.value)}
                            onBlur={() => setPromotingId(null)}
                            aria-label="Role for the new exco"
                            className="input ml-1 w-auto py-1 text-xs"
                            defaultValue=""
                          >
                            <option value="" disabled>
                              Role…
                            </option>
                            {roles.map((r) => (
                              <option key={r.role} value={r.role}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => {
                              setPromoteError(null);
                              setPromotingId(y.id);
                            }}
                            className="btn-ghost"
                          >
                            Make exco
                          </button>
                        ))}
                      {canManage &&
                        (deletingId === y.id ? (
                          <span className="ml-1 inline-flex items-center gap-1 text-xs">
                            <span className="text-muted">Delete for good?</span>
                            <button
                              onClick={() => handleDelete(y)}
                              disabled={busyDeleteId === y.id}
                              className="btn-ghost-danger"
                            >
                              {busyDeleteId === y.id ? "Deleting…" : "Yes, delete"}
                            </button>
                            <button onClick={() => setDeletingId(null)} className="btn-ghost">
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setDeleteError(null);
                              setDeletingId(y.id);
                            }}
                            className="btn-ghost-danger"
                          >
                            Delete
                          </button>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
