"use client";

import { useEffect, useState } from "react";
import {
  getAttendanceForGathering,
  markPresent,
  unmarkPresent,
  GatheringType,
} from "@/lib/attendance";
import { createYouth } from "@/lib/youths";
import { useAuth } from "@/lib/useAuth";
import { formatPersonName } from "@/lib/formatName";
import { todayISO } from "@/lib/format";
import { Loading } from "@/components/ui";
import type { Attendee, Youth } from "@/types";

interface Props {
  gatheringType: GatheringType;
  gatheringId: string;
  people: Attendee[]; // who's expected: all youths, the excos, or a selected group
  canEdit: boolean;
  // "Add someone not on this list" creates a new youth, which makes sense
  // for youth meetings and events but not for an exco meeting (excos are
  // managed on the Excos page), so the parent can turn it off.
  allowQuickAdd?: boolean;
  onYouthAdded?: (youth: Youth) => void; // let the parent refresh its list
}

export default function AttendanceChecklist({
  gatheringType,
  gatheringId,
  people,
  canEdit,
  allowQuickAdd = true,
  onYouthAdded,
}: Props) {
  const { user } = useAuth();
  const [present, setPresent] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAddYouth, setShowAddYouth] = useState(false);
  const [newYouthName, setNewYouthName] = useState("");
  const [addingYouth, setAddingYouth] = useState(false);

  useEffect(() => {
    getAttendanceForGathering(gatheringType, gatheringId).then((set) => {
      setPresent(set);
      setLoading(false);
    });
  }, [gatheringType, gatheringId]);

  async function toggle(youthId: string) {
    if (!canEdit || !user) return;
    setPendingId(youthId);
    try {
      if (present.has(youthId)) {
        await unmarkPresent(gatheringType, gatheringId, youthId);
        setPresent((prev) => {
          const next = new Set(prev);
          next.delete(youthId);
          return next;
        });
      } else {
        await markPresent(gatheringType, gatheringId, youthId, user.uid);
        setPresent((prev) => new Set(prev).add(youthId));
      }
    } finally {
      setPendingId(null);
    }
  }

  // Quick-add: someone shows up who isn't on the roster yet. Creates
  // their youth record and immediately marks them present here.
  async function handleAddYouth(e: React.FormEvent) {
    e.preventDefault();
    if (!newYouthName.trim() || !user) return;
    setAddingYouth(true);
    try {
      const id = await createYouth({ name: newYouthName.trim() });
      const youth: Youth = {
        id,
        name: newYouthName.trim(),
        active: true,
        joinedAt: todayISO(),
      };
      onYouthAdded?.(youth);
      await markPresent(gatheringType, gatheringId, id, user.uid);
      setPresent((prev) => new Set(prev).add(id));
      setNewYouthName("");
      setShowAddYouth(false);
    } finally {
      setAddingYouth(false);
    }
  }

  if (loading) return <Loading label="Loading attendance…" />;

  const filtered = search
    ? people.filter((y) => y.name.toLowerCase().includes(search.toLowerCase()))
    : people;

  // Count only people on the list, so someone who was marked present and
  // has since been taken off it (inactive, or removed from the group)
  // can't push this past 100%.
  const presentCount = people.filter((p) => present.has(p.id)).length;
  const percent = people.length > 0 ? Math.round((presentCount / people.length) * 100) : 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[10rem] flex-1">
          <p className="text-sm text-muted">
            <span className="num font-semibold text-ink">{presentCount}</span> of {people.length} present
          </p>
          <div
            className="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-rccg-purple-100"
            role="img"
            aria-label={`${percent}% present`}
          >
            <div className="h-full bg-rccg-green-500" style={{ width: `${percent}%` }} />
          </div>
        </div>
        {canEdit && (
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            aria-label="Search the list"
            className="input w-44 py-1.5"
          />
        )}
      </div>

      <ul className="divide-y divide-line rounded-lg border border-line text-sm">
        {filtered.map((y) => {
          const isPresent = present.has(y.id);
          return (
            <li key={y.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="font-medium">{formatPersonName(y.name, y.gender)}</span>
              <button
                disabled={!canEdit || pendingId === y.id}
                onClick={() => toggle(y.id)}
                aria-pressed={isPresent}
                className={[
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  isPresent
                    ? "bg-rccg-green-50 text-rccg-green-700"
                    : "bg-gray-100 text-gray-500",
                  canEdit ? "cursor-pointer hover:brightness-95" : "cursor-default",
                ].join(" ")}
              >
                {isPresent ? "Present" : "Absent"}
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="px-3 py-4 text-center text-muted">
            {search ? `No one matches “${search}”.` : "No one is on this list yet."}
          </li>
        )}
      </ul>

      {canEdit && allowQuickAdd && (
        <div className="mt-3">
          {showAddYouth ? (
            <form onSubmit={handleAddYouth} className="flex flex-wrap items-center gap-2">
              <input
                value={newYouthName}
                onChange={(e) => setNewYouthName(e.target.value)}
                placeholder="Full name"
                aria-label="Full name"
                className="input min-w-[10rem] flex-1"
                autoFocus
              />
              <button type="submit" disabled={addingYouth} className="btn-primary btn-sm">
                {addingYouth ? "Adding…" : "Add and mark present"}
              </button>
              <button type="button" onClick={() => setShowAddYouth(false)} className="btn-secondary btn-sm">
                Cancel
              </button>
            </form>
          ) : (
            <button onClick={() => setShowAddYouth(true)} className="btn-secondary btn-sm">
              Add someone not on this list
            </button>
          )}
        </div>
      )}
    </div>
  );
}
