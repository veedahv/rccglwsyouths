"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WarmupTracker } from "@/lib/warmups";

// What leader mode shows under a warm-up move: a stopwatch, a countdown, or a tap-to-count tally.
// Nothing here is saved. It lives only while its move is on screen, and starts fresh each time.

/* ------------------------------------------------------------------ */
/* A short beep (and a buzz on phones) to say time is up               */
/* ------------------------------------------------------------------ */

let audio: AudioContext | null = null;

/** Made on a button press (browsers only allow sound after one) and reused. */
function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audio ??= new Ctor();
  if (audio.state === "suspended") void audio.resume();
  return audio;
}

function signal(sound: boolean, beeps = 3) {
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // Not every phone can buzz. Nothing to do.
  }
  if (!sound) return;
  const ctx = audioContext();
  if (!ctx) return;
  for (let i = 0; i < beeps; i++) {
    const t = ctx.currentTime + i * 0.3;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = i === beeps - 1 ? 1100 : 880;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  }
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Enter does the main thing (start or pause, or count one more), unless a button has the focus and Enter already presses it. */
function useEnterKey(action: () => void) {
  const latest = useRef(action);
  latest.current = action;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Enter") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "BUTTON" || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      latest.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

const bigButton =
  "rounded-2xl px-8 py-4 text-2xl font-bold shadow-lg transition active:scale-95 disabled:opacity-40 sm:text-3xl";

function SoundToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      title={on ? "Sound on" : "Sound off"}
      className="rounded-full bg-white/80 px-3 py-1.5 text-sm font-semibold text-rccg-purple-700 shadow hover:bg-white"
    >
      {on ? "🔔 Sound on" : "🔕 Sound off"}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Stopwatch (counts up) and countdown                                 */
/* ------------------------------------------------------------------ */

/**
 * "up": counts up from 0:00 until the leader pauses it, and signals once when the goal (if any) is reached.
 * "down": counts down from `seconds` to 0:00 and signals when it gets there.
 */
function ClockView({ mode, seconds, holds }: { mode: "up" | "down"; seconds?: number; holds?: { label?: string }[] }) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [holdIndex, setHoldIndex] = useState(0); // which hold of a move done in several holds
  const [running, setRunning] = useState(false);
  const [sound, setSound] = useState(true);
  const startedAt = useRef(0);
  const base = useRef(0); // milliseconds banked before the latest start
  const signalled = useRef(false);

  const limitMs = mode === "down" ? (seconds ?? 0) * 1000 : null;
  const goalMs = mode === "up" && seconds ? seconds * 1000 : null;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      let ms = base.current + (performance.now() - startedAt.current);
      if (limitMs !== null && ms >= limitMs) {
        ms = limitMs;
        base.current = limitMs;
        setRunning(false);
      }
      setElapsedMs(ms);
    }, 100);
    return () => clearInterval(id);
  }, [running, limitMs]);

  // The signal: once when the countdown reaches 0:00, or once when the stopwatch reaches its goal.
  const reached = limitMs !== null ? elapsedMs >= limitMs && limitMs > 0 : goalMs !== null && elapsedMs >= goalMs;
  useEffect(() => {
    if (reached && !signalled.current) {
      signalled.current = true;
      signal(sound);
    }
  }, [reached, sound]);

  const start = useCallback(() => {
    audioContext(); // wakes the sound up on this button press
    startedAt.current = performance.now();
    setRunning(true);
  }, []);
  const pause = useCallback(() => {
    base.current += performance.now() - startedAt.current;
    setRunning(false);
    setElapsedMs(base.current);
  }, []);
  const reset = useCallback(() => {
    base.current = 0;
    signalled.current = false;
    setRunning(false);
    setElapsedMs(0);
    setHoldIndex(0);
  }, []);
  // On to the next hold: a fresh countdown that starts straight away.
  const nextHold = useCallback(() => {
    audioContext();
    base.current = 0;
    signalled.current = false;
    setElapsedMs(0);
    setHoldIndex((i) => i + 1);
    startedAt.current = performance.now();
    setRunning(true);
  }, []);

  const finishedCountdown = limitMs !== null && elapsedMs >= limitMs && limitMs > 0;
  const shownSeconds = limitMs !== null ? Math.ceil((limitMs - elapsedMs) / 1000) : elapsedMs / 1000;
  const progress = limitMs !== null ? elapsedMs / limitMs : goalMs !== null ? Math.min(1, elapsedMs / goalMs) : 0;
  const idle = !running && elapsedMs === 0;
  const moreHolds = Boolean(holds && holdIndex < holds.length - 1);

  useEnterKey(() => {
    if (finishedCountdown) (moreHolds ? nextHold : reset)();
    else if (running) pause();
    else start();
  });

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4" aria-live="off">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-rccg-purple-700 sm:text-base">
        {mode === "down" ? "⏳ Countdown" : "⏱ Timer"}
        {goalMs !== null && <span className="ml-2 font-semibold normal-case tracking-normal text-muted">goal {formatClock(goalMs / 1000)}</span>}
      </p>

      {holds && holds.length > 1 && (
        <p className="text-2xl font-bold text-ink sm:text-4xl">
          Hold {holdIndex + 1} of {holds.length}
          {holds[holdIndex]?.label ? ` · ${holds[holdIndex].label}` : ""}
        </p>
      )}

      <p
        className={`font-title text-7xl leading-none tabular-nums sm:text-9xl ${
          finishedCountdown ? "text-rccg-red-600" : reached ? "text-rccg-green-700" : "text-rccg-purple-800"
        }`}
        role="timer"
      >
        {finishedCountdown ? "Time!" : formatClock(shownSeconds)}
      </p>

      {(limitMs !== null || goalMs !== null) && (
        <div className="h-3 w-full overflow-hidden rounded-full bg-rccg-purple-100" aria-hidden="true">
          <div
            className="h-full rounded-full transition-[width] duration-100"
            style={{
              width: `${(limitMs !== null ? 1 - progress : progress) * 100}%`,
              background: finishedCountdown ? "#D61812" : "#028A2C",
            }}
          />
        </div>
      )}

      {reached && goalMs !== null && <p className="text-xl font-bold text-rccg-green-700 sm:text-2xl">Goal reached! Keep going until you call time.</p>}

      <div className="flex flex-wrap items-center justify-center gap-3">
        {finishedCountdown ? (
          moreHolds ? (
            <button type="button" onClick={nextHold} className={`${bigButton} bg-rccg-green-500 text-white`}>
              Next hold ›
            </button>
          ) : (
            <button type="button" onClick={reset} className={`${bigButton} bg-rccg-purple-700 text-white`}>
              Again
            </button>
          )
        ) : running ? (
          <button type="button" onClick={pause} className={`${bigButton} bg-rccg-red-600 text-white`}>
            Pause
          </button>
        ) : (
          <button type="button" onClick={start} className={`${bigButton} bg-rccg-green-500 text-white`}>
            {idle ? "Start" : "Resume"}
          </button>
        )}
        {!idle && !finishedCountdown && (
          <button type="button" onClick={reset} className="rounded-2xl bg-white px-5 py-3 text-lg font-semibold text-rccg-purple-700 shadow">
            Reset
          </button>
        )}
      </div>
      <SoundToggle on={sound} onChange={setSound} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tap-to-count tally                                                  */
