"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { subscribeSession, turnSide } from "@/lib/games";
import { useRoundTimer } from "@/lib/useRoundTimer";
import RequireAuth from "@/components/RequireAuth";
import HowToPlay from "@/components/HowToPlay";
import { FinalResult, GameTag, QuizBoard, RoundView, Scoreboard } from "@/components/GameBoard";
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-mist">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col px-6 py-6 sm:px-10">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-bold text-rccg-purple-800 sm:text-3xl">
              {session?.title ?? "Game"}
            </p>
            {session && <p className="text-sm text-muted">{GAME_LABEL[session.game]}</p>}
          </div>
          <Link href={session ? `/games/${session.id}` : "/games"} className="btn-ghost shrink-0 !text-muted">
            Exit
          </Link>
        </header>

        {loading ? (
          <Loading />
        ) : error || !session ? (
          <Notice tone="error">{error ?? "This session was not found."}</Notice>
        ) : session.status === "finished" ? (
          <div className="flex flex-1 items-center justify-center">
            <FinalResult session={session} large />
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
              {onBoard ? (
                <div className="w-full">
                  <QuizBoard session={session} large />
                </div>
              ) : (
                round && <RoundView session={session} round={round} large showAnswer={session.revealed} timer={timer} />
              )}
            </div>
            <Scoreboard session={session} large pickerId={turnSide(session)?.id} pickerLabel={onBoard ? "Picks next" : "Their turn"} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function GamePresentPage() {
  return (
    <RequireAuth>
      <PresentInner />
    </RequireAuth>
  );
}
