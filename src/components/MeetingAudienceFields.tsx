"use client";

import { useState } from "react";
import { formatPersonName } from "@/lib/formatName";
import type { MeetingAudience, Youth } from "@/types";

const OPTIONS: { value: MeetingAudience; label: string; description: string }[] = [
  { value: "excos", label: "Excos", description: "An exco meeting. Attendance is taken for the active excos (not external admins)." },
  { value: "youths", label: "All youths", description: "A general youth meeting. Attendance is taken for every active youth." },
  { value: "selected", label: "Selected group", description: "Pick exactly which youths it's for." },
];

interface Props {
  audience: MeetingAudience;
  onAudienceChange: (audience: MeetingAudience) => void;
  youths: Youth[]; // active youths to choose from
  selectedIds: string[];
  onSelectedChange: (ids: string[]) => void;
}

/**
 * "Who is this meeting for?" — used both when creating a meeting and when
 * changing it later. Picking "Selected group" reveals a searchable list
 * of youths to tick.
 */
export default function MeetingAudienceFields({
  audience,
  onAudienceChange,
  youths,
  selectedIds,
  onSelectedChange,
}: Props) {
  const [search, setSearch] = useState("");
  const selected = new Set(selectedIds);

  const shown = search ? youths.filter((y) => y.name.toLowerCase().includes(search.toLowerCase())) : youths;

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange([...next]);
  }

  function selectAllShown() {
    onSelectedChange([...new Set([...selectedIds, ...shown.map((y) => y.id)])]);
  }

  return (
    <fieldset className="space-y-3">
      <legend className="label">Who is this meeting for?</legend>

      <div className="grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className={[
              "flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-sm transition-colors",
              audience === o.value
                ? "border-rccg-green-500 bg-rccg-green-50"
                : "border-line bg-white hover:border-rccg-purple-300",
            ].join(" ")}
          >
            <span className="flex items-center gap-2 font-medium">
              <input
                type="radio"
                name="meeting-audience"
                value={o.value}
                checked={audience === o.value}
                onChange={() => onAudienceChange(o.value)}
                className="accent-rccg-green-600"
              />
              {o.label}
            </span>
            <span className="text-xs text-muted">{o.description}</span>
          </label>
        ))}
      </div>

      {audience === "selected" && (
        <div className="rounded-lg border border-line bg-white p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">
              <span className="num font-semibold text-ink">{selectedIds.length}</span> selected
            </p>
            <div className="flex items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                aria-label="Search youths"
                className="input w-40 py-1.5"
              />
              <button type="button" onClick={selectAllShown} className="btn-ghost btn-sm">
                Select {search ? "shown" : "all"}
              </button>
              <button
                type="button"
                onClick={() => onSelectedChange([])}
                disabled={selectedIds.length === 0}
                className="btn-ghost btn-sm !text-muted"
              >
                Clear
              </button>
            </div>
          </div>

          <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-md border border-line text-sm">
            {shown.map((y) => (
              <li key={y.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-mist">
                  <input
                    type="checkbox"
                    checked={selected.has(y.id)}
                    onChange={() => toggle(y.id)}
                    className="h-4 w-4 accent-rccg-green-600"
                  />
                  <span className="font-medium">{formatPersonName(y.name, y.gender)}</span>
                  {y.unit && <span className="text-xs text-muted">{y.unit}</span>}
                </label>
              </li>
            ))}
            {shown.length === 0 && (
              <li className="px-3 py-4 text-center text-muted">
                {search ? `No one matches “${search}”.` : "No active youths yet."}
              </li>
            )}
          </ul>
        </div>
      )}
    </fieldset>
  );
}