/* ------------------------------------------------------------------ */

function CounterView({ sets }: { sets: { label?: string; target: number }[] }) {
  const [setIndex, setSetIndex] = useState(0);
  const [counts, setCounts] = useState<number[]>(() => sets.map(() => 0));
  const [sound, setSound] = useState(true);

  const current = sets[setIndex];
  const n = counts[setIndex];
  const done = n >= current.target;
  const lastSet = setIndex === sets.length - 1;
  const allDone = done && lastSet;

  const add = useCallback(() => {
    if (done) return;
    audioContext(); // wakes the sound up on this press
    const reachedNow = n + 1 >= current.target;
    setCounts((c) => c.map((v, i) => (i === setIndex ? v + 1 : v)));
    if (reachedNow) signal(sound, 2);
  }, [done, n, current.target, setIndex, sound]);
  const takeAway = () => setCounts((c) => c.map((v, i) => (i === setIndex ? Math.max(0, v - 1) : v)));
  const restartSet = () => setCounts((c) => c.map((v, i) => (i === setIndex ? 0 : v)));
  const nextSet = useCallback(() => setSetIndex((i) => Math.min(sets.length - 1, i + 1)), [sets.length]);

  useEnterKey(() => {
    if (done && !lastSet) nextSet();
    else add();
  });

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-rccg-purple-700 sm:text-base">
        🔢 Count
        {sets.length > 1 && <span className="ml-2 font-semibold normal-case tracking-normal text-muted">set {setIndex + 1} of {sets.length}</span>}
      </p>
      {current.label && <p className="text-2xl font-bold text-ink sm:text-4xl">{current.label}</p>}

      <p className={`font-title text-8xl leading-none tabular-nums sm:text-9xl ${done ? "text-rccg-green-700" : "text-rccg-purple-800"}`} role="status">
        {n}
        <span className="ml-3 text-4xl text-muted sm:text-5xl">/ {current.target}</span>
      </p>

      {sets.length > 1 && (
        <div className="flex gap-2" aria-hidden="true">
          {sets.map((_, i) => (
            <span
              key={i}
              className="h-3 rounded-full transition-all"
              style={{
                width: i === setIndex ? 28 : 12,
                background: counts[i] >= sets[i].target ? "#028A2C" : i === setIndex ? "#52409E" : "#CBC4E7",
              }}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        {done && !lastSet ? (
          <button type="button" onClick={nextSet} className={`${bigButton} bg-rccg-green-500 text-white`}>
            Next: {sets[setIndex + 1].label ?? "next set"} ›
          </button>
        ) : allDone ? (
          <p className="rounded-2xl bg-rccg-green-100 px-6 py-3 text-2xl font-bold text-rccg-green-700 sm:text-3xl">✓ Done! On to the next move</p>
        ) : (
          <button type="button" onClick={add} className={`${bigButton} bg-rccg-purple-700 px-14 text-white sm:px-20`}>
            +1
          </button>
        )}
        <button type="button" onClick={takeAway} disabled={n === 0} className="rounded-2xl bg-white px-5 py-3 text-lg font-semibold text-rccg-purple-700 shadow disabled:opacity-40">
          −1
        </button>
        <button type="button" onClick={restartSet} disabled={n === 0} className="rounded-2xl bg-white px-5 py-3 text-lg font-semibold text-rccg-purple-700 shadow disabled:opacity-40">
          Restart
        </button>
      </div>
      <SoundToggle on={sound} onChange={setSound} />
    </div>
  );
}

export default function WarmupTrackerView({ tracker }: { tracker: WarmupTracker }) {
  if (tracker.kind === "count") return <CounterView sets={tracker.sets} />;
  if (tracker.kind === "countdown") return <ClockView mode="down" seconds={tracker.seconds} holds={tracker.holds} />;
  return <ClockView mode="up" seconds={tracker.goalSeconds} />;
}
