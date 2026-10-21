"use client";

import { useEffect, useRef, useState } from "react";
import { listChoices, normalize, slotViews } from "@/lib/teasers";
import type { TeaserFlash, TeaserRun } from "@/types/teasers";

/**
 * Reacts to each pick: returns the latest "dup" or "miss" message for a couple of
 * seconds, with its sequence number so a screen can restart a shake. The first
 * snapshot is ignored, so opening a screen mid-game doesn't shake it.
 */
export function useFlash(run: TeaserRun | null): TeaserFlash | null {
  const seen = useRef<number | null>(null);
  const [flash, setFlash] = useState<TeaserFlash | null>(null);
  const seq = run?.flash?.seq;

  useEffect(() => {
    if (!run) return;
    if (seen.current === null) {
      seen.current = seq ?? 0;
      return;
    }
    if (run.flash && run.flash.seq !== seen.current) {
      seen.current = run.flash.seq;
      setFlash(run.flash);
      const t = setTimeout(() => setFlash(null), 2500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq]);

  return flash;
}

/** The numbered slots. Empty ones are blank, named ones are green, and missed ones are shown once the game is over. */
export function TeaserSlots({
  run,
  ended,
  large,
  flash,
  onWho,
}: {
  run: TeaserRun;
  ended: boolean;
  large?: boolean;
  flash: TeaserFlash | null;
  /** Host only: record who named a slot. */
  onWho?: (index: number, who: string) => void;
}) {
  const views = slotViews(run, ended);
  const shake = flash && flash.kind === "miss";
  const cols = views.length > 8 ? "sm:grid-cols-3" : views.length > 4 ? "sm:grid-cols-2" : "sm:grid-cols-1";
  return (
    <ol key={shake ? flash.seq : "still"} className={`grid grid-cols-1 gap-3 ${cols} ${shake ? "animate-shake" : ""}`}>
      {views.map((v) => (
        <li
          key={v.n}
          className={[
            "flex items-center gap-4 rounded-2xl border-2 px-4",
            large ? "min-h-[5.5rem] py-3" : "min-h-[3.5rem] py-2",
            v.state === "named"
              ? "border-rccg-green-500 bg-rccg-green-50"
              : v.state === "missed"
                ? "border-rccg-red-100 bg-rccg-red-50"
                : "border-line bg-white",
            shake ? "!border-rccg-red-600" : "",
          ].join(" ")}
        >
          <span className={`num shrink-0 font-display font-bold text-rccg-purple-500 ${large ? "text-4xl" : "text-xl"}`}>{String(v.n).padStart(2, "0")}</span>
          {v.state === "empty" ? (
            <span className="h-1 flex-1 rounded-full bg-line" aria-label="Not named yet" />
          ) : (
            <span className="min-w-0 flex-1">
              <span
                className={[
                  "block truncate font-display font-bold",
                  v.state === "named" ? "text-rccg-green-700" : "text-rccg-red-700",
                  large ? "text-4xl" : "text-lg",
                ].join(" ")}
              >
                {v.text}
              </span>
              {v.state === "named" && v.by && !onWho && <span className={`block truncate text-muted ${large ? "text-xl" : "text-xs"}`}>{v.by}</span>}
              {v.state === "missed" && <span className={`block text-rccg-red-600 ${large ? "text-lg" : "text-xs"}`}>Not named</span>}
            </span>
          )}
          {onWho && v.state === "named" && (
            <input
              defaultValue={v.by}
              onBlur={(e) => e.target.value.trim() !== v.by && onWho(v.n - 1, e.target.value.trim())}
              placeholder="Who got it? (optional)"
              aria-label={`Who named ${v.text}`}
              className="input w-48 py-1 text-sm"
            />
          )}
        </li>
      ))}
    </ol>
  );
}

/** The host's picker for a list of answers: tap one, or type it and press Enter. */
export function ListPicker({
  run,
  onPick,
  disabled,
}: {
  run: TeaserRun;
  onPick: (text: string) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const named = new Set(run.slots.map((s) => s.answer).filter(Boolean));
  const choices = listChoices(run);
  const q = normalize(text);
  const shown = q ? choices.filter((c) => normalize(c).includes(q)) : choices;

  return (
    <div className="space-y-3">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && text.trim()) {
            e.preventDefault();
            // Typing an answer is matched against the answers and their aliases.
            onPick(text.trim());
            setText("");
          }
        }}
        placeholder="Type an answer and press Enter, or tap one below…"
        aria-label="Type an answer"
        className="input py-1.5"
        disabled={disabled}
      />
      <div className="flex flex-wrap gap-1.5">
        {shown.map((c) => (
          <button
            key={c}
            type="button"
            disabled={disabled}
            onClick={() => onPick(c)}
            className={[
              "rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
              named.has(c) ? "border-line bg-gray-100 text-muted line-through" : "border-line bg-white hover:border-rccg-purple-300 hover:bg-rccg-purple-50",
            ].join(" ")}
          >
            {c}
          </button>
        ))}
        {shown.length === 0 && <p className="text-sm text-muted">Nothing on the list matches. Press Enter to try it as an answer.</p>}
      </div>
    </div>
  );
}
