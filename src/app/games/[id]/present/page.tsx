"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { subscribeSession, turnSide } from "@/lib/games";
import { useRoundTimer } from "@/lib/useRoundTimer";
import RequireAuth from "@/components/RequireAuth";
import HowToPlay from "@/components/HowToPlay";
import CoupleGrid from "@/components/CoupleGrid";
import { GameTag, QuizBoard, RoundView, Scoreboard } from "@/components/GameBoard";
import { GameResult } from "@/components/ResultCard";
import PresentFrame from "@/components/PresentFrame";
import { Loading, Notice } from "@/components/ui";
import { GAME_LABEL, hasStarted } from "@/types/games";
import type { GameSession } from "@/types/games";

// A big-screen view for a projector or TV. It only listens: the admin runs
// the game from /games/[id] and this screen follows along live. It sits on
// top of the app's sidebar so nothing but the game is visible.
function PresentInner() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeSession(
      id,
      (s) => {
        setSession(s);
        setLoading(false);
      },
      () => {
        setError("Couldn't load this session.");
        setLoading(false);
      }
    );
  }, [id]);

  const timer = useRoundTimer(session);
  const round = session && session.currentRound >= 0 ? session.rounds[session.currentRound] : undefined;
  const onBoard = session?.game === "board" && session.currentRound < 0;

  return (
    <PresentFrame
      title={session?.title ?? "Game"}
      subtitle={session ? GAME_LABEL[session.game] : undefined}
      exitHref={session ? `/games/${session.id}` : "/games"}
    >
      {loading ? (
        <Loading />
      ) : error || !session ? (
        <Notice tone="error">{error ?? "This session was not found."}</Notice>
      ) : session.status === "finished" ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-4xl">
            <GameResult session={session} large />
          </div>
        </div>
      ) : !hasStarted(session) ? (
        // Not started: only the game's name. The first question follows once the admin starts the game.
        <div className="flex flex-1 flex-col items-center justify-center gap-8">
          <GameTag game={session.game} large />
          <HowToPlay session={session} large />
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-between gap-8">
          <div className="flex flex-1 items-center justify-center">
            {session.game === "spouses" ? (
              <div className="w-full">
                <CoupleGrid session={session} large />
              </div>
            ) : onBoard ? (
              <div className="w-full">
                <QuizBoard session={session} large />
              </div>
            ) : (
              round && (
                <RoundView
                  session={session}
                  round={round}
                  large
                  showAnswer={session.revealed}
                  timer={timer}
                  hold={session.game === "relay" && !session.called}
                />
              )
            )}
          </div>
          <Scoreboard session={session} large pickerId={turnSide(session)?.id} pickerLabel={onBoard ? "Picks next" : "Their turn"} />
        </div>
      )}
    </PresentFrame>
  );
}

export default function GamePresentPage() {
  return (
    <RequireAuth>
      <PresentInner />
    </RequireAuth>
  );
}
