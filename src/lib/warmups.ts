// The "Fitness warm-ups" content shown under Games (/games/warm-ups), and stepped through one move at
// a time in leader mode. There are two parts:
//  - the ROUTINE: a 12 to 15 minute warm-up for outdoor games days (football, races, the egg race),
//    in four parts. To change it, edit it here.
//  - the LIBRARY: a long list of exercises in categories (lib/warmupLibraryData.ts), to pick from when
//    building a fitness session for a games event. To add exercises, paste them into that file.
import { WARMUP_LIBRARY_DATA, type RawExercise } from "./warmupLibraryData";

/**
 * What leader mode shows under a move, to help the leader keep track. Nothing is recorded or saved:
 * it only runs on the screen while that move is showing.
 *  - "timer": a stopwatch that counts up from 0:00, for something that goes on until the leader calls
 *    time, such as jogging. An optional goal says when to give a signal (it keeps counting).
 *  - "countdown": counts down to 0:00 and signals, for a pose or hold, such as a plank. A move done
 *    in several holds (each side, say) lists them, and the leader goes from one hold to the next.
 *  - "count": a tap-to-count tally, for reps. A move can have several sets (left side, right side…).
 * A move with none of these (a run over a set distance, say) shows only its instructions.
 */
export type WarmupTracker =
  | { kind: "timer"; goalSeconds?: number }
  | { kind: "countdown"; seconds: number; holds?: { label?: string }[] }
  | { kind: "count"; sets: { label?: string; target: number }[] };

export interface WarmupMove {
  id: string;
  name: string;
  /** How much to do: reps, distance or time. */
  dose: string;
  /** One or two plain sentences on how to do it. */
  how: string;
  tracker?: WarmupTracker;
  /** Library exercises only: how hard it is. */
  difficulty?: Difficulty;
  /** Library exercises only: about how long it takes, in seconds. */
  seconds?: number;
}

export type Difficulty = "Beginner" | "Intermediate" | "Advanced";

export interface WarmupSection {
  id: string;
  title: string;
  /** About how long the section takes, e.g. "2 to 3 min". Empty for a library category. */
  minutes: string;
  emoji: string;
  moves: WarmupMove[];
  /** "library" for a category of the exercise library; the four parts of the routine are the default. */
  kind?: "routine" | "library";
}

export const WARMUP_TITLE = "Fitness warm-ups";
export const WARMUP_TOTAL = "12 to 15 minutes";
export const WARMUP_INTRO =
  "A warm-up for outdoor games days: football, races and the egg race. A leader stands at the front and counts out loud, and everyone follows.";

