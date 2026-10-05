"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getExco, hasLogin } from "@/lib/excos";
import { getRoleConfig } from "@/lib/roles";
import { formatPersonName } from "@/lib/formatName";
import RequireAuth from "@/components/RequireAuth";
import { Page, PageHeader, Card, Badge, Loading, Notice } from "@/components/ui";
import type { ExcoMember, RoleConfig, Permissions } from "@/types";

const PERMISSION_LABEL: Record<keyof Permissions, string> = {
  canEditFinance: "Edit finance (dues, contributions, transactions)",
  canEditMinutes: "Edit meeting minutes and attendance",
  canEditEvents: "Edit events (agenda, tasks, attendance)",
  canManageRoles: "Manage excos and permissions",
};

function ExcoProfileInner({ id }: { id: string }) {
  const [exco, setExco] = useState<ExcoMember | null>(null);
  const [roleConfig, setRoleConfig] = useState<RoleConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getExco(id).then(async (data) => {
      setExco(data);
      if (data) setRoleConfig(await getRoleConfig(data.role));
      setLoading(false);
    });
  }, [id]);

  if (loading)
    return (
      <Page size="md">
        <Loading />
      </Page>
    );
  if (!exco)
    return (
      <Page size="md">
        <Notice tone="error">Exco not found.</Notice>
      </Page>
    );

  const roleName = roleConfig?.label ?? "";

  return (
    <Page size="md">
      <PageHeader
        title={formatPersonName(exco.name, exco.gender)}
        backHref="/excos"
        backLabel="Excos"
        description={[roleName, exco.title, exco.unit].filter(Boolean).join(", ")}
        actions={
          <>
            {exco.external && <Badge tone="purple">External</Badge>}
            {hasLogin(exco) ? <Badge tone="green">Has login</Badge> : <Badge tone="amber">Not invited</Badge>}
            {exco.active ? <Badge tone="green" dot>Active</Badge> : <Badge tone="gray">Retired</Badge>}
          </>
        }
      >
        <p className="mt-2 text-sm text-muted">{[exco.email, exco.phone].filter(Boolean).join(", ")}</p>
      </PageHeader>

      <Card
        title="Permissions (via role)"
        action={
          <Link href="/roles" className="btn-ghost">
            Edit on Roles
          </Link>
        }
      >
        {exco.role === "super_admin" ? (
          <p className="text-sm text-muted">Super Admin always has full access.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {roleConfig &&
              (Object.keys(PERMISSION_LABEL) as (keyof Permissions)[]).map((key) => (
                <li key={key} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span>{PERMISSION_LABEL[key]}</span>
                  {roleConfig.permissions[key] ? <Badge tone="green">Yes</Badge> : <Badge tone="gray">No</Badge>}
                </li>
              ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">
          These apply to everyone with the “{roleName}” role, not just {formatPersonName(exco.name, exco.gender)}.
        </p>
      </Card>
    </Page>
  );
}

export default function ExcoProfilePage({ params }: { params: { id: string } }) {
  return (
    <RequireAuth>
      <ExcoProfileInner id={params.id} />
    </RequireAuth>
  );
}
