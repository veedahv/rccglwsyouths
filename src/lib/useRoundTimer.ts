"use client";

import { useEffect, useRef, useState } from "react";
import type { GameSession, TimerState } from "@/types/games";

export interface RoundTimer {
  enabled: boolean;
  total: number; // the limit in seconds, set when the session was started
  remaining: number; // seconds left right now (can be fractional)
  state: TimerState;
}

/**
 * A countdown that stays in step across screens without trusting any
 * device's clock. The admin's actions store "N seconds left, running" plus a
 * counter. Each screen starts counting down from the moment it receives that
 * change, and only restarts its count when the counter changes, so points
 * being awarded mid-countdown never nudge the clock.
 */
export function useRoundTimer(session: GameSession | null): RoundTimer {
  const total = session?.timerSeconds ?? 0;
  const state: TimerState = session?.timerState ?? "idle";
  const base = session?.timerRemaining ?? total;
  const key = `${session?.id ?? ""}|${session?.timerSeq ?? 0}|${state}|${base}`;

  const anchor = useRef({ key: "", at: Date.now() });
  if (anchor.current.key !== key) anchor.current = { key, at: Date.now() };

  const [, setTick] = useState(0);
  useEffect(() => {
    if (state !== "running") return;
    const t = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [state, key]);

  const elapsed = state === "running" ? (Date.now() - anchor.current.at) / 1000 : 0;
  const remaining = Math.max(0, base - elapsed);

  return { enabled: total > 0, total, remaining, state };
}
