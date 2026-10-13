"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { subscribeSession, updateSession, whoAmIPoints } from "@/lib/games";
import { useRoundTimer } from "@/lib/useRoundTimer";
import { useAuth } from "@/lib/useAuth";
import RequireAuth from "@/components/RequireAuth";
import { FinalResult, QuizBoard, RoundView, Scoreboard } from "@/components/GameBoard";
import { Page, PageHeader, Card, Badge, Loading, Notice, EmptyState } from "@/components/ui";
import { GAME_LABEL, MODE_LABEL, gameHasHints } from "@/types/games";
import type { GameSession } from "@/types/games";

const POINT_OPTIONS = [1, 2, 3, 5];

function RunInner() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const canControl = hasPermission("canEditEvents");

  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pointValue, setPointValue] = useState(1);
  const [takeAway, setTakeAway] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRoundTimer(session);

  useEffect(() => {
    const unsub = subscribeSession(
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
    return unsub;
  }, [id]);

  async function run(data: Partial<Omit<GameSession, "id">>) {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await updateSession(session.id, data);
    } catch {
      setError("That change didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  // Timer changes. Each one bumps timerSeq so every screen restarts its own
  // countdown from the new value (see useRoundTimer).
  function timerFields(state: "idle" | "running" | "paused", remaining: number) {
    return { timerState: state, timerRemaining: Math.round(remaining * 10) / 10, timerSeq: (session?.timerSeq ?? 0) + 1 };
  }
  function startTimer() {
    // Starting after time ran out begins a fresh countdown.
    const from = timer.remaining > 0 ? timer.remaining : timer.total;
    run(timerFields("running", from));
  }
  function pauseTimer() {
    run(timerFields("paused", timer.remaining));
  }
  function resetTimer() {
    run(timerFields("idle", timer.total));
  }
  /** Fields that stop a running timer, to merge into another change (awarding points, revealing). */
  function pauseIfRunning() {
    return timer.state === "running" ? timerFields("paused", timer.remaining) : {};
  }

  if (loading) {
    return (
      <Page>
        <Loading />
      </Page>
    );
  }
  if (!session) {
    return (
      <Page size="sm">
        <EmptyState
          title="Session not found"
          description={error ?? "It may have been deleted."}
          action={
            <Link href="/games" className="btn-secondary">
              Back to games
            </Link>
          }
        />
      </Page>
    );
  }

  const isBoard = session.game === "board";
  // On a quiz board, currentRound -1 means the board itself is showing.
  const onBoard = isBoard && session.currentRound < 0;
  const round = session.currentRound >= 0 ? session.rounds[session.currentRound] : undefined;
  const isLast = session.currentRound >= session.rounds.length - 1;
  const finished = session.status === "finished";
  const awarded = round?.awards ?? {};
  const allPlayed = isBoard && session.rounds.every((r) => r.played);
  const pickerId = isBoard ? session.sides[session.turnIndex ?? 0]?.id : undefined;

  // Quiz board tiles and Who Am I? rounds are worth a fixed number of points,
  // so the admin doesn't choose; every other game uses the Points setting.
  const autoPoints: number | null = !round
    ? null
    : session.game === "board"
      ? round.value ?? 0
      : session.game === "whoAmI"
        ? whoAmIPoints(session, round)
        : null;

  function award(sideId: string) {
    if (!session || !round || finished) return;
    const current = round.awards[sideId] ?? 0;
    let next: number;
    if (autoPoints !== null) {
      // One winner per tile or round: tapping sets this side's award rather than adding to it.
      // Take away: a wrong answer on the board loses the tile's points; in Who Am I? it just undoes the award.
      next = takeAway ? (session.game === "board" ? -autoPoints : 0) : autoPoints;
    } else {
      next = takeAway ? Math.max(0, current - pointValue) : current + pointValue;
    }
    const rounds = session.rounds.map((r, i) =>
      i === session.currentRound ? { ...r, awards: { ...r.awards, [sideId]: next } } : r
    );
    // Awarding points means the answer was given, so show it on the big screen too.
    // (A penalty on the board doesn't reveal the answer: others can still try.)
    const penalty = takeAway;
    run({ rounds, revealed: penalty ? session.revealed : true, ...(penalty ? {} : pauseIfRunning()) });
  }

  function clearRoundPoints() {
    if (!session) return;
    const rounds = session.rounds.map((r, i) => (i === session.currentRound ? { ...r, awards: {} } : r));
    run({ rounds });
  }

  function goTo(index: number) {
    run({
      currentRound: Math.min(Math.max(index, 0), session!.rounds.length - 1),
      revealed: false,
      // Who Am I? starts every round with its first clue showing.
      ...(session!.game === "whoAmI" ? { cluesShown: 1 } : {}),
      // Moving to another round starts its countdown straight away.
      ...timerFields(timer.enabled ? "running" : "idle", timer.total),
    });
  }

  function revealNextClue() {
    if (!session || !round) return;
    const total = round.clues?.length ?? 0;
    run({ cluesShown: Math.min(total, (session.cluesShown ?? 1) + 1) });
  }

  /** Quiz board: open a tile. Its countdown starts straight away. */
  function pickTile(index: number) {
    run({ currentRound: index, revealed: false, ...timerFields(timer.enabled ? "running" : "idle", timer.total) });
  }

  /** Quiz board: close the tile (it is marked as played) and hand the pick to the next side. */
  function backToBoard() {
    if (!session) return;
    const rounds = session.rounds.map((r, i) => (i === session.currentRound ? { ...r, played: true } : r));
    run({
      rounds,
      currentRound: -1,
      revealed: false,
      turnIndex: ((session.turnIndex ?? 0) + 1) % Math.max(session.sides.length, 1),
      ...timerFields("idle", timer.total),
    });
  }

  function setPicker(sideId: string) {
    if (!session) return;
    const index = session.sides.findIndex((side) => side.id === sideId);
    if (index >= 0) run({ turnIndex: index });
  }

  function finish() {
    run({ status: "finished", finishedAt: new Date().toISOString(), revealed: true });
  }

  const hasAwards = Object.values(awarded).some((n) => n !== 0);

  return (
    <Page size="lg">
      <PageHeader
        backHref="/games"
        backLabel="All games"
        title={session.title}
        description={`${GAME_LABEL[session.game]} · ${MODE_LABEL[session.mode]}`}
        actions={
          <>
            <Badge tone={finished ? "gray" : "green"} dot={!finished}>
              {finished ? "Finished" : "Live"}
            </Badge>
            <Link href={`/games/${session.id}/present`} target="_blank" className="btn-secondary">
              Open big-screen view
            </Link>
          </>
        }
      />

      {error && (
        <Notice tone="error" className="mb-4">
          {error}
        </Notice>
      )}
      {!canControl && (
        <Notice tone="info" className="mb-4">
          You can watch this session, but only excos who manage events can run it.
        </Notice>
      )}

      {finished ? (
        <Card>
          <FinalResult session={session} />
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {canControl && (
              <button disabled={busy} onClick={() => run({ status: "live" })} className="btn-secondary">
                Reopen session
              </button>
            )}
            <Link href="/games" className="btn-primary">
              Back to games
            </Link>
          </div>
        </Card>
      ) : onBoard ? (
        <div className="space-y-5">
          <Card
            title="Pick a tile"
            description={
              canControl
                ? "Tap a tile to open its clue. The countdown starts as soon as it opens, and the tile is used up when you go back to the board."
                : undefined
            }
          >
            <QuizBoard session={session} onPick={canControl && !busy ? pickTile : undefined} />
          </Card>
          <Card
            title="Scoreboard"
            description={canControl ? "Tap a side to change whose turn it is to pick." : undefined}
          >
            <Scoreboard session={session} pickerId={pickerId} onSideClick={canControl && !busy ? setPicker : undefined} />
          </Card>
          {canControl && (
            <div className="flex justify-end">
              <button disabled={busy} onClick={finish} className={allPlayed ? "btn-primary" : "btn-ghost-danger"}>
                {allPlayed ? "Finish game" : "End the game now"}
              </button>
            </div>
          )}
        </div>
      ) : !round ? (
        <EmptyState title="This session has no rounds" />
      ) : (
        <div className="space-y-5">
          <Card>
            <RoundView session={session} round={round} showAnswer={session.revealed} timer={timer} />

            {canControl && (
              <div className="mt-5 space-y-3 border-t border-line pt-4">
                {!session.revealed && (
                  <p className="text-center text-sm text-muted">
                    Answer (only you see this until you reveal it):{" "}
                    <span className="font-semibold text-ink">
                      {session.game === "scramble"
                        ? round.answer.toUpperCase()
                        : session.game === "bibleOrCap"
                          ? round.answer === "Cap"
                            ? "Cap"
                            : "Scripture"
                          : round.answer}
                    </span>
                    {(session.game === "bibleOrCap" && round.answer === "Cap" ? round.explanation : round.reference) && (
                      <span className="text-muted"> · {session.game === "bibleOrCap" && round.answer === "Cap" ? round.explanation : round.reference}</span>
                    )}
                  </p>
                )}
                {gameHasHints(session.game) && round.hint && session.showHints === false && (
                  <p className="text-center text-sm text-muted">
                    Hint (hidden from the screen): <span className="text-ink">{round.hint}</span>
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {!isBoard && (
                    <button disabled={busy || session.currentRound === 0} onClick={() => goTo(session.currentRound - 1)} className="btn-secondary">
                      Previous
                    </button>
                  )}
                  {session.game === "whoAmI" && (
                    <button
                      disabled={busy || (session.cluesShown ?? 1) >= (round.clues?.length ?? 0)}
                      onClick={revealNextClue}
                      className="btn-primary"
                    >
                      Reveal next clue ({Math.min(session.cluesShown ?? 1, round.clues?.length ?? 1)} of {round.clues?.length ?? 0})
                    </button>
                  )}
                  <button disabled={busy} onClick={() => run({ revealed: !session.revealed, ...(session.revealed ? {} : pauseIfRunning()) })} className="btn-secondary">
                    {session.revealed ? "Hide answer" : "Reveal answer"}
                  </button>
                  {isBoard ? (
                    <button disabled={busy} onClick={backToBoard} className="btn-primary">
                      Back to the board
                    </button>
                  ) : isLast ? (
                    <button disabled={busy} onClick={finish} className="btn-primary">
                      Finish game
                    </button>
                  ) : (
                    <button disabled={busy} onClick={() => goTo(session.currentRound + 1)} className={session.game === "whoAmI" ? "btn-secondary" : "btn-primary"}>
                      Next round
                    </button>
                  )}
                </div>
                {(timer.enabled || (gameHasHints(session.game) && round.hint)) && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {timer.enabled &&
                      (timer.state === "running" && timer.remaining > 0 ? (
                        <button disabled={busy} onClick={pauseTimer} className="btn-secondary btn-sm">
                          Pause timer
                        </button>
                      ) : (
                        <button disabled={busy} onClick={startTimer} className="btn-secondary btn-sm">
                          {timer.state === "paused" ? "Resume timer" : "Start timer"}
                        </button>
                      ))}
                    {timer.enabled && timer.state !== "idle" && (
                      <button disabled={busy} onClick={resetTimer} className="btn-ghost btn-sm">
                        Reset timer
                      </button>
                    )}
                    {gameHasHints(session.game) && round.hint && (
                      <button disabled={busy} onClick={() => run({ showHints: session.showHints === false })} className="btn-ghost btn-sm">
                        {session.showHints === false ? "Show hints on screen" : "Hide hints"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card
            title="Scoreboard"
            description={canControl ? "Tap a side to give it points. Awarding points also reveals the answer." : undefined}
            action={
              canControl && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {autoPoints !== null ? (
                    <span className="text-muted">
                      {isBoard ? `This tile is worth ${autoPoints}` : `Worth ${autoPoints} right now`}
                    </span>
                  ) : (
                    <label className="flex items-center gap-1.5">
                      <span className="text-muted">Points</span>
                      <select value={pointValue} onChange={(e) => setPointValue(Number(e.target.value))} className="input w-16 py-1">
                        {POINT_OPTIONS.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input type="checkbox" checked={takeAway} onChange={(e) => setTakeAway(e.target.checked)} className="accent-rccg-red-600" />
                    <span className={takeAway ? "font-medium text-rccg-red-600" : "text-muted"}>{isBoard ? "Wrong answer (lose points)" : "Take away"}</span>
                  </label>
                </div>
              )
            }
          >
            <Scoreboard session={session} onSideClick={canControl && !busy ? award : undefined} awardedThisRound={awarded} pickerId={pickerId} />
            {canControl && hasAwards && (
              <button disabled={busy} onClick={clearRoundPoints} className="btn-ghost-danger mt-3">
                Clear this round's points
              </button>
            )}
          </Card>

          {canControl && (
            <div className="flex justify-end">
              <button disabled={busy} onClick={finish} className="btn-ghost-danger">
                End the game now
              </button>
            </div>
          )}
        </div>
      )}
    </Page>
  );
}

export default function GameRunPage() {
  return (
    <RequireAuth>
      <RunInner />
    </RequireAuth>
  );
}
