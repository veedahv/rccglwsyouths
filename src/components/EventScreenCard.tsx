"use client";

import Link from "next/link";
import EventScreenView from "@/components/EventScreenView";
import { ICON_SETS, ICON_SET_ORDER, PALETTES, PALETTE_ORDER, screenOf } from "@/lib/eventScreen";
import { Card } from "@/components/ui";
import type { ChurchEvent, EventScreen, ExcoMember, ScreenIconSet, ScreenPalette } from "@/types";

interface Props {
  event: ChurchEvent;
  excos: ExcoMember[];
  canEdit: boolean;
  onChange: (screen: EventScreen) => void; // the page saves it
}

/**
 * Controls for the event's big screen: what it shows (cover or agenda), which agenda item is on now,
 * and how it looks (colour and faded icons). Every change is saved straight away, and the big-screen
 * page follows.
 */
export default function EventScreenCard({ event, excos, canEdit, onChange }: Props) {
  const screen = screenOf(event);
  const agenda = event.agenda ?? [];
  const now = screen.nowIndex ?? -1;

  const set = (patch: Partial<EventScreen>) => onChange({ ...screen, ...patch });

  function toggleIcons(s: ScreenIconSet) {
    set({ icons: screen.icons.includes(s) ? screen.icons.filter((x) => x !== s) : [...screen.icons, s] });
  }

  return (
    <Card
      title="Big screen"
      description="A cover and the agenda for the projector or TV. Open it in a second window and it follows what you pick here."
      action={
        <Link href={`/events/${event.id}/present`} target="_blank" className="btn-secondary btn-sm">
          Open screen
        </Link>
      }
    >
      <div className="overflow-hidden rounded-xl border border-line shadow-sm">
        <div className="aspect-video w-full">
          <EventScreenView event={event} excos={excos} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(["cover", "agenda"] as const).map((v) => (
          <button
            key={v}
            disabled={!canEdit}
            onClick={() => set({ view: v })}
            className={screen.view === v ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
          >
            {v === "cover" ? "Cover" : "Agenda"}
          </button>
        ))}
      </div>

      {screen.view === "agenda" && canEdit && agenda.length > 0 && (
        <div className="mt-3 rounded-lg bg-mist p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              {now >= 0 ? `Now: ${agenda[now]?.item ?? ""}` : "Nothing marked as on now"}
            </span>
            <div className="flex gap-1">
              <button disabled={now <= 0} onClick={() => set({ nowIndex: now - 1 })} className="btn-secondary btn-sm">
                Back
              </button>
              <button disabled={now >= agenda.length - 1} onClick={() => set({ nowIndex: now + 1 })} className="btn-primary btn-sm">
                {now < 0 ? "Start" : "Next item"}
              </button>
              {now >= 0 && (
                <button onClick={() => set({ nowIndex: -1 })} className="btn-ghost btn-sm !text-muted">
                  Clear
                </button>
              )}
            </div>
          </div>
          <ol className="flex flex-wrap gap-1.5">
            {agenda.map((a, i) => (
              <li key={i}>
                <button
                  onClick={() => set({ nowIndex: i })}
                  className={[
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    i === now ? "border-rccg-green-600 bg-rccg-green-600 text-white" : "border-line bg-white text-ink hover:border-rccg-purple-300",
                  ].join(" ")}
                >
                  {a.item}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
      {screen.view === "agenda" && agenda.length === 0 && <p className="mt-3 text-xs text-muted">Add agenda items on this page and they will show here.</p>}

      {canEdit && (
        <div className="mt-5 space-y-4 border-t border-line pt-4">
          <div>
            <span className="label">Colours</span>
            <div className="flex flex-wrap gap-2">
              {PALETTE_ORDER.map((key: ScreenPalette) => (
                <button
                  key={key}
                  onClick={() => set({ palette: key })}
                  aria-label={PALETTES[key].label}
                  aria-pressed={screen.palette === key}
                  title={PALETTES[key].label}
                  className={[
                    "flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs font-medium",
                    screen.palette === key ? "border-rccg-green-600 bg-rccg-green-50" : "border-line bg-white hover:border-rccg-purple-300",
                  ].join(" ")}
                >
                  <span className="h-5 w-5 rounded-full border border-black/10" style={{ background: PALETTES[key].swatch }} />
                  {PALETTES[key].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="label">Faded icons behind the writing</span>
            <div className="flex flex-wrap gap-1.5">
              {ICON_SET_ORDER.map((key) => (
                <button
                  key={key}
                  onClick={() => toggleIcons(key)}
                  aria-pressed={screen.icons.includes(key)}
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    screen.icons.includes(key) ? "border-rccg-green-600 bg-rccg-green-600 text-white" : "border-line bg-white text-ink hover:border-rccg-purple-300",
                  ].join(" ")}
                >
                  {ICON_SETS[key].label}
                </button>
              ))}
              {screen.icons.length > 0 && (
                <button onClick={() => set({ icons: [] })} className="btn-ghost btn-sm !text-muted">
                  No icons
                </button>
              )}
            </div>
            <p className="hint mt-1">Pick one, or mix several. Love Feast: Love + Food + Community. Fitness day: Football + Outdoor games.</p>
          </div>

          <label className="block">
            <span className="label">Line at the bottom of the cover (optional)</span>
            <input
              key={screen.tagline ?? ""}
              defaultValue={screen.tagline ?? ""}
              onBlur={(e) => e.target.value.trim() !== (screen.tagline ?? "") && set({ tagline: e.target.value.trim() })}
              placeholder="Come hungry!"
              className="input"
            />
          </label>
        </div>
      )}
    </Card>
  );
}
