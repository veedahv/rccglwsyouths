"use client";

import { useMemo, useState } from "react";
import { formatPersonName } from "@/lib/formatName";
import { newGuestId } from "@/lib/games";
import type { GamePlayer } from "@/types/games";
import type { Youth } from "@/types";

/**
 * Who is hosting. Pick from the youths (the people present are listed first), or type the
 * name of someone who isn't on the list, such as a coach or a pastor. Every change is saved
 * straight away by whoever uses this.
 */
export default function HostPicker({
  hosts,
  youths,
  presentIds,
  canEdit,
  onChange,
  emptyText = "No host chosen yet.",
}: {
  hosts: GamePlayer[];
  youths: Youth[]; // active youths
  presentIds?: string[] | null; // people marked present, listed first. Null or missing: no grouping.
  canEdit: boolean;
  onChange: (hosts: GamePlayer[]) => void;
  emptyText?: string;
}) {
  const [typed, setTyped] = useState("");
  const hostIds = new Set(hosts.map((h) => h.id));

  const { here, others } = useMemo(() => {
    const present = new Set(presentIds ?? []);
    const open = youths.filter((y) => !hostIds.has(y.id)).sort((a, b) => a.name.localeCompare(b.name));
    return {
      here: presentIds ? open.filter((y) => present.has(y.id)) : [],
      others: presentIds ? open.filter((y) => !present.has(y.id)) : open,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youths, presentIds, hosts]);

  function addYouth(id: string) {
    const y = youths.find((x) => x.id === id);
    if (!y) return;
    onChange([...hosts, { id: y.id, name: formatPersonName(y.name, y.gender), gender: y.gender }]);
  }

  function addTyped() {
    const name = typed.trim();
    if (!name) return;
    onChange([...hosts, { id: newGuestId(), name, guest: true }]);
    setTyped("");
  }

  return (
    <div>
      {hosts.length === 0 ? (
        <p className="text-sm text-muted">{emptyText}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {hosts.map((h) => (
            <li key={h.id} className="inline-flex items-center gap-1 rounded-full bg-rccg-purple-100 py-1 pl-3 pr-1 text-sm font-medium text-rccg-purple-800">
              {h.name}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onChange(hosts.filter((x) => x.id !== h.id))}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-rccg-purple-700 hover:bg-rccg-purple-200"
                  aria-label={`Remove ${h.name} as host`}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select
            className="input"
            value=""
            onChange={(e) => e.target.value && addYouth(e.target.value)}
            aria-label="Add a host from the youths"
          >
            <option value="">Add a host from the youths…</option>
            {here.length > 0 && (
              <optgroup label="Present">
                {here.map((y) => (
                  <option key={y.id} value={y.id}>
                    {formatPersonName(y.name, y.gender)}
                  </option>
                ))}
              </optgroup>
            )}
            {others.length > 0 && (
              <optgroup label={presentIds ? "Everyone else" : "Youths"}>
                {others.map((y) => (
                  <option key={y.id} value={y.id}>
                    {formatPersonName(y.name, y.gender)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <div className="flex gap-2">
            <input
              className="input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTyped();
                }
              }}
              placeholder="Or type a name (a coach, a guest)"
              aria-label="Type the name of someone not on the list"
            />
            <button type="button" onClick={addTyped} disabled={!typed.trim()} className="btn-secondary">
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
