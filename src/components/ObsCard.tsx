"use client";

import { useState } from "react";
import { Card } from "@/components/ui";

const OVERLAY_LINKS = [
  { label: "All in one", hint: "Round card, timer and scores together.", query: "" },
  { label: "Round card only", hint: "The question or board. The timer sits in its corner.", query: "?show=round" },
  { label: "Scores only", hint: "A slim row of score pills.", query: "?show=scores" },
  { label: "Timer only", hint: "Just the countdown, to place anywhere.", query: "?show=timer" },
];

/** Links and instructions for putting a game, or a whole games event, on video in OBS. */
export default function ObsCard({
  overlayKey,
  busy,
  onSync,
  subject = "this game",
  deleteNote = "Deleting the session turns its links off.",
}: {
  overlayKey?: string;
  busy: boolean;
  onSync: () => void;
  subject?: string;
  deleteNote?: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const base = overlayKey && typeof window !== "undefined" ? `${window.location.origin}/overlay/${overlayKey}` : null;

  async function copy(label: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 2000);
    } catch {
      // Clipboard can be blocked; the link is selectable in the box.
    }
  }

  return (
    <Card
      title="Record or stream with OBS"
      description={`Private links that show ${subject} on your video. They need no sign-in, and they only ever show what is on screen right now.`}
      className="mt-6"
    >
      {!base ? (
        <div className="space-y-2">
          <p className="text-sm text-muted">This one was created before overlays existed. Create its overlay link to use it in OBS.</p>
          <button disabled={busy} onClick={onSync} className="btn-secondary">
            Create overlay link
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="space-y-3">
            {OVERLAY_LINKS.map(({ label, hint, query }) => {
              const url = base + query;
              return (
                <li key={label}>
                  <p className="text-sm font-medium">
                    {label} <span className="font-normal text-muted">· {hint}</span>
                  </p>
                  <div className="mt-1 flex gap-2">
                    <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label={`${label} link`} className="input font-mono text-xs" />
                    <button type="button" onClick={() => copy(label, url)} className="btn-secondary shrink-0">
                      {copied === label ? "Copied" : "Copy"}
                    </button>
                    <a href={url} target="_blank" rel="noreferrer" className="btn-ghost shrink-0">
                      Preview
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>

          <details className="rounded-lg border border-line bg-white p-3 text-sm">
            <summary className="cursor-pointer font-medium">How to set it up in OBS</summary>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted">
              <li>In OBS, add a source: <span className="text-ink">Browser</span>. Paste a link above.</li>
              <li>Set Width to <span className="text-ink">1920</span> and Height to <span className="text-ink">1080</span>. Leave the custom CSS as it is.</li>
              <li>Untick <span className="text-ink">Shutdown source when not visible</span> and <span className="text-ink">Refresh browser when scene becomes active</span> so it stays live between scenes.</li>
              <li>Put it above your camera in the scene. The page is transparent, so only the card and scores show.</li>
              <li>Run the game from the control page on your phone or another device. The overlay follows every tap within a moment.</li>
            </ol>
            <p className="mt-3 text-muted">
              Add <code>&amp;position=top</code> or <code>&amp;position=center</code> to move it up, <code>&amp;align=left</code> or{" "}
              <code>&amp;align=right</code> to tuck it into a corner, <code>&amp;size=large</code> for a bigger card, or{" "}
              <code>&amp;scale=0.8</code> to shrink everything. If your camera lags behind the graphics (phone webcams often do),
              add a <span className="text-ink">Render Delay</span> filter to the overlay source and match the delay.
            </p>
          </details>

          <div className="flex flex-wrap items-center gap-2">
            <button disabled={busy} onClick={onSync} className="btn-ghost btn-sm">
              Resync overlay
            </button>
            <p className="text-xs text-muted">Anyone with a link can see what is on screen, so keep it to yourself. {deleteNote}</p>
          </div>
        </div>
      )}
    </Card>
  );
}
