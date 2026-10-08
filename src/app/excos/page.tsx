"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listExcos, retireExco, reinstateExco, resendInvite, hasLogin } from "@/lib/excos";
import { listRoleConfigs, fallbackRoleLabel } from "@/lib/roles";
import { useAuth } from "@/lib/useAuth";
import RequireAuth from "@/components/RequireAuth";
import ExcoForm from "@/components/ExcoForm";
import InviteExcoForm from "@/components/InviteExcoForm";
import ExternalAdminForm from "@/components/ExternalAdminForm";
import { ConfirmDialog } from "@/components/Modal";
import { formatPersonName } from "@/lib/formatName";
import { Page, PageHeader, Badge, Loading, EmptyState, Notice } from "@/components/ui";
import type { ExcoMember, RoleConfig } from "@/types";

function ExcoDirectoryInner() {
  const { hasPermission } = useAuth();
  const [excos, setExcos] = useState<ExcoMember[]>([]);
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [search, setSearch] = useState("");
  const [showRetired, setShowRetired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ExcoMember | null>(null);
  const [inviting, setInviting] = useState<ExcoMember | null>(null);
  const [addingExternal, setAddingExternal] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  // The action waiting for confirmation in a dialog, and who it's about.
  const [action, setAction] = useState<{ kind: "retire" | "reinstate" | "resend"; exco: ExcoMember } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const canManage = hasPermission("canManageRoles");

  async function refresh() {
    setLoading(true);
    const [data, roleConfigs] = await Promise.all([
      listExcos({ activeOnly: !showRetired, search }),
      listRoleConfigs(),
    ]);
    setExcos(data);
    setRoles(roleConfigs);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, showRetired]);

  const roleLabel = (role: string) => roles.find((r) => r.role === role)?.label ?? fallbackRoleLabel(role);

  function openAction(kind: "retire" | "reinstate" | "resend", exco: ExcoMember) {
    setAction({ kind, exco });
    setActionError(null);
    setNotice(null);
  }

  async function runAction() {
    if (!action) return;
    const { kind, exco } = action;
    const who = formatPersonName(exco.name, exco.gender);
    setActionBusy(true);
    setActionError(null);
    try {
      if (kind === "resend") {
        if (!exco.email) throw new Error("no-email");
        await resendInvite(exco.email);
        setNotice({ tone: "success", text: `Sent ${who} a link to set their password.` });
      } else {
        await (kind === "retire" ? retireExco(exco.id) : reinstateExco(exco.id));
        setNotice({ tone: "success", text: kind === "retire" ? `${who} has been retired.` : `${who} has been reinstated.` });
        await refresh();
      }
      setAction(null);
    } catch {
      setActionError(
        kind === "resend"
          ? "Couldn't send that email. Try again in a moment."
          : `Couldn't ${kind} ${who}. Try again.`
      );
    } finally {
      setActionBusy(false);
    }
  }

  if (editing) {
    return (
      <Page size="sm">
        <ExcoForm
          existing={editing}
          roles={roles}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
          onCancel={() => setEditing(null)}
        />
      </Page>
    );
  }

  if (inviting) {
    return (
      <Page size="sm">
        <InviteExcoForm
          exco={inviting}
          onDone={() => {
            setInviting(null);
            refresh();
          }}
          onCancel={() => setInviting(null)}
        />
      </Page>
    );
  }

  if (addingExternal) {
    return (
      <Page size="sm">
        <ExternalAdminForm
          onDone={() => {
            setAddingExternal(false);
            refresh();
          }}
          onCancel={() => setAddingExternal(false)}
        />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Excos"
        description={
          canManage ? (
            <>
              Make a youth an exco from the{" "}
              <Link href="/youths" className="link">
                Youths
              </Link>{" "}
              page, then invite them here when they&apos;re ready to log in. Pastors and other non-youths can be
              added as external admins.
            </>
          ) : (
            "The executives who manage the youth department."
          )
        }
        actions={
          canManage && (
            <button onClick={() => setAddingExternal(true)} className="btn-primary">
              Add external admin
            </button>
          )
        }
      />

      {notice && (
        <Notice tone={notice.tone} className="mb-4">
          {notice.text}
        </Notice>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          aria-label="Search by name"
          className="input sm:max-w-xs"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showRetired}
            onChange={(e) => setShowRetired(e.target.checked)}
            className="h-4 w-4 accent-rccg-green-600"
          />
          Show retired
        </label>
      </div>

      {loading ? (
        <Loading />
      ) : excos.length === 0 ? (
        <EmptyState title="No excos found" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Unit</th>
                <th>Phone</th>
                <th>Login</th>
                <th>Status</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {excos.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap">
                    <Link href={`/excos/${m.id}`} className="link">
                      {formatPersonName(m.name, m.gender)}
                    </Link>
                    {m.external && (
                      <span className="ml-2">
                        <Badge tone="purple">External</Badge>
                      </span>
                    )}
                  </td>
                  <td>
                    <div>{roleLabel(m.role)}</div>
                    {m.title && <div className="text-xs text-muted">{m.title}</div>}
                  </td>
                  <td className="text-muted">{m.unit || "—"}</td>
                  <td className="whitespace-nowrap text-muted">{m.phone || "—"}</td>
                  <td>
                    {hasLogin(m) ? (
                      <Badge tone="green">Has login</Badge>
                    ) : (
                      <Badge tone="amber">Not invited</Badge>
                    )}
                  </td>
                  <td>
                    {m.active ? (
                      <Badge tone="green" dot>
                        Active
                      </Badge>
                    ) : (
                      <Badge tone="gray">Retired</Badge>
                    )}
                  </td>
                  {canManage && (
                    <td className="whitespace-nowrap text-right">
                      {m.active &&
                        (hasLogin(m) ? (
                          m.email && (
                            <button onClick={() => openAction("resend", m)} className="btn-ghost">
                              Resend invite
                            </button>
                          )
                        ) : (
                          <button onClick={() => setInviting(m)} className="btn-ghost">
                            Invite
                          </button>
                        ))}
                      <button onClick={() => setEditing(m)} className="btn-ghost">
                        Edit
                      </button>
                      <button onClick={() => openAction(m.active ? "retire" : "reinstate", m)} className="btn-ghost !text-muted">
                        {m.active ? "Retire" : "Reinstate"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {action && (
        <ConfirmDialog
          open
          title={
            action.kind === "retire"
              ? "Retire this exco?"
              : action.kind === "reinstate"
                ? "Reinstate this exco?"
                : "Resend the invite?"
          }
          subject={{
            name: formatPersonName(action.exco.name, action.exco.gender),
            detail:
              action.kind === "resend"
                ? action.exco.email
                : [roleLabel(action.exco.role), action.exco.title].filter(Boolean).join(" · "),
          }}
          tone={action.kind === "retire" ? "danger" : "primary"}
          confirmLabel={
            action.kind === "retire" ? "Retire" : action.kind === "reinstate" ? "Reinstate" : "Send the email"
          }
          busyLabel={action.kind === "resend" ? "Sending…" : "Saving…"}
          busy={actionBusy}
          error={actionError}
          onConfirm={runAction}
          onCancel={() => !actionBusy && setAction(null)}
          description={
            action.kind === "retire" ? (
              <>
                They&apos;ll lose access to the platform straight away. Their records are kept, and you can
                reinstate them later.
              </>
            ) : action.kind === "reinstate" ? (
              <>They&apos;ll get their access back, with the same role as before.</>
            ) : (
              <>This emails them a link to set their password.</>
            )
          }
        />
      )}
    </Page>
  );
}

export default function ExcoDirectoryPage() {
  return (
    <RequireAuth>
      <ExcoDirectoryInner />
    </RequireAuth>
  );
}
