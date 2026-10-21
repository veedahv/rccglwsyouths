"use client";

import { useCallback, useEffect, useState } from "react";

/** Fullscreen on and off for the whole page. Also bound to the F key. */
export function useFullscreen() {
  const [on, setOn] = useState(false);
  const [supported, setSupported] = useState(false);

  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Some browsers refuse (for example inside a frame). Nothing to do.
    }
  }, []);

  useEffect(() => {
    setSupported(!!document.fullscreenEnabled);
    const sync = () => setOn(!!document.fullscreenElement);
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "f") toggle();
    };
    document.addEventListener("fullscreenchange", sync);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      window.removeEventListener("keydown", key);
    };
  }, [toggle]);

  return { on, supported, toggle };
}

export default function FullscreenButton({ tone = "light", className = "" }: { tone?: "light" | "dark"; className?: string }) {
  const { on, supported, toggle } = useFullscreen();
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={toggle}
      title={on ? "Exit fullscreen (F)" : "Fullscreen (F)"}
      aria-label={on ? "Exit fullscreen" : "Enter fullscreen"}
      className={`rounded-lg p-2 transition ${tone === "light" ? "text-white/60 hover:bg-white/10 hover:text-white" : "text-white/40 hover:text-white"} ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {on ? (
          <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
        ) : (
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        )}
      </svg>
    </button>
  );
}
