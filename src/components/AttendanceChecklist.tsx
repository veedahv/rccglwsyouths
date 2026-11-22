"use client";

import { useEffect, useState } from "react";
import {
  getAttendanceForGathering,
  markPresent,
  unmarkPresent,
  GatheringType,
} from "@/lib/attendance";
import { addGuest, listGuests, makeGuestAYouth, removeGuest } from "@/lib/guests";
import { createYouth } from "@/lib/youths";
import { useAuth } from "@/lib/useAuth";
import { formatPersonName } from "@/lib/formatName";
import { todayISO } from "@/lib/format";
import { Badge, Loading, Notice } from "@/components/ui";
import type { Attendee, Guest, Youth } from "@/types";

interface Props {
  gatheringType: GatheringType;
  gatheringId: string;
  people: Attendee[]; // who's expected: all youths, the excos, or a selected group
  canEdit: boolean;
  // "Add someone not on this list" lets you add a guest or a new youth, which makes sense for youth
  // meetings and events but not for an exco meeting (excos are managed on the Excos page), so the
  // parent can turn it off.
  allowQuickAdd?: boolean;
  onYouthAdded?: (youth: Youth) => void; // let the parent refresh its list
}

type AddKind = "guest" | "youth";

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
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  // Someone who isn't on the list is usually a visitor, so that is the starting choice. A guest is listed
  // for this gathering only; a youth joins the youth list.
  const [addKind, setAddKind] = useState<AddKind>("guest");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getAttendanceForGathering(gatheringType, gatheringId),
      // If guests can't be read (say, the new rules aren't deployed yet), the youths' attendance still loads.
      listGuests(gatheringType, gatheringId).catch(() => [] as Guest[]),
    ]).then(([set, guestList]) => {
      setPresent(set);
      setGuests(guestList);
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

  // Someone shows up who isn't on the list. As a guest they are listed for this gathering only; as a youth
  // their record is created on the roster and they are marked present here.
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name || !user) return;
    setAdding(true);
    setError(null);
    try {
      if (addKind === "guest") {
        const guest = await addGuest(gatheringType, gatheringId, name, user.uid);
        setGuests((prev) => [...prev, guest]);
      } else {
        const id = await createYouth({ name });
        onYouthAdded?.({ id, name, active: true, joinedAt: todayISO() });
        await markPresent(gatheringType, gatheringId, id, user.uid);
        setPresent((prev) => new Set(prev).add(id));
      }
      setNewName("");
      setShowAdd(false);
    } catch (err) {
      console.error(err);
      setError(`Couldn't add ${addKind === "guest" ? "the guest" : "the youth"}. Check your connection and try again.`);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveGuest(guest: Guest) {
    if (!window.confirm(`Remove ${guest.name} from the guests?`)) return;
    setPendingId(guest.id);
    setError(null);
    try {
      await removeGuest(gatheringType, gatheringId, guest.id);
      setGuests((prev) => prev.filter((g) => g.id !== guest.id));
    } catch (err) {
      console.error(err);
      setError("Couldn't remove the guest. Try again.");
    } finally {
      setPendingId(null);
    }
  }

  // For a guest who has joined, or who was added as a guest by mistake.
  async function handleMakeYouth(guest: Guest) {
    if (!user) return;
    if (!window.confirm(`Add ${guest.name} to the youth list? They'll be marked present here and will show on the youth list from now on.`)) return;
    setPendingId(guest.id);
    setError(null);
    try {
      const youth = await makeGuestAYouth(gatheringType, gatheringId, guest, user.uid);
      onYouthAdded?.(youth);
      setGuests((prev) => prev.filter((g) => g.id !== guest.id));
      setPresent((prev) => new Set(prev).add(youth.id));
    } catch (err) {
      console.error(err);
      setError("Couldn't add them to the youth list. Try again.");
    } finally {
      setPendingId(null);
    }
  }

  if (loading) return <Loading label="Loading attendance…" />;

  const term = search.toLowerCase();
  const filtered = search ? people.filter((y) => y.name.toLowerCase().includes(term)) : people;
  const filteredGuests = search ? guests.filter((g) => g.name.toLowerCase().includes(term)) : guests;

  // Count only people on the list, so someone who was marked present and
  // has since been taken off it (inactive, or removed from the group)
  // can't push this past 100%. Guests are counted on their own.
  const presentCount = people.filter((p) => present.has(p.id)).length;
  const percent = people.length > 0 ? Math.round((presentCount / people.length) * 100) : 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[10rem] flex-1">
          <p className="text-sm text-muted">
            <span className="num font-semibold text-ink">{presentCount}</span> of {people.length} present
            {guests.length > 0 && (
              <>
                {" "}
                · <span className="num font-semibold text-ink">{guests.length}</span> {guests.length === 1 ? "guest" : "guests"}
              </>
            )}
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

      {filteredGuests.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-sm font-semibold text-ink">
            Guests <span className="font-normal text-muted">({guests.length})</span>
          </p>
          <ul className="divide-y divide-line rounded-lg border border-line text-sm">
            {filteredGuests.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="flex items-center gap-2 font-medium">
                  {g.name}
                  <Badge tone="purple">Guest</Badge>
                </span>
                {canEdit && (
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleMakeYouth(g)}
                      disabled={pendingId === g.id}
                      className="btn-ghost btn-sm"
                      title="Add them to the youth list"
                    >
                      Make a youth
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveGuest(g)}
                      disabled={pendingId === g.id}
                      className="btn-ghost-danger btn-sm"
                    >
                      Remove
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      )}

      {canEdit && allowQuickAdd && (
        <div className="mt-3">
          {showAdd ? (
            <form onSubmit={handleAdd} className="space-y-3 rounded-xl border border-line bg-mist/60 p-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Full name"
                aria-label="Full name"
                className="input"
                autoFocus
              />
              <div role="radiogroup" aria-label="Is this person a guest or a youth?" className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["guest", "Guest", "A visitor. Listed for this one only, and not added to the youth list."],
                    ["youth", "Youth", "Joins the youth list, and is marked present here."],
                  ] as const
                ).map(([value, label, hint]) => (
                  <label
                    key={value}
                    className={[
                      "flex cursor-pointer items-start gap-2 rounded-lg border bg-white p-2.5 text-sm",
                      addKind === value ? "border-rccg-purple-500 ring-1 ring-rccg-purple-500" : "border-line",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="attendance-add-kind"
                      value={value}
                      checked={addKind === value}
                      onChange={() => setAddKind(value)}
                      className="mt-1 accent-[#52409E]"
                    />
                    <span>
                      <span className="font-semibold text-ink">{label}</span>
                      <span className="block text-xs text-muted">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={adding || !newName.trim()} className="btn-primary btn-sm">
                  {adding ? "Adding…" : addKind === "guest" ? "Add guest" : "Add youth and mark present"}
                </button>
                <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary btn-sm">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowAdd(true)} className="btn-secondary btn-sm">
              Add someone not on this list
            </button>
          )}
        </div>
      )}
    </div>
  );
}