export const WARMUP_SECTIONS: WarmupSection[] = [
  {
    id: "get-warm",
    title: "Get warm",
    minutes: "2 to 3 min",
    emoji: "🔥",
    moves: [
      {
        id: "jog",
        name: "Easy jog or brisk walk",
        dose: "About 2 minutes",
        how: "Go around the field. Start slow and pick up the pace a little every lap.",
        tracker: { kind: "timer", goalSeconds: 120 },
      },
      {
        id: "arms",
        name: "Arm circles and shoulder rolls",
        dose: "10 forward, 10 backward",
        how: "Keep the arms straight and make big, smooth circles. Then roll the shoulders.",
        tracker: { kind: "count", sets: [{ label: "Forward", target: 10 }, { label: "Backward", target: 10 }] },
      },
    ],
  },
  {
    id: "loosen-up",
    title: "Loosen up",
    minutes: "4 to 5 min",
    emoji: "🌀",
    moves: [
      {
        id: "twists",
        name: "Torso twists",
        dose: "10 each side",
        how: "Feet apart, arms relaxed. Turn the upper body left and right, letting the arms swing.",
        tracker: { kind: "count", sets: [{ label: "Left side", target: 10 }, { label: "Right side", target: 10 }] },
      },
      {
        id: "hips",
        name: "Hip circles",
        dose: "8 each way",
        how: "Hands on the hips and draw big circles with them. Change direction halfway.",
        tracker: { kind: "count", sets: [{ label: "One way", target: 8 }, { label: "The other way", target: 8 }] },
      },
      {
        id: "leg-swings",
        name: "Leg swings",
        dose: "10 per leg, forwards and back, then side to side",
        how: "Hold a partner's shoulder for balance. Swing the leg freely, a little higher each time.",
        tracker: {
          kind: "count",
          sets: [
            { label: "Right leg, forwards and back", target: 10 },
            { label: "Left leg, forwards and back", target: 10 },
            { label: "Right leg, side to side", target: 10 },
            { label: "Left leg, side to side", target: 10 },
          ],
        },
      },
      {
        id: "lunges",
        name: "Walking lunges with an overhead reach",
        dose: "8 each leg",
        how: "Step forward into a lunge and reach both arms up. Keep the front knee over the ankle.",
        tracker: { kind: "count", sets: [{ label: "Right leg", target: 8 }, { label: "Left leg", target: 8 }] },
      },
      {
        id: "squats",
        name: "Bodyweight squats",
        dose: "10, slow and controlled",
        how: "Feet shoulder-width apart, sit back as if onto a chair, chest up, then stand tall.",
        tracker: { kind: "count", sets: [{ target: 10 }] },
      },
      {
        id: "plank",
        name: "Plank hold",
        dose: "20 seconds",
        how: "Forearms and toes on the ground, body in one straight line, tummy tight. Keep breathing.",
        tracker: { kind: "countdown", seconds: 20 },
      },
    ],
  },
  {
    id: "legs-ready",
    title: "Get the legs ready",
    minutes: "4 to 5 min",
    emoji: "🦵",
    moves: [
      {
        id: "knees-kicks",
        name: "High knees, then butt kicks",
        dose: "About 20 metres each, 2 rounds",
        how: "Drive the knees up high, jog back, then flick the heels up towards the bottom.",
      },
      {
        id: "shuffles",
        name: "Side shuffles",
        dose: "2 rounds of about 20 metres each way",
        how: "Stay low with bent knees and push off the outside foot. Do not cross the feet.",
      },
      {
        id: "ankles",
        name: "Heel raises and ankle circles",
        dose: "15 raises, then 10 circles each ankle",
        how: "Rise onto the toes and lower slowly. Then circle each ankle. This helps against rolled ankles in football.",
        tracker: {
          kind: "count",
          sets: [
            { label: "Heel raises", target: 15 },
            { label: "Right ankle circles", target: 10 },
            { label: "Left ankle circles", target: 10 },
          ],
        },
      },
    ],
  },
  {
    id: "race-build-up",
    title: "Race build-ups",
    minutes: "2 min",
    emoji: "🏁",
    moves: [
      {
        id: "build-up-runs",
        name: "Three short runs",
        dose: "About 20 metres each, at 50%, 70% then 90%",
        how: "Jog back between runs. Each run is a little faster than the last, and the third is nearly full speed.",
      },
      {
        id: "egg",
        name: "Egg race practice (optional)",
        dose: "One slow walk",
        how: "Walk with the spoon and egg so nobody drops it on the first go.",
      },
    ],
  },
];

export const WARMUP_TIPS: string[] = [
  "Keep it moving. Long, held stretches belong at the end of the day, not before the games.",
  "Have water ready before you start, and give a short water break after the warm-up.",
  "Do it in shade if you can, and ease off if the sun is strong.",
  "Let different youths take turns leading a move each, so it feels like fun and not a lecture.",
  "Anyone who is injured or unwell can do the gentle moves and skip the sprints.",
];

/* ------------------------------------------------------------------ */
/* The exercise library                                                */
/* ------------------------------------------------------------------ */

const CATEGORY_EMOJI: Record<string, string> = {
  "Upper Body": "💪",
  "Lower Body": "🦵",
  "Abdomen and Core": "🎯",
  "Full Body": "🏃",
  "Back and Shoulders": "🧘",
  "Neck and Joints": "🔄",
};

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The sets of a counted exercise, read from its unit: "reps per leg" is a right-leg set then a left-leg set, and so on. */
function setsFor(raw: RawExercise): { label?: string; target: number }[] {
  const unit = raw.unit.toLowerCase();
  const target = raw.count;
  if (/per direction per ankle/.test(unit)) {
    return ["Right ankle, one way", "Right ankle, the other way", "Left ankle, one way", "Left ankle, the other way"].map((label) => ({ label, target }));
  }
  if (/per leg/.test(unit)) return [{ label: "Right leg", target }, { label: "Left leg", target }];
  if (/per side/.test(unit)) return [{ label: "Left side", target }, { label: "Right side", target }];
  if (/per direction/.test(unit)) {
    return unit.startsWith("steps")
      ? [{ label: "Forward", target }, { label: "Backward", target }]
      : [{ label: "One way", target }, { label: "The other way", target }];
  }
  return [{ target }];
}

