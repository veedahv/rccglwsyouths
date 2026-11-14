"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  buildYearReview,
  type ReviewEvent,
  type ReviewGameDay,
  type ReviewPlan,
  type YearReviewData,
} from "@/lib/yearReview";
import { MONTH_NAMES } from "@/lib/programmes";
import type { MemoryPhoto } from "@/lib/yearReviewPhotos";
import { formatDate, formatQuantity, formatTime, naira, pluralize } from "@/lib/format";
import Logo from "@/components/Logo";
import YearReviewExportMenu from "@/components/YearReviewExportMenu";

// A full-screen "year in review" slideshow. Everything is drawn on a fixed 1280 x 720 stage that is
// scaled to fit the screen, so it looks the same on a laptop, a phone or a projector.
// Arrow keys / space / swipe move between slides, F goes full screen, Esc closes.

const W = 1280;
const H = 720;

type ThemeName = "night" | "lavender" | "mint" | "blush" | "cream";

const THEMES: Record<ThemeName, { bg: string; text: string; blobs: [string, string, string]; star: string; dots: string; dark: boolean }> = {
  night: {
    bg: "linear-gradient(135deg,#180C62 0%,#2F1C86 55%,#52409E 100%)",
    text: "#FFFFFF",
    blobs: ["#7E6EB8", "#028A2C", "#E5463F"],
    star: "#FFD66B",
    dots: "rgba(255,255,255,0.35)",
    dark: true,
  },
  lavender: {
    bg: "linear-gradient(135deg,#F4F2FB 0%,#E5E1F4 100%)",
    text: "#1B1440",
    blobs: ["#CBC4E7", "#C7E6D0", "#FAD4D1"],
    star: "#F5B83D",
    dots: "#A99DD3",
    dark: false,
  },
  mint: {
    bg: "linear-gradient(135deg,#E6F4EA 0%,#F4F2FB 100%)",
    text: "#1B1440",
    blobs: ["#C7E6D0", "#CBC4E7", "#FFEFC7"],
    star: "#F5B83D",
    dots: "#92CDA4",
    dark: false,
  },
  blush: {
    bg: "linear-gradient(135deg,#FDEDEC 0%,#F4F2FB 100%)",
    text: "#1B1440",
    blobs: ["#FAD4D1", "#E5E1F4", "#FFEFC7"],
    star: "#E5463F",
    dots: "#F2A6A1",
    dark: false,
  },
  cream: {
    bg: "linear-gradient(135deg,#FFF7E6 0%,#FDEDEC 100%)",
    text: "#1B1440",
    blobs: ["#FFEFC7", "#FAD4D1", "#C7E6D0"],
    star: "#F5B83D",
    dots: "#F5B83D",
    dark: false,
  },
};

const BLOBS = [
  [{ s: 520, x: -150, y: -170 }, { s: 380, x: 960, y: 430 }, { s: 240, x: 760, y: -100 }],
  [{ s: 460, x: 900, y: -170 }, { s: 420, x: -130, y: 430 }, { s: 220, x: 420, y: 610 }],
  [{ s: 500, x: -160, y: 300 }, { s: 360, x: 930, y: -120 }, { s: 260, x: 1030, y: 520 }],
];

const STARS = [
  [{ x: 1120, y: 70, s: 34 }, { x: 70, y: 600, s: 26 }, { x: 640, y: 36, s: 18 }, { x: 1190, y: 330, s: 20 }],
  [{ x: 90, y: 70, s: 30 }, { x: 1160, y: 590, s: 36 }, { x: 560, y: 650, s: 18 }, { x: 40, y: 340, s: 20 }],
  [{ x: 1100, y: 600, s: 30 }, { x: 110, y: 60, s: 24 }, { x: 700, y: 40, s: 20 }, { x: 1210, y: 200, s: 18 }],
];

export const YEAR_REVIEW_CSS = `
@keyframes yr-rise { from { opacity: 0; transform: translateY(26px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes yr-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes yr-float { 0%,100% { transform: translateY(0) rotate(var(--r,0deg)); } 50% { transform: translateY(-16px) rotate(calc(var(--r,0deg) + 5deg)); } }
@keyframes yr-twinkle { 0%,100% { opacity: .35; transform: scale(.8) rotate(0deg); } 50% { opacity: 1; transform: scale(1.12) rotate(18deg); } }
@keyframes yr-pop { 0% { opacity: 0; transform: scale(.55) rotate(-10deg); } 70% { transform: scale(1.07) rotate(3deg); } 100% { opacity: 1; transform: scale(1) rotate(var(--r,0deg)); } }
.yr-stage > * { animation: yr-fade .35s ease both; }
.yr-rise { animation: yr-rise .7s cubic-bezier(.2,.8,.2,1) both; animation-delay: var(--d,0s); }
.yr-pop { transform: rotate(var(--r,0deg)); animation: yr-pop .8s cubic-bezier(.2,.9,.3,1.2) both; animation-delay: var(--d,0s); }
.yr-float { animation: yr-float var(--t,9s) ease-in-out infinite; animation-delay: var(--d,0s); }
.yr-twinkle { animation: yr-twinkle var(--t,3.6s) ease-in-out infinite; animation-delay: var(--d,0s); }
/* While saving the slides as a PDF or PowerPoint: no animation, everything in its final place. */
.yr-export, .yr-export * { animation: none !important; transition: none !important; }
.yr-export .yr-twinkle { opacity: .85; }
@media (prefers-reduced-motion: reduce) {
  .yr-stage > *, .yr-rise, .yr-pop, .yr-float, .yr-twinkle { animation: none !important; }
}
`;

const delay = (s: number): CSSProperties => ({ ["--d" as string]: `${s}s` });

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function Star({ x, y, s, color, d }: { x: number; y: number; s: number; color: string; d: number }) {
  return (
    <svg
      className="yr-twinkle absolute"
      style={{ left: x, top: y, width: s, height: s, ["--d" as string]: `${d}s` }}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M12 0 L14.6 9.4 L24 12 L14.6 14.6 L12 24 L9.4 14.6 L0 12 L9.4 9.4 Z" fill={color} />
    </svg>
  );
}

