"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getYouth } from "@/lib/youths";
import { getYouthAttendance, AttendedGathering } from "@/lib/attendance";
import { formatPersonName } from "@/lib/formatName";
import { formatDate, naira } from "@/lib/format";
import RequireAuth from "@/components/RequireAuth";
import YouthForm from "@/components/YouthForm";
import { Page, PageHeader, Card, Stat, Badge, Loading, Notice } from "@/components/ui";
import type { Youth, DuesRecord, InactiveReason } from "@/types";

const INACTIVE_REASON_LABEL: Record<InactiveReason, string> = {
  married: "Married",
  left_church: "Left the church",
  other: "Other",
};

function formatMonth(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("default", { month: "long", year: "numeric" });
}

function YouthProfileInner({ id }: { id: string }) {
  const [youth, setYouth] = useState<Youth | null>(null);
  const [dues, setDues] = useState<DuesRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendedGathering[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  async function load() {
    setLoading(true);
    const [youthData, duesSnap, attendanceData] = await Promise.all([
      getYouth(id),
      getDocs(query(collection(db, `youths/${id}/dues`), orderBy("yearMonth", "desc"))),
      getYouthAttendance(id),
    ]);
    setYouth(youthData);
    setDues(duesSnap.docs.map((d) => d.data() as DuesRecord));
    setAttendance(attendanceData);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading)
    return (
      <Page size="md">
        <Loading />
      </Page>
    );
  if (!youth)
    return (
      <Page size="md">
        <Notice tone="error">Youth not found.</Notice>
      </Page>
    );

  if (editing) {
    return (
      <Page size="sm">
        <YouthForm
          existing={youth}
          onSaved={() => {
            setEditing(false);
            load();
          }}
          onCancel={() => setEditing(false)}
        />
      </Page>
    );
  }

  const currentYear = new Date().getFullYear().toString();
  const paidThisYear = dues
    .filter((d) => d.yearMonth.startsWith(currentYear))
    .reduce((sum, d) => sum + d.totalPaid, 0);

  return (
    <Page size="md">
      <PageHeader
        title={formatPersonName(youth.name, youth.gender)}
        backHref="/youths"
        backLabel="Youths"
        description={[youth.unit, youth.phone].filter(Boolean).join(", ") || undefined}
        actions={
          <>
            {youth.active ? (
              <Badge tone="green" dot>
                Active
              </Badge>
            ) : (
              <Badge tone="gray">
                Inactive{youth.inactiveReason && `, ${INACTIVE_REASON_LABEL[youth.inactiveReason].toLowerCase()}`}
              </Badge>
            )}
            <button onClick={() => setEditing(true)} className="btn-secondary btn-sm">
              Edit
            </button>
          </>
        }
      />

      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="card">
            <Stat label={`Dues paid in ${currentYear}`} value={naira(paidThisYear)} tone="green" />
          </div>
          <div className="card">
            <Stat label="Gatherings attended" value={attendance.length} tone="purple" />
          </div>
        </section>

        <Card title="Dues history">
          {dues.length === 0 ? (
            <p className="text-sm text-muted">No dues recorded yet.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {dues.map((d) => (
                <li key={d.yearMonth} className="flex justify-between py-2.5 first:pt-0 last:pb-0">
                  <span>{formatMonth(d.yearMonth)}</span>
                  <span className="num font-medium">{naira(d.totalPaid)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent attendance" description={attendance.length > 10 ? "Showing the latest 10" : undefined}>
          {attendance.length === 0 ? (
            <p className="text-sm text-muted">No attendance recorded yet.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {attendance.slice(0, 10).map((a) => (
                <li
                  key={`${a.type}-${a.id}`}
                  className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="font-medium">{a.title}</span>
                  <span className="shrink-0 text-muted">
                    {formatDate(a.date)} <span className="capitalize">({a.type})</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Page>
  );
}

export default function YouthProfilePage({ params }: { params: { id: string } }) {
  return (
    <RequireAuth>
      <YouthProfileInner id={params.id} />
    </RequireAuth>
  );
}
