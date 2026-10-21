"use client";

import { useState } from "react";
import { formatPersonName } from "@/lib/formatName";
import { newGuestId } from "@/lib/games";
import { Card } from "@/components/ui";
import type { GameEvent, GamePlayer } from "@/types/games";
import type { Youth } from "@/types";

export interface AttendancePatch {
  presentIds: string[];
  guests: GamePlayer[];
  hosts: GamePlayer[];
}

interface Props {
  event: GameEvent;
  youths: Youth[]; // active youths
  canEdit: boolean;
  onChange: (patch: AttendancePatch) => void;
}

/**
 * Who is at the games event, and who is hosting. Present people (minus the
 * hosts) are the ones the games pick players from; hosts are never picked
 * because they run the games. Every tap is saved straight away.
 */
export default function GameAttendance({ event, youths, canEdit, onChange }: Props) {
  const [search, setSearch] = useState("");
  const [guestName, setGuestName] = useState("");

  const presentIds = event.presentIds ?? [];
  const guests = event.guests ?? [];
  const hosts = event.hosts ?? [];
  const present = new Set(presentIds);
  const hostIds = new Set(hosts.map((h) => h.id));

  const shown = search ? youths.filter((y) => y.name.toLowerCase().includes(search.toLowerCase())) : youths;
  const playing = presentIds.filter((id) => !hostIds.has(id)).length + guests.filter((g) => !hostIds.has(g.id)).length;

  function save(patch: Partial<AttendancePatch>) {
    onChange({ presentIds, guests, hosts, ...patch });
  }

  function togglePresent(id: string) {
    save({ presentIds: present.has(id) ? presentIds.filter((p) => p !== id) : [...presentIds, id] });
  }

  function toggleHost(player: GamePlayer) {
    save({ hosts: hostIds.has(player.id) ? hosts.filter((h) => h.id !== player.id) : [...hosts, player] });
  }

  function addGuest() {
    const name = guestName.trim();
    if (!name) return;
    save({ guests: [...guests, { id: newGuestId(), name: `${name} (guest)`, guest: true }] });
    setGuestName("");
  }

  function removeGuest(id: string) {
    save({ guests: guests.filter((g) => g.id !== id), hosts: hosts.filter((h) => h.id !== id) });
  }

  function markAll() {
    save({ presentIds: youths.map((y) => y.id) });
  }

  function toYouthPlayer(y: Youth): GamePlayer {
    return { id: y.id, name: formatPersonName(y.name, y.gender), gender: y.gender };
  }

  return (
    <Card
      title="Attendance and hosts"
      description="Games pick their players from the people marked present. Hosts run the games, so they are never picked."
      action={
        canEdit && (
          <div className="flex gap-2">
            <button type="button" onClick={markAll} className="btn-secondary btn-sm">
              Mark everyone present
            </button>
            <button type="button" onClick={() => save({ presentIds: [], guests: [] })} disabled={presentIds.length + guests.length === 0} className="btn-ghost btn-sm !text-muted">
              Clear
            </button>
          </div>
        )
      }
    >
      <p className="mb-3 text-sm text-muted">
        <span className="num font-semibold text-ink">{playing}</span> available to play
        {hosts.length > 0 && (
          <>
            {" "}
            · Hosted by <span className="font-medium text-ink">{hosts.map((h) => h.name).join(", ")}</span>
          </>
        )}
        {presentIds.length + guests.length === 0 && " · Attendance hasn't been taken, so games can pick from every active youth."}
      </p>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search youths…"
            aria-label="Search youths"
            className="input mb-2 py-1.5"
          />
          <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-md border border-line text-sm">
            {guests.map((g) => (
              <li key={g.id} className="flex items-center gap-3 px-3 py-2">
                <span className="flex-1 font-medium">{g.name}</span>
                {canEdit && (
                  <>
                    <button type="button" onClick={() => toggleHost(g)} className={hostIds.has(g.id) ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>
                      {hostIds.has(g.id) ? "Host" : "Make host"}
                    </button>
                    <button type="button" onClick={() => removeGuest(g.id)} className="btn-ghost btn-sm !text-muted" aria-label={`Remove ${g.name}`}>
                      ×
                    </button>
                  </>
                )}
              </li>
            ))}
            {shown.map((y) => (
              <li key={y.id} className="flex items-center gap-3 px-3 py-2">
                <label className={`flex min-w-0 flex-1 items-center gap-3 ${canEdit ? "cursor-pointer" : ""}`}>
                  <input
                    type="checkbox"
                    checked={present.has(y.id)}
                    disabled={!canEdit}
                    onChange={() => togglePresent(y.id)}
                    className="h-4 w-4 accent-rccg-green-600"
                  />
                  <span className="truncate font-medium">{formatPersonName(y.name, y.gender)}</span>
                  {y.unit && <span className="text-xs text-muted">{y.unit}</span>}
                </label>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => toggleHost(toYouthPlayer(y))}
                    className={hostIds.has(y.id) ? "btn-primary btn-sm" : "btn-ghost btn-sm !text-muted"}
                  >
                    {hostIds.has(y.id) ? "Host" : "Make host"}
                  </button>
                )}
              </li>
            ))}
            {shown.length === 0 && guests.length === 0 && (
              <li className="px-3 py-4 text-center text-muted">{search ? `No one matches “${search}”.` : "No active youths yet."}</li>
            )}
          </ul>
        </div>

        {canEdit && (
          <div className="lg:w-60">
            <label className="block">
              <span className="label">Add a guest</span>
              <div className="flex gap-2">
                <input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addGuest();
                    }
                  }}
                  placeholder="Guest name"
                  className="input"
                />
                <button type="button" onClick={addGuest} disabled={!guestName.trim()} className="btn-secondary">
                  Add
                </button>
              </div>
              <span className="hint block">Someone who isn&rsquo;t on the youths list. Guests are marked present, and can be hosts.</span>
            </label>
          </div>
        )}
      </div>
    </Card>
  );
}
