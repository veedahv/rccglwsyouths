"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { subscribeOverlay } from "@/lib/games";
import { useRoundTimer } from "@/lib/useRoundTimer";
import { FinalResult, GameTag, QuizBoard, RoundView, ScoreStrip, TimerBadge } from "@/components/GameBoard";
import { EventTag, OverallBoard } from "@/components/EventScreens";
import { hasStarted, isEventOverlay } from "@/types/games";
import type { OverlayDoc } from "@/types/games";

// The graphics layer for OBS (add it as a Browser Source). It needs no
// sign-in: the long random key in the address is the private link, and the
// data behind it only ever holds what is on screen right now. The page
// background is transparent so it sits on top of the camera.
//
// A games event has one link for the whole day. It shows the event's title
// before the first game, then whichever game is on screen, then the overall
// standings or the final result when the admin switches to them.
//
// Options go on the address:
//   ?show=all (default) | round | timer | scores   what to draw
//   &position=bottom (default) | top | center      where it sits in the frame
//   &align=center (default) | left | right         tuck it into a corner
//   &size=large                                    a bigger card (default is compact)
//   &scale=1                                       scales everything (0.5 to 2)

type Show = "all" | "round" | "timer" | "scores";
type Position = "bottom" | "top" | "center";
type Align = "left" | "center" | "right";

interface Options {
  show: Show;
  position: Position;
  align: Align;
  large: boolean;
  scale: number;
}

const DEFAULTS: Options = { show: "all", position: "bottom", align: "center", large: false, scale: 1 };

function readOptions(search: string): Options {
  const q = new URLSearchParams(search);
  const show = q.get("show");
  const position = q.get("position");
  const align = q.get("align");
  const scale = Number(q.get("scale"));
  return {
    show: show === "round" || show === "timer" || show === "scores" ? show : "all",
    position: position === "top" || position === "center" ? position : "bottom",
    align: align === "left" || align === "right" ? align : "center",
    large: q.get("size") === "large",
    scale: Number.isFinite(scale) && scale >= 0.5 && scale <= 2 && scale !== 0 ? scale : 1,
  };
}

export default function OverlayPage() {
  const { key } = useParams<{ key: string }>();
  const [doc, setDoc] = useState<OverlayDoc | null>(null);
  const [error, setError] = useState(false);
  const [opts, setOpts] = useState<Options>(DEFAULTS);
  const event = doc && isEventOverlay(doc) ? doc : null;
  const session = doc && !isEventOverlay(doc) ? doc : null;
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
      (d) => {
        setDoc(d);
        setError(false);
      },
      () => setError(true)
    );
  }, [key]);

  const place =
    opts.position === "top" ? "top-0 justify-start" : opts.position === "center" ? "inset-y-0 justify-center" : "bottom-0 justify-end";
  const large = opts.large;
  const alignClass = opts.align === "left" ? "items-start" : opts.align === "right" ? "items-end" : "items-center";

  if (error) {
    return (
      <div className="fixed bottom-3 left-3 rounded-lg bg-black/70 px-3 py-1.5 text-sm text-white">
        Overlay can&rsquo;t connect. Check the link and that the Firestore rules are deployed.
      </div>
    );
  }
  if (!doc) return null;

  const showRound = opts.show === "all" || opts.show === "round";
  const showScores = opts.show === "all" || opts.show === "scores";

  // An event's own screens: the title tag before the first game, and the overall board.
  if (event) {
    if (!showRound) return null;
    return (
      <div className={`pointer-events-none fixed inset-x-0 flex flex-col gap-3 p-6 ${alignClass} ${place}`}>
        {event.view === "cover" ? (
          <EventTag title={event.title} subtitle={event.subtitle} large={large} />
        ) : (
          <div className={`w-full rounded-2xl bg-white/95 px-5 py-4 shadow-xl ${large ? "max-w-6xl" : "max-w-4xl"}`}>
            <OverallBoard summary={event.summary} large={large} final={event.view === "final"} />
          </div>
        )}
      </div>
    );
  }
  if (!session) return null;

  const finished = session.status === "finished";
  const round = session.currentRound >= 0 ? session.rounds[session.currentRound] : undefined;
  const onBoard = session.game === "board" && session.currentRound < 0;

  // Before the game starts: just a tag with the game's name, in the places that draw the round.
  if (!hasStarted(session) && !finished) {
    return (
      <div className={`pointer-events-none fixed inset-x-0 flex flex-col gap-3 p-6 ${alignClass} ${place}`}>
        {showRound && <GameTag game={session.game} large={large} />}
      </div>
    );
  }

  return (
    <div className={`pointer-events-none fixed inset-x-0 flex flex-col gap-3 p-6 ${alignClass} ${place}`}>
      {opts.show === "timer" && timer.enabled && !finished && round && <TimerBadge timer={timer} large inline />}

      {showRound && (finished || onBoard || round) && (
        <div className={`w-full rounded-2xl bg-white/95 px-5 py-4 shadow-xl ${large ? "max-w-6xl" : onBoard ? "max-w-4xl" : "max-w-3xl"}`}>
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
