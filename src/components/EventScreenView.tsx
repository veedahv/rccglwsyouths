"use client";

import type { CSSProperties, ReactNode } from "react";
import Logo from "@/components/Logo";
import { PALETTES, decorFor, screenOf, type IconKind } from "@/lib/eventScreen";
import { formatDateTime, formatTime } from "@/lib/format";
import { formatPersonName } from "@/lib/formatName";
import type { ChurchEvent, ExcoMember, ScreenIconSet } from "@/types";

/* ------------------------------------------------------------------ */
/* Icons: simple outline shapes that take the colour of the screen      */
/* ------------------------------------------------------------------ */

const RAYS = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4;
  return `M${50 + Math.cos(a) * 26} ${50 + Math.sin(a) * 26} L${50 + Math.cos(a) * 42} ${50 + Math.sin(a) * 42}`;
}).join(" ");

const SHAPES: Record<IconKind, ReactNode> = {
  heart: <path d="M50 86 C14 60 8 34 26 20 C38 11 50 19 50 29 C50 19 62 11 74 20 C92 34 86 60 50 86 Z" />,
  spark: <path d="M50 4 C54 36 64 46 96 50 C64 54 54 64 50 96 C46 64 36 54 4 50 C36 46 46 36 50 4 Z" />,
  bubble: <path d="M14 18 H86 Q92 18 92 24 V60 Q92 66 86 66 H48 L28 84 V66 H14 Q8 66 8 60 V24 Q8 18 14 18 Z" />,
  house: <path d="M10 48 L50 14 L90 48 M20 42 V86 H80 V42 M42 86 V60 H58 V86" />,
  people: (
    <>
      <circle cx="50" cy="28" r="12" />
      <circle cx="21" cy="40" r="9" />
      <circle cx="79" cy="40" r="9" />
      <path d="M28 86 Q28 54 50 54 Q72 54 72 86 Z M6 80 Q6 58 21 54 M94 80 Q94 58 79 54" />
    </>
  ),
  flag: <path d="M22 92 V10 M22 14 H82 L68 34 L82 54 H22" />,
  plate: (
    <>
      <circle cx="50" cy="50" r="40" />
      <circle cx="50" cy="50" r="26" />
    </>
  ),
  fork: <path d="M30 10 V38 M42 10 V38 M54 10 V38 M30 38 Q30 52 42 52 Q54 52 54 38 M42 52 V92" />,
  spoon: (
    <>
      <ellipse cx="50" cy="28" rx="16" ry="22" />
      <path d="M50 50 V92" />
    </>
  ),
  cup: <path d="M18 32 H70 V62 Q70 86 44 86 Q18 86 18 62 Z M70 42 H78 Q90 42 90 54 Q90 66 78 66 H69 M34 20 Q28 14 34 8 M52 20 Q46 14 52 8" />,
  apple: <path d="M50 30 C30 18 10 32 14 58 C18 84 36 94 50 86 C64 94 82 84 86 58 C90 32 70 18 50 30 Z M50 30 Q50 16 62 8" />,
  bread: <path d="M12 46 Q12 22 50 22 Q88 22 88 46 Q88 52 82 54 V82 H18 V54 Q12 52 12 46 Z" />,
  cupcake: <path d="M22 54 H78 L70 90 H30 Z M18 54 Q14 30 34 26 Q40 10 56 18 Q76 14 82 34 Q86 46 82 54 Z" />,
  ball: (
    <>
      <circle cx="50" cy="50" r="40" />
      <path d="M50 36 L63 46 L58 62 H42 L37 46 Z M50 36 V10 M63 46 L88 38 M58 62 L72 84 M42 62 L28 84 M37 46 L12 38" />
    </>
  ),
  whistle: (
    <>
      <path d="M8 42 H58 L70 28 H92 V58 Q92 84 62 84 Q32 84 32 60 V58 H8 Z" />
      <circle cx="62" cy="62" r="8" />
    </>
  ),
  trophy: <path d="M28 10 H72 V40 Q72 62 50 64 Q28 62 28 40 Z M28 18 H10 Q10 40 30 46 M72 18 H90 Q90 40 70 46 M50 64 V80 M30 90 H70 M36 80 H64" />,
  cone: <path d="M50 10 L78 78 H22 Z M30 54 H70 M10 90 H90" />,
  stopwatch: (
    <>
      <circle cx="50" cy="56" r="32" />
      <path d="M50 56 V36 M50 56 L64 64 M40 12 H60 M50 12 V24 M78 26 L85 19" />
    </>
  ),
  medal: (
    <>
      <circle cx="50" cy="66" r="24" />
      <path d="M30 8 L44 44 M70 8 L56 44" />
    </>
  ),
  sun: (
    <>
      <circle cx="50" cy="50" r="16" />
      <path d={RAYS} />
    </>
  ),
  tree: (
    <>
      <circle cx="50" cy="36" r="26" />
      <path d="M50 62 V92 M50 80 L36 68 M50 74 L64 64" />
    </>
  ),
  basketball: (
    <>
      <circle cx="50" cy="50" r="40" />
      <path d="M50 10 V90 M10 50 H90 M22 20 Q50 50 22 80 M78 20 Q50 50 78 80" />
    </>
  ),
  dumbbell: <path d="M8 40 V60 M22 28 V72 M78 28 V72 M92 40 V60 M22 50 H78" />,
  cross: <path d="M42 8 H58 V36 H86 V52 H58 V92 H42 V52 H14 V36 H42 Z" />,
  flame: <path d="M50 8 C58 30 82 40 78 64 C76 82 64 92 50 92 C36 92 24 82 22 64 C20 50 30 42 36 30 C40 40 44 42 50 8 Z" />,
  note: (
    <>
      <path d="M40 76 V22 L82 12 V64" />
      <ellipse cx="26" cy="76" rx="14" ry="10" />
      <ellipse cx="68" cy="64" rx="14" ry="10" />
    </>
  ),
  star: <path d="M50 8 L61 38 L92 38 L67 57 L77 88 L50 70 L23 88 L33 57 L8 38 L39 38 Z" />,
  balloon: (
    <>
      <ellipse cx="50" cy="38" rx="26" ry="32" />
      <path d="M50 70 L44 78 H56 Z M50 78 Q40 88 50 96" />
    </>
  ),
  book: <path d="M8 18 Q30 10 50 20 V86 Q30 76 8 84 Z M92 18 Q70 10 50 20 V86 Q70 76 92 84 Z" />,
  bulb: <path d="M50 8 C28 8 18 26 24 44 C28 54 36 58 36 70 H64 C64 58 72 54 76 44 C82 26 72 8 50 8 Z M38 80 H62 M42 91 H58" />,
  globe: (
    <>
      <circle cx="50" cy="50" r="40" />
      <path d="M10 50 H90 M50 10 Q22 50 50 90 M50 10 Q78 50 50 90" />
    </>
  ),
};

