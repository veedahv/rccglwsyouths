"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { subscribeOverlay } from "@/lib/games";
import { useRoundTimer } from "@/lib/useRoundTimer";
import { FinalResult, QuizBoard, RoundView, ScoreStrip, TimerBadge } from "@/components/GameBoard";
import type { GameSession } from "@/types/games";

// The graphics layer for OBS (add it as a Browser Source). It needs no
// sign-in: the long random key in the address is the private link, and the
// data behind it only ever holds what is on screen right now. The page
// background is transparent so it sits on top of the camera.
//
// Options go on the address:
//   ?show=all (default) | round | timer | scores   what to draw
//   &position=bottom (default) | top | center      where it sits in the frame
//   &size=large (default) | compact                a smaller card
//   &scale=1                                       scales everything (0.5 to 2)

type Show = "all" | "round" | "timer" | "scores";
type Position = "bottom" | "top" | "center";

interface Options {
  show: Show;
  position: Position;
  compact: boolean;
  scale: number;
}

const DEFAULTS: Options = { show: "all", position: "bottom", compact: false, scale: 1 };

function readOptions(search: string): Options {
  const q = new URLSearchParams(search);
  const show = q.get("show");
  const position = q.get("position");
  const scale = Number(q.get("scale"));
  return {
    show: show === "round" || show === "timer" || show === "scores" ? show : "all",
    position: position === "top" || position === "center" ? position : "bottom",
    compact: q.get("size") === "compact",
    scale: Number.isFinite(scale) && scale >= 0.5 && scale <= 2 && scale !== 0 ? scale : 1,
  };
}

export default function OverlayPage() {
  const { key } = useParams<{ key: string }>();
  const [session, setSession] = useState<GameSession | null>(null);
  const [error, setError] = useState(false);
  const [opts, setOpts] = useState<Options>(DEFAULTS);
  const timer = useRoundTimer(session);

  useEffect(() => {
    setOpts(readOptions(window.location.search));
  }, []);

  // Transparent page, and a root font size that scales every rem-based size.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const before = { html: html.style.background, body: body.style.background, size: html.style.fontSize };
    html.style.background = "transparent";
    body.style.background = "transparent";
    html.style.fontSize = `${16 * opts.scale}px`;
    return () => {
      html.style.background = before.html;
      body.style.background = before.body;
      html.style.fontSize = before.size;
    };
  }, [opts.scale]);

  useEffect(() => {
    return subscribeOverlay(
      key,
      (s) => {
        setSession(s);
        setError(false);
      },
      () => setError(true)
    );
  }, [key]);

  const place =
    opts.position === "top" ? "top-0 justify-start" : opts.position === "center" ? "inset-y-0 justify-center" : "bottom-0 justify-end";
  const large = !opts.compact;

  if (error) {
    return (
      <div className="fixed bottom-3 left-3 rounded-lg bg-black/70 px-3 py-1.5 text-sm text-white">
        Overlay can&rsquo;t connect. Check the link and that the Firestore rules are deployed.
      </div>
    );
  }
  if (!session) return null;

  const finished = session.status === "finished";
  const round = session.currentRound >= 0 ? session.rounds[session.currentRound] : undefined;
  const onBoard = session.game === "board" && session.currentRound < 0;

  const showRound = opts.show === "all" || opts.show === "round";
  const showScores = opts.show === "all" || opts.show === "scores";

  return (
    <div className={`pointer-events-none fixed inset-x-0 flex flex-col items-center gap-4 p-8 ${place}`}>
      {opts.show === "timer" && timer.enabled && !finished && round && <TimerBadge timer={timer} large inline />}

      {showRound && (finished || onBoard || round) && (
        <div className="w-full max-w-6xl rounded-3xl bg-white/95 px-8 py-6 shadow-2xl">
          {finished ? (
            <FinalResult session={session} large={large} />
          ) : onBoard ? (
            <QuizBoard session={session} large={large} />
          ) : (
            round && <RoundView session={session} round={round} large={large} showAnswer={session.revealed} timer={timer} />
          )}
        </div>
      )}

      {showScores && <ScoreStrip session={session} large={large} />}
    </div>
  );
}
