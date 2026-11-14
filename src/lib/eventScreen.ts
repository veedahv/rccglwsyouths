import type { EventScreen, ScreenIconSet, ScreenPalette } from "@/types";

/** What an event's screen looks like until someone changes it. */
export const DEFAULT_SCREEN: EventScreen = { view: "cover", palette: "navy", icons: ["celebration"] };

export function screenOf(event: { screen?: EventScreen }): EventScreen {
  const s = event.screen;
  return {
    view: s?.view === "agenda" ? "agenda" : "cover",
    palette: s?.palette && s.palette in PALETTES ? s.palette : DEFAULT_SCREEN.palette,
    icons: s?.icons ?? DEFAULT_SCREEN.icons,
    ...(s?.tagline ? { tagline: s.tagline } : {}),
    ...(s?.nowIndex !== undefined ? { nowIndex: s.nowIndex } : {}),
  };
}

export interface Palette {
  label: string;
  background: string; // CSS background
  text: string;
  muted: string;
  accent: string; // the date pill, the "now" highlight
  onAccent: string; // text on the accent
  decor: string; // the faded icons
  card: string; // panels on top of the background
  cardBorder: string;
  swatch: string; // the colour shown on the picker
  dark: boolean;
}

export const PALETTES: Record<ScreenPalette, Palette> = {
  white: {
    label: "White",
    background: "#FFFFFF",
    text: "#180C62",
    muted: "rgba(24,12,98,0.6)",
    accent: "#028A2C",
    onAccent: "#FFFFFF",
    decor: "rgba(24,12,98,0.12)",
    card: "rgba(24,12,98,0.05)",
    cardBorder: "rgba(24,12,98,0.1)",
    swatch: "#FFFFFF",
    dark: false,
  },
  navy: {
    label: "Navy",
    background: "linear-gradient(160deg,#180C62 0%,#2A1782 100%)",
    text: "#FFFFFF",
    muted: "rgba(255,255,255,0.7)",
    accent: "#E8B04A",
    onAccent: "#180C62",
    decor: "rgba(255,255,255,0.12)",
    card: "rgba(255,255,255,0.1)",
    cardBorder: "rgba(255,255,255,0.14)",
    swatch: "#180C62",
    dark: true,
  },
  sky: {
    label: "Blue",
    background: "linear-gradient(160deg,#E4F0FF 0%,#CFE4FF 100%)",
    text: "#0B3A75",
    muted: "rgba(11,58,117,0.65)",
    accent: "#1D6FD1",
    onAccent: "#FFFFFF",
    decor: "rgba(11,58,117,0.13)",
    card: "rgba(255,255,255,0.65)",
    cardBorder: "rgba(11,58,117,0.12)",
    swatch: "#7FB4F0",
    dark: false,
  },
  green: {
    label: "Green",
    background: "linear-gradient(160deg,#035C1D 0%,#028A2C 100%)",
    text: "#FFFFFF",
    muted: "rgba(255,255,255,0.75)",
    accent: "#F2C75C",
    onAccent: "#0B3A12",
    decor: "rgba(255,255,255,0.13)",
    card: "rgba(255,255,255,0.12)",
    cardBorder: "rgba(255,255,255,0.18)",
    swatch: "#028A2C",
    dark: true,
  },
  red: {
    label: "Red",
    background: "linear-gradient(160deg,#A7110C 0%,#D61812 100%)",
    text: "#FFFFFF",
    muted: "rgba(255,255,255,0.78)",
    accent: "#F6D27A",
    onAccent: "#5B0B08",
    decor: "rgba(255,255,255,0.13)",
    card: "rgba(255,255,255,0.12)",
    cardBorder: "rgba(255,255,255,0.18)",
    swatch: "#D61812",
    dark: true,
  },
  gold: {
    label: "Cream",
    background: "linear-gradient(160deg,#FFF8E4 0%,#FFEFC4 100%)",
    text: "#4A2F00",
    muted: "rgba(74,47,0,0.65)",
    accent: "#C98A1B",
    onAccent: "#FFFFFF",
    decor: "rgba(74,47,0,0.13)",
    card: "rgba(255,255,255,0.6)",
    cardBorder: "rgba(74,47,0,0.12)",
    swatch: "#F2D48A",
    dark: false,
  },
  dark: {
    label: "Dark",
    background: "linear-gradient(160deg,#0B0A1C 0%,#171433 100%)",
    text: "#FFFFFF",
    muted: "rgba(255,255,255,0.65)",
    accent: "#E8B04A",
    onAccent: "#180C62",
    decor: "rgba(255,255,255,0.11)",
    card: "rgba(255,255,255,0.08)",
    cardBorder: "rgba(255,255,255,0.12)",
    swatch: "#0F0C24",
    dark: true,
  },
};