/** The faded icons only. Sits behind the content of a `relative overflow-hidden` box. */
export function EventDecor({ sets, color }: { sets: ScreenIconSet[]; color: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ color }} aria-hidden="true">
      {decorFor(sets).map((d, i) => (
        <svg
          key={i}
          viewBox="0 0 100 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute"
          style={{
            left: `${d.x}%`,
            top: `${d.y}%`,
            width: `${d.size}cqmin`,
            height: `${d.size}cqmin`,
            transform: `translate(-50%, -50%) rotate(${d.rotate}deg)`,
          }}
        >
          {SHAPES[d.kind]}
        </svg>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The screen                                                           */
/* ------------------------------------------------------------------ */

/**
 * What an event's big screen shows: the cover or the agenda, in the event's colours and icons.
 * It fills whatever box it is put in and sizes everything from that box (cqmin), so the same
 * screen works full size on a projector and as a small preview on the event page.
 */
export default function EventScreenView({ event, excos = [] }: { event: ChurchEvent; excos?: ExcoMember[] }) {
  const screen = screenOf(event);
  const p = PALETTES[screen.palette];

  return (
    <div
      className="relative h-full w-full overflow-hidden font-sans"
      style={{ containerType: "size", background: p.background, color: p.text }}
    >
      {/* The green, gold and red stripe from the poster. */}
      <div className="absolute inset-x-0 top-0 z-20 flex" style={{ height: "1.1cqmin" }} aria-hidden="true">
        <span className="flex-1" style={{ background: "#028A2C" }} />
        <span className="flex-1" style={{ background: "#E8B04A" }} />
        <span className="flex-1" style={{ background: "#D61812" }} />
      </div>
      <EventDecor sets={screen.icons} color={p.decor} />
      {screen.view === "agenda" ? (
        <AgendaScreen event={event} excos={excos} nowIndex={screen.nowIndex ?? -1} />
      ) : (
        <CoverScreen event={event} tagline={screen.tagline} />
      )}
    </div>
  );
}

function titleSize(title: string): string {
  const n = title.length;
  if (n <= 12) return "15cqmin";
  if (n <= 22) return "12cqmin";
  if (n <= 34) return "9cqmin";
  return "7.5cqmin";
}

function CoverScreen({ event, tagline }: { event: ChurchEvent; tagline?: string }) {
  const screen = screenOf(event);
  const p = PALETTES[screen.palette];
  const when = formatDateTime(event.date, event.time);
  const title: CSSProperties = {
    fontSize: titleSize(event.title),
    lineHeight: 1.02,
    letterSpacing: "-0.01em",
    textShadow: `0.035em 0.035em 0 ${p.accent}`,
  };

  return (
    <div className="relative z-10 flex h-full w-full flex-col items-center justify-center text-center" style={{ gap: "3cqmin", padding: "6cqmin 8cqmin" }}>
      <div className="rounded-2xl bg-white/95 shadow-lg" style={{ padding: "1cqmin 2cqmin" }}>
        <Logo size={64} />
      </div>

      <h1 className="max-w-full break-words font-title font-black" style={title}>
        {event.title}
      </h1>

      {event.theme && (
        <p className="max-w-[85cqw] font-display font-semibold italic" style={{ fontSize: "4cqmin", color: p.muted }}>
          “{event.theme}”
        </p>
      )}

      <p
        className="rounded-full font-display font-bold uppercase tracking-wide"
        style={{ background: p.accent, color: p.onAccent, fontSize: "3.4cqmin", padding: "1.4cqmin 4cqmin" }}
      >
        {when}
      </p>

      {event.venue && (
        <p className="font-display font-semibold" style={{ fontSize: "3cqmin", color: p.muted }}>
          {event.venue}
        </p>
      )}

      {tagline && (
        <p className="absolute inset-x-0 text-center font-display font-semibold" style={{ bottom: "4cqmin", fontSize: "3cqmin" }}>
          {tagline}
        </p>
      )}
    </div>
  );
}

function AgendaScreen({ event, excos, nowIndex }: { event: ChurchEvent; excos: ExcoMember[]; nowIndex: number }) {
  const screen = screenOf(event);
  const p = PALETTES[screen.palette];
  const agenda = event.agenda ?? [];
  const twoCols = agenda.length > 7;

  function owner(id?: string) {
    const ex = excos.find((e) => e.id === id);
    return ex ? formatPersonName(ex.name, ex.gender) : "";
  }

  return (
    <div className="relative z-10 flex h-full w-full flex-col" style={{ padding: "5cqmin 6cqmin 4cqmin" }}>
      <header className="text-center" style={{ marginBottom: "3cqmin" }}>
        <h1 className="font-title font-black" style={{ fontSize: "7.5cqmin", lineHeight: 1.05 }}>
          {event.title}
        </h1>
        <p className="font-display font-bold uppercase tracking-[0.25em]" style={{ fontSize: "2.6cqmin", color: p.accent, marginTop: "1cqmin" }}>
          Order of programme
        </p>
      </header>

      {agenda.length === 0 ? (
        <p className="flex flex-1 items-center justify-center" style={{ fontSize: "3cqmin", color: p.muted }}>
          The agenda hasn&rsquo;t been added yet.
        </p>
      ) : (
        <ol
          className="grid flex-1 content-center"
          style={{ gap: "1.4cqmin", gridTemplateColumns: twoCols ? "1fr 1fr" : "1fr", maxWidth: twoCols ? undefined : "80cqw", margin: "0 auto", width: "100%" }}
        >
          {agenda.map((a, i) => {
            const now = i === nowIndex;
            const past = nowIndex >= 0 && i < nowIndex;
            const next = nowIndex >= 0 && i === nowIndex + 1;
            return (
              <li
                key={i}
                className="flex items-center rounded-2xl border"
                style={{
                  gap: "2.4cqmin",
                  padding: "1.6cqmin 2.4cqmin",
                  background: now ? p.accent : p.card,
                  borderColor: now ? p.accent : p.cardBorder,
                  color: now ? p.onAccent : p.text,
                  opacity: past ? 0.4 : 1,
                  transform: now ? "scale(1.02)" : undefined,
                }}
              >
                <span className="num font-display font-bold" style={{ minWidth: "11cqmin", fontSize: "3cqmin", color: now ? p.onAccent : p.accent }}>
                  {formatTime(a.time) || String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display font-semibold" style={{ fontSize: twoCols ? "3.2cqmin" : "4cqmin" }}>
                    {a.item}
                  </span>
                  {owner(a.owner) && (
                    <span className="block" style={{ fontSize: "2.2cqmin", opacity: 0.75 }}>
                      {owner(a.owner)}
                    </span>
                  )}
                </span>
                {now && (
                  <span className="rounded-full font-bold uppercase tracking-wider" style={{ fontSize: "2cqmin", padding: "0.5cqmin 1.6cqmin", background: p.onAccent, color: p.accent }}>
                    Now
                  </span>
                )}
                {next && (
                  <span className="font-semibold uppercase tracking-wider" style={{ fontSize: "2cqmin", color: p.muted }}>
                    Up next
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