function Decor({ theme, seed }: { theme: ThemeName; seed: number }) {
  const t = THEMES[theme];
  const v = seed % 3;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {BLOBS[v].map((b, i) => (
        <div
          key={i}
          className="yr-float absolute rounded-full"
          style={{
            width: b.s,
            height: b.s,
            left: b.x,
            top: b.y,
            background: t.blobs[i],
            opacity: t.dark ? 0.28 : 0.6,
            ["--t" as string]: `${10 + i * 3}s`,
            ["--d" as string]: `${i * -2}s`,
          }}
        />
      ))}
      <div
        className="absolute"
        style={{
          width: 230,
          height: 150,
          right: v === 1 ? undefined : 48,
          left: v === 1 ? 48 : undefined,
          bottom: 34,
          opacity: 0.55,
          backgroundImage: `radial-gradient(circle, ${t.dots} 2.2px, transparent 2.8px)`,
          backgroundSize: "26px 26px",
        }}
      />
      {STARS[v].map((s, i) => (
        <Star key={i} x={s.x} y={s.y} s={s.s} color={t.star} d={i * 0.7} />
      ))}
    </div>
  );
}

export function SlideShell({ theme, seed, children }: { theme: ThemeName; seed: number; children: ReactNode }) {
  const t = THEMES[theme];
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: t.bg, color: t.text }}>
      <Decor theme={theme} seed={seed} />
      <div className="relative flex h-full w-full flex-col px-[72px] py-[52px]">{children}</div>
    </div>
  );
}

function Heading({ kicker, title, sub, dark }: { kicker: string; title: string; sub?: string; dark?: boolean }) {
  return (
    <div className="yr-rise shrink-0">
      <span
        className="inline-block rounded-full px-4 py-1.5 text-[16px] font-bold uppercase tracking-[0.16em]"
        style={{ background: dark ? "rgba(255,255,255,0.16)" : "#FFFFFF", color: dark ? "#E5E1F4" : "#52409E" }}
      >
        {kicker}
      </span>
      <h2 className="mt-3 font-title text-[54px] leading-[1.05]" style={{ color: dark ? "#FFFFFF" : "#180C62" }}>
        {title}
      </h2>
      {sub && <p className="mt-1.5 text-[21px] opacity-75">{sub}</p>}
    </div>
  );
}

/** True while the slides are being drawn for a PDF or PowerPoint: numbers and bars show their final values at once. */
export const ExportModeContext = createContext(false);