/** The holds of a held exercise: "holds per side" is that many on the left, then on the right. */
function holdsFor(raw: RawExercise): { label?: string }[] {
  if (/per side/i.test(raw.unit)) {
    return ["Left side", "Right side"].flatMap((label) => Array.from({ length: raw.count }, () => ({ label })));
  }
  return Array.from({ length: raw.count }, () => ({}));
}

/** One library exercise as a move: reps get a counter, holds get a countdown for each hold. */
export function exerciseToMove(raw: RawExercise): WarmupMove {
  const isHold = /hold/i.test(raw.unit);
  const holds = isHold ? holdsFor(raw) : [];
  return {
    id: `lib-${slug(raw.name)}`,
    name: raw.name,
    dose: `${raw.count} ${raw.unit} · about ${raw.duration} sec`,
    how: raw.description,
    difficulty: raw.difficulty,
    seconds: raw.duration,
    tracker: isHold
      ? { kind: "countdown", seconds: Math.max(5, Math.round(raw.duration / holds.length)), holds }
      : { kind: "count", sets: setsFor(raw) },
  };
}

/** The library, one section per category, in the order the categories first appear. */
export const LIBRARY_SECTIONS: WarmupSection[] = (() => {
  const byCategory = new Map<string, WarmupMove[]>();
  for (const raw of WARMUP_LIBRARY_DATA) {
    byCategory.set(raw.category, [...(byCategory.get(raw.category) ?? []), exerciseToMove(raw)]);
  }
  return [...byCategory.entries()].map(([category, moves]) => ({
    id: `lib-${slug(category)}`,
    title: category,
    minutes: "",
    emoji: CATEGORY_EMOJI[category] ?? "✨",
    moves,
    kind: "library" as const,
  }));
})();

/** The four parts of the routine, then the library categories. */
export const ALL_SECTIONS: WarmupSection[] = [...WARMUP_SECTIONS, ...LIBRARY_SECTIONS];

export const LIBRARY_EXERCISE_COUNT = LIBRARY_SECTIONS.reduce((n, s) => n + s.moves.length, 0);

/** Moves that match a search (name, category or description) and, optionally, a difficulty. */
export function moveMatches(move: WarmupMove, section: WarmupSection, query: string, difficulty: Difficulty | "all" = "all"): boolean {
  if (difficulty !== "all" && move.difficulty !== difficulty) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${move.name} ${section.title} ${move.how}`.toLowerCase().includes(q);
}

/* ------------------------------------------------------------------ */
/* Stepping through                                                    */
/* ------------------------------------------------------------------ */

export interface WarmupStep extends WarmupMove {
  section: WarmupSection;
  /** 1-based position among the moves being led. */
  number: number;
}

/**
 * The moves to step through one at a time, each with its section. With a list of move ids it is just
 * those moves (always in the order of the routine and then the library, whatever order they were picked
 * in) and they are numbered 1, 2, 3… within that selection. Without a list it is every move.
 */
export function buildSteps(moveIds?: string[]): WarmupStep[] {
  const wanted = moveIds ? new Set(moveIds) : null;
  return ALL_SECTIONS.flatMap((section) => section.moves.map((m) => ({ ...m, section })))
    .filter((m) => !wanted || wanted.has(m.id))
    .map((m, i) => ({ ...m, number: i + 1 }));
}

/** The id of every move in the routine: what a new fitness session starts with. */
export const ROUTINE_MOVE_IDS: string[] = WARMUP_SECTIONS.flatMap((s) => s.moves.map((m) => m.id));

/** The id of every move, routine and library. */
export const ALL_MOVE_IDS: string[] = ALL_SECTIONS.flatMap((s) => s.moves.map((m) => m.id));

/** The routine, for leader mode on the Fitness warm-ups page. */
export const WARMUP_STEPS: WarmupStep[] = buildSteps(ROUTINE_MOVE_IDS);