export const PALETTE_ORDER: ScreenPalette[] = ["white", "navy", "sky", "green", "red", "gold", "dark"];

export type IconKind =
  | "heart" | "spark" | "bubble" | "house" | "people" | "flag" | "plate" | "fork" | "spoon" | "cup" | "apple" | "bread"
  | "cupcake" | "ball" | "whistle" | "trophy" | "cone" | "stopwatch" | "medal" | "sun" | "tree" | "basketball" | "dumbbell"
  | "cross" | "flame" | "note" | "star" | "balloon" | "book" | "bulb" | "globe";

export const ICON_SETS: Record<ScreenIconSet, { label: string; icons: IconKind[] }> = {
  love: { label: "Love", icons: ["heart", "spark", "bubble", "heart", "house"] },
  food: { label: "Food", icons: ["plate", "fork", "cup", "apple", "bread", "cupcake", "spoon"] },
  community: { label: "Community", icons: ["people", "house", "bubble", "heart", "globe", "flag"] },
  football: { label: "Football", icons: ["ball", "whistle", "trophy", "cone", "flag", "stopwatch"] },
  outdoor: { label: "Outdoor games", icons: ["sun", "tree", "basketball", "medal", "stopwatch", "dumbbell", "flag"] },
  worship: { label: "Worship", icons: ["cross", "book", "flame", "note", "star", "heart"] },
  celebration: { label: "Celebration", icons: ["balloon", "star", "spark", "cupcake", "note"] },
  learning: { label: "Learning", icons: ["book", "bulb", "bubble", "star", "globe"] },
};

export const ICON_SET_ORDER: ScreenIconSet[] = ["love", "food", "community", "football", "outdoor", "worship", "celebration", "learning"];

// Where the icons sit: percentages of the screen, kept to the edges and corners so the
// writing in the middle stays clear. `size` is in cqmin (1% of the screen's shorter side).
export const DECOR_SLOTS: { x: number; y: number; size: number; rotate: number }[] = [
  { x: 6, y: 10, size: 12, rotate: -12 },
  { x: 20, y: 6, size: 8, rotate: 8 },
  { x: 36, y: 5, size: 6, rotate: -6 },
  { x: 64, y: 5, size: 6, rotate: 10 },
  { x: 80, y: 7, size: 8, rotate: -8 },
  { x: 94, y: 11, size: 12, rotate: 12 },
  { x: 4, y: 34, size: 7, rotate: 6 },
  { x: 96, y: 33, size: 7, rotate: -6 },
  { x: 5, y: 58, size: 10, rotate: -10 },
  { x: 95, y: 60, size: 10, rotate: 8 },
  { x: 7, y: 88, size: 12, rotate: 10 },
  { x: 22, y: 93, size: 7, rotate: -8 },
  { x: 38, y: 92, size: 8, rotate: 6 },
  { x: 62, y: 93, size: 7, rotate: -10 },
  { x: 78, y: 92, size: 8, rotate: 8 },
  { x: 93, y: 88, size: 12, rotate: -12 },
  // A second, smaller ring between the edge icons and the writing.
  { x: 14, y: 24, size: 6, rotate: 14 },
  { x: 86, y: 24, size: 6, rotate: -14 },
  { x: 15, y: 46, size: 5, rotate: -6 },
  { x: 85, y: 47, size: 5, rotate: 8 },
  { x: 16, y: 72, size: 7, rotate: 12 },
  { x: 84, y: 74, size: 7, rotate: -10 },
  { x: 28, y: 16, size: 5, rotate: -10 },
  { x: 72, y: 16, size: 5, rotate: 12 },
  { x: 30, y: 80, size: 6, rotate: 6 },
  { x: 70, y: 82, size: 6, rotate: -6 },
  { x: 50, y: 3.5, size: 4, rotate: 0 },
];

/** The icon for each slot, taking turns between the chosen sets so a mix looks like a mix. */
export function decorFor(sets: ScreenIconSet[]): { kind: IconKind; x: number; y: number; size: number; rotate: number }[] {
  const lists = sets.filter((s) => s in ICON_SETS).map((s) => ICON_SETS[s].icons);
  if (lists.length === 0) return [];
  return DECOR_SLOTS.map((slot, i) => {
    const list = lists[i % lists.length];
    return { ...slot, kind: list[Math.floor(i / lists.length) % list.length] };
  });
}