/** Counts up from zero when the slide appears. */
function CountUp({ value, format }: { value: number; format?: (n: number) => string }) {
  const exporting = useContext(ExportModeContext);
  const [n, setN] = useState(exporting ? value : 0);
  useEffect(() => {
    if (exporting || value === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 1100);
      setN(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, exporting]);
  return <>{format ? format(n) : Math.round(n).toLocaleString("en-NG")}</>;
}

/** A bar that grows to `percent` when the slide appears. */
function GrowBar({ percent, color, track = "rgba(24,12,98,0.1)", height = 16 }: { percent: number; color: string; track?: string; height?: number }) {
  const exporting = useContext(ExportModeContext);
  const target = Math.max(0, Math.min(100, percent));
  const [w, setW] = useState(exporting ? target : 0);
  useEffect(() => {
    if (exporting) return;
    const id = setTimeout(() => setW(target), 120);
    return () => clearTimeout(id);
  }, [target, exporting]);
  return (
    <div className="w-full overflow-hidden rounded-full" style={{ background: track, height }}>
      <div className="h-full rounded-full" style={{ width: `${w}%`, background: color, transition: "width 1.1s cubic-bezier(.2,.8,.2,1)" }} />
    </div>
  );
}

function bigNumberSize(text: string, base = 56): number {
  return text.length > 13 ? base - 18 : text.length > 10 ? base - 8 : base;
}

/** Splits a list into pages of at most `max`, spread evenly so the last page isn't left with one lonely card. */
function chunk<T>(items: T[], max: number): T[][] {
  if (items.length === 0) return [];
  const pages = Math.ceil(items.length / max);
  const size = Math.ceil(items.length / pages);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const TONES = [
  { bar: "#52409E", pill: "#E5E1F4", pillText: "#2F1C86" },
  { bar: "#028A2C", pill: "#C7E6D0", pillText: "#046A23" },
  { bar: "#D61812", pill: "#FAD4D1", pillText: "#B5130E" },
  { bar: "#F5B83D", pill: "#FFEFC7", pillText: "#8A5A00" },
];

/* ------------------------------------------------------------------ */
/* The slides                                                          */
/* ------------------------------------------------------------------ */

function CoverSlide({ data }: { data: YearReviewData }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="yr-pop" style={delay(0.1)}>
        <Logo size={96} chip />
      </div>
      <p className="yr-rise mt-6 text-[22px] font-bold uppercase tracking-[0.32em] text-rccg-purple-200" style={delay(0.25)}>
        LWS RCCG Youths
      </p>
      <h1 className="yr-rise mt-3 font-title text-[112px] leading-none" style={delay(0.4)}>
        Year in Review
      </h1>
      <div
        className="yr-pop mt-7 rounded-[28px] px-10 py-2 font-title text-[76px] leading-[1.15] text-rccg-purple-800"
        style={{ background: "#FFD66B", ["--r" as string]: "-3deg", ...delay(0.65) }}
      >
        {data.year}
      </div>
      {data.tagline && (
        <p className="yr-rise mt-8 max-w-[860px] text-[28px] italic text-rccg-purple-100" style={delay(0.9)}>
          “{data.tagline}”
        </p>
      )}
    </div>
  );
}

function GlanceSlide({ data }: { data: YearReviewData }) {
  const tiles = [
    { emoji: "🎉", label: "Events & highlights", value: data.events.length, bg: "#E5E1F4", ink: "#2F1C86" },
    { emoji: "🎮", label: "Games played", value: data.games ? data.games.gamesPlayed + data.games.outdoorGames : 0, bg: "#C7E6D0", ink: "#046A23" },
    { emoji: "🤝", label: "Contribution drives", value: data.contributions?.drives ?? 0, bg: "#FAD4D1", ink: "#B5130E" },
    { emoji: "💜", label: "Youths in our family", value: data.youths ?? 0, bg: "#FFEFC7", ink: "#8A5A00" },
  ].filter((t) => t.value > 0);

  return (
    <>
      <Heading kicker={String(data.year)} title="The year at a glance" sub="A few numbers we are proud of." />
      <div className="flex flex-1 items-center justify-center gap-6">
        {tiles.map((t, i) => (
          <div
            key={t.label}
            className="yr-pop flex h-[330px] w-[250px] flex-col items-center justify-center rounded-[36px] text-center shadow-[0_18px_40px_-18px_rgba(24,12,98,0.45)]"
            style={{ background: t.bg, color: t.ink, ["--r" as string]: `${i % 2 ? 2 : -2}deg`, ...delay(0.2 + i * 0.12) }}
          >
            <span className="text-[64px] leading-none">{t.emoji}</span>
            <span className="mt-4 font-title text-[84px] leading-none">
              <CountUp value={t.value} />
            </span>
            <span className="mt-3 px-5 text-[21px] font-semibold leading-tight">{t.label}</span>
          </div>
        ))}
      </div>
    </>
  );
}

type CardVariant = "compact" | "tall";

/** The date (or "Today") pill, the games tag and the venue / theme, shared by both card sizes. */
function EventCardTop({ e, tone }: { e: ReviewEvent; tone: (typeof TONES)[number] }) {
  const meta = [e.venue, e.theme ? `“${e.theme}”` : undefined].filter(Boolean).join(" · ");
  return (
    <div className="flex items-center gap-3">
      {e.isToday ? (
        <span className="shrink-0 rounded-full bg-[#FFD66B] px-3 py-0.5 text-[15px] font-bold text-rccg-purple-800">
          ✨ Today{e.time ? ` · ${formatTime(e.time)}` : ""}
        </span>
      ) : (
        e.date && (
          <span className="shrink-0 rounded-full px-3 py-0.5 text-[15px] font-bold" style={{ background: tone.pill, color: tone.pillText }}>
            {formatDate(e.date)}
          </span>
        )
      )}
      {e.hadGames && (
        <span className="shrink-0 rounded-full bg-rccg-green-100 px-2.5 py-0.5 text-[14px] font-bold text-rccg-green-700">
          {e.outdoorGames ? "🌳 Outdoor games" : "🎮 Games"}
        </span>
      )}
      {meta && <span className="truncate text-[15px] text-muted">{meta}</span>}
    </div>
  );
}

/** A small card: four fit on a slide. Its order of events is one line of text with arrows between the steps. */
function EventCard({ e, i }: { e: ReviewEvent; i: number }) {
  const tone = TONES[i % TONES.length];
  const steps = (e.order ?? []).filter(Boolean);
  return (
    <div
      className="yr-rise relative flex min-h-0 flex-col overflow-hidden rounded-[26px] bg-white py-[16px] pl-[26px] pr-[20px] shadow-[0_14px_30px_-16px_rgba(24,12,98,0.4)]"
      style={delay(0.15 + i * 0.1)}
    >
      <span className="absolute bottom-0 left-0 top-0 w-[8px]" style={{ background: tone.bar }} />
      <EventCardTop e={e} tone={tone} />
      <h3 className="mt-1.5 line-clamp-2 font-display text-[25px] font-bold leading-[1.15] text-rccg-purple-800">{e.title}</h3>
      {steps.length > 0 && (
        <p className="mt-1.5 line-clamp-2 text-[15px] leading-[20px] text-rccg-purple-700">
          <span className="font-bold">The day: </span>
          {steps.join(" › ")}
        </p>
      )}
      {e.summary && (
        <p className={`mt-1.5 ${steps.length > 0 ? "line-clamp-2" : "line-clamp-3"} text-[17px] leading-[1.35] text-ink/80`}>{e.summary}</p>
      )}
    </div>
  );
}

/** A roomy card, used when four small ones won't fit: two per slide, with the order of events as a numbered path. */
function EventCardTall({ e, i }: { e: ReviewEvent; i: number }) {
  const tone = TONES[i % TONES.length];
  const steps = (e.order ?? []).filter(Boolean);
  return (
    <div
      className="yr-rise relative flex min-h-0 flex-col overflow-hidden rounded-[28px] bg-white py-5 pl-8 pr-6 shadow-[0_16px_34px_-16px_rgba(24,12,98,0.4)]"
      style={delay(0.15 + i * 0.12)}
    >
      <span className="absolute bottom-0 left-0 top-0 w-[10px]" style={{ background: tone.bar }} />
      <EventCardTop e={e} tone={tone} />
      <h3 className="mt-2 line-clamp-2 font-display text-[30px] font-bold leading-[1.15] text-rccg-purple-800">{e.title}</h3>
      {steps.length > 0 && (
        <div className="relative mt-3">
          <div className="absolute bottom-[11px] left-[10px] top-[11px] border-l-2 border-dashed" style={{ borderColor: tone.bar, opacity: 0.35 }} />
          <ol className="relative space-y-[6px]">
            {steps.map((step, n) => (
              <li key={n} className="flex items-center gap-3">
                <span
                  className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold leading-none text-white"
                  style={{ background: tone.bar }}
                >
                  {n + 1}
                </span>
                <span className="truncate text-[17px] leading-[22px] text-ink">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {e.summary && (
        <p className={`mt-3 ${steps.length >= 6 ? "line-clamp-2" : "line-clamp-3"} text-[17px] leading-[1.35] text-ink/80`}>{e.summary}</p>
      )}
    </div>
  );
}

// How tall a small card would come out, in px (a rough count of its lines). A small card has about 214 px.
const COMPACT_MAX = 214;
function estimateCardHeight(e: ReviewEvent): number {
  const titleLines = e.title.length > 36 ? 2 : 1;
  const steps = (e.order ?? []).filter(Boolean);
  const stepsLines = steps.length > 0 ? Math.ceil((steps.join(" › ").length + 9) / 66) : 0;
  const summaryLines = e.summary ? (stepsLines > 0 ? 2 : 3) : 0;
  return 32 + 34 + titleLines * 30 + (stepsLines ? 6 + stepsLines * 20 : 0) + (summaryLines ? 6 + summaryLines * 23 : 0);
}

interface EventPage {
  variant: CardVariant;
  items: ReviewEvent[];
}

/**
 * Four small cards to a slide when they all fit. When one of the next four wouldn't fit (a long order of
 * events, say), that slide takes just two, with roomier cards. A slide with only one or two events also uses
 * the roomy cards, and a lone last card borrows a neighbour from the slide before it.
 */
function paginateEvents(events: ReviewEvent[]): EventPage[] {
  const pages: EventPage[] = [];
  let i = 0;
  while (i < events.length) {
    const four = events.slice(i, i + 4);
    if (four.every((e) => estimateCardHeight(e) <= COMPACT_MAX)) {
      pages.push({ variant: "compact", items: four });
      i += four.length;
    } else {
      const two = events.slice(i, i + 2);
      pages.push({ variant: "tall", items: two });
      i += two.length;
    }
  }
  const last = pages[pages.length - 1];
  const before = pages[pages.length - 2];
  if (last && before && last.variant === "compact" && last.items.length === 1 && before.variant === "compact" && before.items.length === 4) {
    last.items.unshift(before.items.pop() as ReviewEvent);
  }
  for (const page of pages) if (page.items.length <= 2) page.variant = "tall";
  return pages;
}

function EventsSlide({
  page,
  total,
  part,
  parts,
  startIndex,
}: {
  page: EventPage;
  total: number;
  part: number;
  parts: number;
  startIndex: number;
}) {
  const { items, variant } = page;
  const tall = variant === "tall";
  return (
    <>
      <Heading
        kicker={
          items.some((e) => e.isToday)
            ? parts > 1
              ? `Part ${part} of ${parts} · including today!`
              : "Looking back, and today!"
            : parts > 1
            ? `Part ${part} of ${parts}`
            : "Looking back"
        }
        title="Moments we shared"
        sub={`${pluralize(total, "moment")} to remember`}
      />
      <div
        className="mt-6 grid min-h-0 flex-1 gap-5"
        style={
          tall
            ? {
                gridTemplateColumns: items.length === 1 ? "minmax(0, 640px)" : "repeat(2, minmax(0, 1fr))",
                gridTemplateRows: "minmax(0, 1fr)",
                justifyContent: "center",
              }
            : { gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gridTemplateRows: "repeat(2, minmax(0, 1fr))" }
        }
      >
        {items.map((e, i) => (tall ? <EventCardTall key={e.key} e={e} i={startIndex + i} /> : <EventCard key={e.key} e={e} i={startIndex + i} />))}
      </div>
    </>
  );
}

// The memories slides are for pictures: two collage screens, shown one after the other, with room for
// 16 pictures (6 portraits, some taller than others, 8 landscapes and 2 squares). Until there are
// photos, every frame shows a placeholder icon. Photos come from lib/yearReviewPhotos.ts.
const PHOTO_TONES = [
  { bg: "linear-gradient(135deg,#E5E1F4,#CBC4E7)", icon: "#7E6EB8" },
  { bg: "linear-gradient(135deg,#C7E6D0,#92CDA4)", icon: "#046A23" },
  { bg: "linear-gradient(135deg,#FAD4D1,#F2A6A1)", icon: "#B5130E" },
  { bg: "linear-gradient(135deg,#FFEFC7,#FFD66B)", icon: "#8A5A00" },
];

type FrameKind = "tall" | "portrait" | "landscape" | "square";
type Orientation = "portrait" | "landscape" | "square";
// pw x ph is the picture itself; the white border is added around it.
const FRAME: Record<FrameKind, { pw: number; ph: number; orient: Orientation }> = {
  tall: { pw: 150, ph: 230, orient: "portrait" },
  portrait: { pw: 170, ph: 220, orient: "portrait" },
  landscape: { pw: 240, ph: 160, orient: "landscape" },
  square: { pw: 180, ph: 180, orient: "square" },
};
const PAD = 12;
const STRIP = 30;

interface Frame {
  kind: FrameKind;
  x: number;
  y: number;
  r: number;
}

// The heading sits top-left of each screen, so no frame goes there.
const MEMORY_PAGES: Frame[][] = [
  [
    { kind: "landscape", x: 660, y: 30, r: 4 },
    { kind: "landscape", x: 950, y: 52, r: -3 },
    { kind: "tall", x: 50, y: 222, r: -4 },
    { kind: "landscape", x: 250, y: 240, r: 3 },
    { kind: "portrait", x: 540, y: 252, r: -3 },
    { kind: "square", x: 760, y: 250, r: 4 },
    { kind: "tall", x: 990, y: 272, r: -3 },
    { kind: "landscape", x: 440, y: 490, r: -2 },
  ],
  [
    { kind: "square", x: 650, y: 30, r: -4 },
    { kind: "landscape", x: 890, y: 48, r: 3 },
    { kind: "landscape", x: 50, y: 225, r: -3 },
    { kind: "portrait", x: 340, y: 236, r: 4 },
    { kind: "landscape", x: 565, y: 285, r: -2 },
    { kind: "tall", x: 860, y: 282, r: 3 },
    { kind: "portrait", x: 1052, y: 290, r: -4 },
    { kind: "landscape", x: 380, y: 500, r: -2 },
  ],
];

/** How many pictures of each shape the memories slides have room for. */
export const MEMORY_CAPACITY: Record<Orientation, number> = MEMORY_PAGES.flat().reduce(
  (acc, f) => {
    acc[FRAME[f.kind].orient] += 1;
    return acc;
  },
  { portrait: 0, landscape: 0, square: 0 } as Record<Orientation, number>
);

/** Hands each picture to the next empty frame of its shape, in order, across both screens. */
function assignPhotos(photos: MemoryPhoto[]): (string | undefined)[][] {
  const queues: Record<Orientation, string[]> = {
    portrait: photos.filter((p) => p.orientation === "portrait").map((p) => p.src),
    landscape: photos.filter((p) => p.orientation === "landscape").map((p) => p.src),
    square: photos.filter((p) => p.orientation === "square").map((p) => p.src),
  };
  return MEMORY_PAGES.map((page) => page.map((f) => queues[FRAME[f.kind].orient].shift()));
}

function PhotoPlaceholder({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="6" y="10" width="52" height="44" rx="8" stroke={color} strokeWidth="4" />
      <circle cx="22" cy="26" r="6" fill={color} />
      <path d="M10 48 L26 33 L36 43 L44 35 L54 46" stroke={color} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function MemoryFrame({ frame, i, src }: { frame: Frame; i: number; src?: string }) {
  const f = FRAME[frame.kind];
  const tone = PHOTO_TONES[i % PHOTO_TONES.length];
  return (
    <div
      className="yr-pop absolute rounded-[14px] bg-white shadow-[0_22px_40px_-16px_rgba(24,12,98,0.5)]"
      style={{
        left: frame.x,
        top: frame.y,
        width: f.pw + PAD * 2,
        height: f.ph + PAD * 2 + STRIP,
        padding: PAD,
        ["--r" as string]: `${frame.r}deg`,
        ...delay(0.2 + i * 0.1),
      }}
    >
      <span
        className="absolute -top-3 left-1/2 h-6 w-16 rounded-sm"
        style={{ background: "rgba(255,214,107,0.8)", transform: `translateX(-50%) rotate(${frame.r > 0 ? -5 : 5}deg)` }}
      />
      <div className="flex items-center justify-center overflow-hidden rounded-[8px]" style={{ width: f.pw, height: f.ph, background: tone.bg }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <PhotoPlaceholder size={Math.min(f.pw, f.ph) * 0.4} color={tone.icon} />
        )}
      </div>
      <div className="flex items-center justify-center text-[15px]" style={{ height: STRIP, color: tone.icon, opacity: 0.7 }}>
        ✦
      </div>
    </div>
  );
}

function MemoriesSlide({ page, photos }: { page: 0 | 1; photos: (string | undefined)[] }) {
  return (
    <>
      <div className="relative z-10">
        <Heading
          kicker={`Scrapbook · ${page + 1} of ${MEMORY_PAGES.length}`}
          title={page === 0 ? "Memories we made" : "More memories"}
          sub={page === 0 ? "A little collage of our year." : "Smiles, friends and good times."}
        />
      </div>
      {MEMORY_PAGES[page].map((frame, i) => (
        <MemoryFrame key={i} frame={frame} i={i + page * 3} src={photos[i]} />
      ))}
    </>
  );
}

function StatTile({ emoji, label, value, bg, ink, i }: { emoji: string; label: string; value: ReactNode; bg: string; ink: string; i: number }) {
  return (
    <div
      className="yr-pop flex flex-1 items-center gap-4 rounded-[28px] px-6 py-4 shadow-[0_14px_30px_-18px_rgba(24,12,98,0.45)]"
      style={{ background: bg, color: ink, ...delay(0.15 + i * 0.1) }}
    >
      <span className="text-[52px] leading-none">{emoji}</span>
      <div>
        <div className="font-title text-[56px] leading-none">{value}</div>
        <div className="mt-1 text-[19px] font-semibold">{label}</div>
      </div>
    </div>
  );
}

function GameDayList({ rows, delayS }: { rows: ReviewGameDay[]; delayS: number }) {
  return (
    <div className="yr-rise min-h-0 overflow-hidden rounded-[26px] bg-white px-6 py-4" style={delay(delayS)}>
      <p className="text-[15px] font-bold uppercase tracking-[0.14em] text-muted">Game days</p>
      <ul className="mt-2 space-y-2.5">
        {rows.map((r) => (
          <li key={`${r.title}-${r.date}`}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate font-display text-[22px] font-bold text-rccg-purple-800">{r.title}</span>
              {r.date && <span className="shrink-0 text-[15px] text-muted">{formatDate(r.date)}</span>}
            </div>
            <p className="truncate text-[17px] text-ink/75">
              {r.champion
                ? `🏆 ${r.champion}`
                : r.note
                ? `${r.outdoor ? "🌳 Outdoors: " : "🎮 "}${r.note}`
                : pluralize(r.gamesPlayed, "game")}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GamesSlide({ data }: { data: YearReviewData }) {
  const g = data.games!;
  if (!g.recorded) {
    return (
      <>
        <Heading kicker="Game days" title="Playing together" sub="Good fun, friendly rivalry." />
        <div className="mt-5 flex shrink-0 gap-5">
          <StatTile i={0} emoji="🏟️" label="Game days" value={<CountUp value={g.gameDays} />} bg="#FFFFFF" ink="#2F1C86" />
          {g.outdoorGames > 0 && (
            <StatTile i={1} emoji="🌳" label="Outdoor games" value={<CountUp value={g.outdoorGames} />} bg="#FFFFFF" ink="#046A23" />
          )}
        </div>
        <div className="mt-5 min-h-0 flex-1">
          <GameDayList rows={g.recent} delayS={0.5} />
        </div>
      </>
    );
  }
  return (
    <>
      <Heading kicker="Game days" title="Playing together" sub="Good fun, friendly rivalry." />
      <div className="mt-5 flex shrink-0 gap-5">
        <StatTile i={0} emoji="🏟️" label="Game days" value={<CountUp value={g.gameDays} />} bg="#FFFFFF" ink="#2F1C86" />
        <StatTile i={1} emoji="🧠" label="Quiz games played" value={<CountUp value={g.gamesPlayed} />} bg="#FFFFFF" ink="#046A23" />
        <StatTile i={2} emoji="⚽" label="Outdoor games" value={<CountUp value={g.outdoorGames} />} bg="#FFFFFF" ink="#B5130E" />
      </div>
      <div className="mt-5 grid min-h-0 flex-1 grid-cols-[1fr_1.25fr] gap-5">
        <div className="yr-rise flex min-h-0 flex-col gap-4" style={delay(0.55)}>
          {g.mostPlayed && (
            <div className="rounded-[26px] bg-rccg-purple-700 px-6 py-4 text-white">
              <p className="text-[15px] font-bold uppercase tracking-[0.14em] text-rccg-purple-200">Crowd favourite</p>
              <p className="mt-1 font-title text-[32px] leading-tight">{g.mostPlayed.label}</p>
              <p className="text-[18px] text-rccg-purple-100">played {pluralize(g.mostPlayed.count, "time")}</p>
            </div>
          )}
          {g.teamWins.length > 0 && (
            <div className="rounded-[26px] bg-white px-6 py-4">
              <p className="text-[15px] font-bold uppercase tracking-[0.14em] text-muted">Game days won</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {g.teamWins.map((t) => (
                  <span key={t.name} className="rounded-full bg-rccg-green-100 px-4 py-1 text-[19px] font-bold text-rccg-green-700">
                    {t.name} · {t.wins}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <GameDayList rows={g.recent} delayS={0.7} />
      </div>
    </>
  );
}

function ContributionsSlide({ data }: { data: YearReviewData }) {
  const c = data.contributions!;
  const percent = c.totalPledged > 0 ? Math.round((c.totalRedeemed / c.totalPledged) * 100) : null;
  return (
    <>
      <Heading kicker="Giving" title="Generous hearts" sub="Every drive, big or small, made a difference." />
      <div className="mt-5 flex shrink-0 gap-5">
        <StatTile i={0} emoji="🤝" label={c.drives === 1 ? "Drive" : "Drives"} value={<CountUp value={c.drives} />} bg="#FFFFFF" ink="#2F1C86" />
        <StatTile i={1} emoji="🙌" label="Pledged" value={<span style={{ fontSize: bigNumberSize(naira(c.totalPledged), 48) }}><CountUp value={c.totalPledged} format={(n) => naira(Math.round(n))} /></span>} bg="#FFFFFF" ink="#B5130E" />
        <StatTile i={2} emoji="🎁" label={percent !== null ? `Redeemed (${percent}%)` : "Redeemed"} value={<span style={{ fontSize: bigNumberSize(naira(c.totalRedeemed), 48) }}><CountUp value={c.totalRedeemed} format={(n) => naira(Math.round(n))} /></span>} bg="#FFFFFF" ink="#046A23" />
      </div>
      <div className="yr-rise mt-5 min-h-0 flex-1 overflow-hidden rounded-[26px] bg-white px-7 py-4" style={delay(0.6)}>
        <ul className="space-y-3">
          {c.top.slice(0, c.itemsPledged > 0 ? 3 : 4).map((d) => (
            <li key={d.title}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="truncate font-display text-[22px] font-bold text-rccg-purple-800">{d.title}</span>
                <span className="num shrink-0 text-[17px] text-muted">
                  {naira(d.redeemed)} of {naira(d.pledged)}
                </span>
              </div>
              <div className="mt-1.5">
                <GrowBar percent={d.percent ?? 0} color="linear-gradient(90deg,#028A2C,#5BC57A)" height={14} />
              </div>
            </li>
          ))}
        </ul>
        {c.itemsPledged > 0 && (
          <p className="mt-3 text-[18px] text-ink/75">
            🧺 Items: <strong>{formatQuantity(c.itemsPledged)}</strong> pledged · <strong>{formatQuantity(c.itemsRedeemed)}</strong> redeemed
          </p>
        )}
      </div>
    </>
  );
}

function FinanceSlide({ data, partYear }: { data: YearReviewData; partYear: boolean }) {
  const f = data.finance!;
  const max = Math.max(f.income, f.spending, 1);
  const cards = [
    { emoji: "💚", label: "Came in", value: f.income, hint: f.dues > 0 ? `${naira(f.dues)} from dues` : undefined, bg: "#C7E6D0", ink: "#046A23" },
    { emoji: "🧾", label: "Went out", value: f.spending, hint: undefined, bg: "#FAD4D1", ink: "#B5130E" },
    { emoji: "🏦", label: partYear ? "Balance so far" : "Closing balance", value: f.closingBalance, hint: `Started the year with ${naira(f.openingBalance)}`, bg: "#E5E1F4", ink: "#2F1C86" },
  ];
  return (
    <>
      <Heading kicker="Our books" title="The money story" sub="Thank you for keeping the family running." />
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-6">
      <div className="flex shrink-0 gap-5">
        {cards.map((c, i) => {
          const text = naira(c.value);
          return (
            <div
              key={c.label}
              className="yr-pop flex-1 rounded-[30px] px-7 py-6 shadow-[0_16px_34px_-18px_rgba(24,12,98,0.45)]"
              style={{ background: c.bg, color: c.ink, ["--r" as string]: `${i === 1 ? 1.5 : i === 2 ? -1.5 : 0}deg`, ...delay(0.2 + i * 0.12) }}
            >
              <div className="flex items-center gap-3">
                <span className="text-[34px] leading-none">{c.emoji}</span>
                <span className="text-[20px] font-bold uppercase tracking-[0.1em]">{c.label}</span>
              </div>
              <div className="mt-3 font-title leading-none" style={{ fontSize: bigNumberSize(text, 54) }}>
                <CountUp value={c.value} format={(n) => naira(Math.round(n))} />
              </div>
              <p className="mt-2 min-h-[24px] text-[17px] opacity-80">{c.hint}</p>
            </div>
          );
        })}
      </div>
      <div className="yr-rise rounded-[26px] bg-white px-7 py-5" style={delay(0.7)}>
        <div className="flex items-center gap-4">
          <span className="w-[90px] text-[18px] font-bold text-rccg-green-700">In</span>
          <GrowBar percent={(f.income / max) * 100} color="linear-gradient(90deg,#028A2C,#5BC57A)" height={20} />
        </div>
        <div className="mt-3 flex items-center gap-4">
          <span className="w-[90px] text-[18px] font-bold text-rccg-red-700">Out</span>
          <GrowBar percent={(f.spending / max) * 100} color="linear-gradient(90deg,#D61812,#F2837E)" height={20} />
        </div>
      </div>
      </div>
    </>
  );
}

function PlanCard({ p, i }: { p: ReviewPlan; i: number }) {
  const tone = TONES[i % TONES.length];
  return (
    <div
      className="yr-rise flex min-h-0 items-start gap-4 rounded-[26px] bg-white px-5 py-3.5 shadow-[0_14px_30px_-16px_rgba(120,80,0,0.35)]"
      style={delay(0.15 + i * 0.08)}
    >
      <div
        className="flex h-[64px] w-[64px] shrink-0 flex-col items-center justify-center rounded-[20px] font-title text-[22px] leading-none"
        style={{ background: tone.pill, color: tone.pillText }}
      >
        {p.month ? MONTH_NAMES[p.month - 1].slice(0, 3).toUpperCase() : "TBA"}
      </div>
      <div className="min-w-0">
        <h3 className="line-clamp-2 font-display text-[23px] font-bold leading-[1.15] text-rccg-purple-800">{p.title}</h3>
        {p.timeNote && <p className="mt-0.5 truncate text-[16px] text-muted">{p.timeNote}</p>}
        {p.budget ? <p className="mt-1 text-[17px] font-semibold text-rccg-green-700">about {naira(p.budget)}</p> : null}
      </div>
    </div>
  );
}

function PlansSlide({ data, items, part, parts, startIndex }: { data: YearReviewData; items: ReviewPlan[]; part: number; parts: number; startIndex: number }) {
  const plans = data.plans!;
  return (
    <>
      <Heading
        kicker={parts > 1 ? `Part ${part} of ${parts}` : plans.approved ? "The plan" : "Ideas on the table"}
        title={`Looking ahead to ${plans.year}`}
        sub={plans.approved ? "Here is what we are planning together." : "Nothing is final yet, but here is what we are dreaming of."}
        dark={false}
      />
      <div className="mt-5 grid min-h-0 flex-1 grid-cols-2 content-start gap-3">
        {items.map((p, i) => (
          <PlanCard key={p.key} p={p} i={startIndex + i} />
        ))}
      </div>
      {part === parts && plans.totalBudget > 0 && (
        <p className="yr-rise shrink-0 text-right text-[19px] font-semibold text-rccg-purple-700" style={delay(0.6)}>
          Rough budget for all of this: {naira(plans.totalBudget)}
        </p>
      )}
    </>
  );
}

function ClosingSlide({ data }: { data: YearReviewData }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="yr-pop text-[80px] leading-none" style={delay(0.1)}>
        🎉
      </div>
      <h2 className="yr-rise mt-4 font-title text-[104px] leading-none" style={delay(0.3)}>
        Thank you!
      </h2>
      <p className="yr-rise mt-5 text-[34px] text-rccg-purple-100" style={delay(0.55)}>
        for an amazing {data.year}
      </p>
      <div
        className="yr-pop mt-8 rounded-[26px] px-9 py-2 font-title text-[44px] text-rccg-purple-800"
        style={{ background: "#FFD66B", ["--r" as string]: "2deg", ...delay(0.85) }}
      >
        Here&apos;s to {data.year + 1} ✨
      </div>
      <div className="yr-rise mt-9" style={delay(1.05)}>
        <Logo size={52} chip />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The slideshow                                                       */
/* ------------------------------------------------------------------ */

interface SlideDef {
  id: string;
  theme: ThemeName;
  node: ReactNode;
}

export function buildSlides(data: YearReviewData): SlideDef[] {
  const slides: SlideDef[] = [{ id: "cover", theme: "night", node: <CoverSlide data={data} /> }];

  const glance = [data.events.length, data.games?.gamesPlayed ?? 0, data.contributions?.drives ?? 0, data.youths ?? 0].some((n) => n > 0);
  if (glance) slides.push({ id: "glance", theme: "lavender", node: <GlanceSlide data={data} /> });

  const eventPages = paginateEvents(data.events);
  eventPages.forEach((page, i) =>
    slides.push({
      id: `events-${i}`,
      theme: i % 2 === 0 ? "mint" : "blush",
      node: (
        <EventsSlide
          page={page}
          total={data.events.length}
          part={i + 1}
          parts={eventPages.length}
          startIndex={eventPages.slice(0, i).reduce((n, p) => n + p.items.length, 0)}
        />
      ),
    })
  );

  if (data.games) slides.push({ id: "games", theme: "lavender", node: <GamesSlide data={data} /> });
  if (data.contributions) slides.push({ id: "contributions", theme: "blush", node: <ContributionsSlide data={data} /> });
  if (data.finance) {
    slides.push({
      id: "finance",
      theme: "mint",
      node: <FinanceSlide data={data} partYear={data.year === new Date().getFullYear()} />,
    });
  }

  if (data.plans) {
    const planPages = chunk(data.plans.items, 6);
    planPages.forEach((page, i) =>
      slides.push({
        id: `plans-${i}`,
        theme: "cream",
        node: <PlansSlide data={data} items={page} part={i + 1} parts={planPages.length} startIndex={planPages.slice(0, i).reduce((n, p) => n + p.length, 0)} />,
      })
    );
  }

  // The pictures come last (two collage screens), just before the thank-you.
  const placed = assignPhotos(data.memoryPhotos ?? []);
  slides.push({ id: "memories-1", theme: "blush", node: <MemoriesSlide page={0} photos={placed[0]} /> });
  slides.push({ id: "memories-2", theme: "lavender", node: <MemoriesSlide page={1} photos={placed[1]} /> });

  slides.push({ id: "closing", theme: "night", node: <ClosingSlide data={data} /> });
  return slides;
}

function useStageBox() {
  const [box, setBox] = useState({ scale: 1, left: 0, top: 0 });
  useEffect(() => {
    const calc = () => {
      const s = Math.min(window.innerWidth / W, window.innerHeight / H);
      setBox({ scale: s, left: (window.innerWidth - W * s) / 2, top: (window.innerHeight - H * s) / 2 });
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);
  return box;
}

export default function YearReviewSlides({
  year,
  onClose,
  photos,
}: {
  year: number;
  onClose: () => void;
  /** Pictures added on the card this session. When there are some, they are used for the memories slides. */
  photos?: MemoryPhoto[];
}) {
  const [data, setData] = useState<YearReviewData | null>(null);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const [idle, setIdle] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);
  const box = useStageBox();

  useEffect(() => {
    let cancelled = false;
    buildYearReview(year)
      .then((d) => !cancelled && setData(d))
      .catch((err) => {
        console.error(err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  const shown = useMemo(
    () => (data && photos && photos.length > 0 ? { ...data, memoryPhotos: photos } : data),
    [data, photos]
  );
  const slides = useMemo(() => (shown ? buildSlides(shown) : []), [shown]);
  const last = Math.max(0, slides.length - 1);

  const go = useCallback((n: number) => setIndex(Math.max(0, Math.min(last, n))), [last]);
  const next = useCallback(() => setIndex((i) => Math.min(last, i + 1)), [last]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.();
  }, []);

  // Keyboard.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp" || e.key === "Backspace") {
        e.preventDefault();
        prev();
      } else if (e.key === "Home") setIndex(0);
      else if (e.key === "End") setIndex(last);
      else if (e.key === "f" || e.key === "F") toggleFullscreen();
      else if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, last, toggleFullscreen, onClose]);

  // Hide the page behind, and leave full screen when closing.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("fullscreenchange", onFs);
      if (document.fullscreenElement) void document.exitFullscreen();
    };
  }, []);

  // The controls fade away when the mouse is still.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), 2600);
    };
    wake();
    window.addEventListener("mousemove", wake);
    window.addEventListener("touchstart", wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("touchstart", wake);
    };
  }, []);

  const slide = slides[index];
  const controlStyle: CSSProperties = { opacity: idle ? 0 : 1, transition: "opacity .4s", pointerEvents: idle ? "none" : "auto" };
  const circleBtn =
    "flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-lg font-bold text-rccg-purple-700 shadow-lg backdrop-blur transition hover:bg-white disabled:opacity-40";

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${year} year in review`}
      className="fixed inset-0 z-[100] select-none bg-[#0B0535]"
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
      }}
    >
      <style>{YEAR_REVIEW_CSS}</style>

      {!data && !failed && (
        <div className="flex h-full flex-col items-center justify-center text-white">
          <div className="yr-twinkle text-6xl">✨</div>
          <p className="mt-4 font-display text-xl">Gathering the year…</p>
        </div>
      )}

      {failed && (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center text-white">
          <p className="font-display text-xl">We couldn&apos;t gather the year just now.</p>
          <button type="button" onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      )}

      {slide && (
        <div
          className="absolute overflow-hidden rounded-[22px] shadow-2xl"
          style={{ width: W, height: H, left: box.left, top: box.top, transform: `scale(${box.scale})`, transformOrigin: "top left" }}
        >
          {/* Keyed by index so every slide's entrance animations play each time. */}
          <div key={`${slide.id}-${index}`} className="yr-stage absolute inset-0">
            <SlideShell theme={slide.theme} seed={index}>
              {slide.node}
            </SlideShell>
          </div>
          {/* Click the right or left edge to move on or back. */}
          <button type="button" aria-label="Previous slide" onClick={prev} className="absolute bottom-0 left-0 top-0 w-[14%] cursor-w-resize" />
          <button type="button" aria-label="Next slide" onClick={next} className="absolute bottom-0 right-0 top-0 w-[14%] cursor-e-resize" />
        </div>
      )}

      {slides.length > 0 && (
        <>
          <div className="absolute right-4 top-4 flex items-start gap-2" style={controlStyle}>
            {data && (
              <YearReviewExportMenu
                year={year}
                getData={async () => shown as YearReviewData}
                buttonClassName={circleBtn}
                label="⤓"
                menuAlign="right"
                statusClassName="mt-2.5 rounded-full bg-black/45 px-3 py-1 text-sm text-white"
              />
            )}
            <button type="button" onClick={toggleFullscreen} className={circleBtn} aria-label={fullscreen ? "Exit full screen" : "Full screen"} title="Full screen (F)">
              {fullscreen ? "⤡" : "⤢"}
            </button>
            <button type="button" onClick={onClose} className={circleBtn} aria-label="Close" title="Close (Esc)">
              ✕
            </button>
          </div>

          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/35 px-3 py-2 backdrop-blur" style={controlStyle}>
            <button type="button" onClick={prev} disabled={index === 0} className={circleBtn} aria-label="Previous slide">
              ‹
            </button>
            <div className="flex items-center gap-1.5">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={i === index}
                  className="h-2.5 rounded-full transition-all"
                  style={{ width: i === index ? 26 : 10, background: i === index ? "#FFD66B" : "rgba(255,255,255,0.55)" }}
                />
              ))}
            </div>
            <button type="button" onClick={next} disabled={index === last} className={circleBtn} aria-label="Next slide">
              ›
            </button>
          </div>
        </>
      )}
    </div>
  );
}
