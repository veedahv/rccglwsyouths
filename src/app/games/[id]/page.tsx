"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { canPass, isTurnBased, saveSessionChange, startedByName, subscribeSession, syncOverlay, turnMultiplier, turnSide, whoAmIPoints } from "@/lib/games";
import { setEventView, subscribeEvent, writeEventOverlay } from "@/lib/gameEvents";
import { listExcos } from "@/lib/excos";
import { useRoundTimer } from "@/lib/useRoundTimer";
import { useAuth } from "@/lib/useAuth";
import RequireAuth from "@/components/RequireAuth";
import { FinalResult, GameTag, QuizBoard, RoundView, Scoreboard } from "@/components/GameBoard";
import ObsCard from "@/components/ObsCard";
import HowToPlay from "@/components/HowToPlay";
import { Page, PageHeader, Card, Badge, Loading, Notice, EmptyState } from "@/components/ui";
import { GAME_LABEL, MODE_LABEL, gameHasHints, hasStarted } from "@/types/games";
import type { GameEvent, GameSession } from "@/types/games";
import type { ExcoMember } from "@/types";

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
  const [overlayProblem, setOverlayProblem] = useState(false);
  const [excos, setExcos] = useState<ExcoMember[]>([]);
  // The games event this game belongs to, if any. Its screen and overlay are shared by every game in it.
  const [event, setEvent] = useState<GameEvent | null>(null);
  const eventId = session?.eventId;
  const timer = useRoundTimer(session);

  useEffect(() => {
    if (!eventId) return setEvent(null);
    return subscribeEvent(eventId, setEvent, () => setEvent(null));
  }, [eventId]);

  // Only sessions made before names were saved need the excos list to show who started them.
  const needsName = !!session && !session.createdByName;
  useEffect(() => {
    if (!needsName) return;
    listExcos()
      .then(setExcos)
      .catch(() => {});
  }, [needsName]);

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
      const { overlayOk } = await saveSessionChange(session, data);
      setOverlayProblem(!overlayOk);
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

  async function handleSyncOverlay() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await syncOverlay(session);
      setOverlayProblem(false);
    } catch {
      setOverlayProblem(true);
      setError("Couldn't update the overlay. Check that the new Firestore rules are deployed.");
    } finally {
      setBusy(false);
    }
  }

  async function showOnEventScreen() {
    if (!session || !event) return;
    setBusy(true);
    setError(null);
    try {
      const { overlayOk } = await setEventView(event, "game", session.id);
      setOverlayProblem(!overlayOk);
    } catch {
      setError("Couldn't change the screen. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncEventOverlay() {
    if (!event) return;
    setBusy(true);
    setError(null);
    try {
      const { overlayOk } = await writeEventOverlay(event);
      setOverlayProblem(!overlayOk);
    } finally {
      setBusy(false);
    }
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
  const started = hasStarted(session);
  const awarded = round?.awards ?? {};
  const allPlayed = isBoard && session.rounds.every((r) => r.played);
  const turns = isTurnBased(session);
  const turnNow = turnSide(session);
  const sideCount = Math.max(session.sides.length, 1);
  const pickerId = turnNow?.id;

  // Quiz board tiles and Who Am I? rounds are worth a fixed number of points,
  // so the admin doesn't choose; every other game uses the Points setting.
  const autoPoints: number | null = !round
    ? null
    : session.game === "board"
      ? round.value ?? 0
      : session.game === "whoAmI"
        ? whoAmIPoints(session, round)
        : null;

  // Turn by turn: a question is worth full points to the side it started with, and half once passed on.
  const basePoints = autoPoints ?? pointValue;
  const turnPoints = basePoints * turnMultiplier(session);
  const shownAuto = autoPoints === null ? null : autoPoints * (turns ? turnMultiplier(session) : 1);
  const passTo = session.sides[((session.turnIndex ?? 0) + 1) % sideCount];

  /** The side whose turn it is got it right. */
  function turnCorrect() {
    if (!session || !round || !turnNow || finished) return;
    const rounds = session.rounds.map((r, i) =>
      i === session.currentRound ? { ...r, awards: { ...r.awards, [turnNow.id]: turnPoints } } : r
    );
    run({ rounds, revealed: true, ...pauseIfRunning() });
  }

  /** They missed: hand the question to the next side for half points, with a fresh countdown. */
  function turnPass() {
    if (!session) return;
    run({
      turnIndex: ((session.turnIndex ?? 0) + 1) % sideCount,
      passes: (session.passes ?? 0) + 1,
      ...timerFields(timer.enabled ? "running" : "idle", timer.total),
    });
  }

  /** They missed and nobody else gets a go: show the answer and award nothing. */
  function turnNobody() {
    run({ revealed: true, ...pauseIfRunning() });
  }

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
    // Turn by turn: hide the answer again so the turn buttons come back.
    run({ rounds, ...(turns ? { revealed: false } : {}) });
  }

  function goTo(index: number) {
    // Turn by turn: each round starts with the next side along (or the one before, going back).
    let turnFields = {};
    if (turns && !isBoard) {
      const step = index > session!.currentRound ? 1 : -1;
      const start = (((session!.turnStart ?? 0) + step) % sideCount + sideCount) % sideCount;
      turnFields = { turnStart: start, turnIndex: start, passes: 0 };
    }
    run({
      ...turnFields,
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
    run({
      currentRound: index,
      revealed: false,
      // Turn by turn: the side that picked the tile gets the first go at it.
      ...(turns ? { turnStart: session?.turnIndex ?? 0, passes: 0 } : {}),
      ...timerFields(timer.enabled ? "running" : "idle", timer.total),
    });
  }

  /** Quiz board: close the tile (it is marked as played) and hand the pick to the next side. */
  function backToBoard() {
    if (!session) return;
    const rounds = session.rounds.map((r, i) => (i === session.currentRound ? { ...r, played: true } : r));
    // Turn by turn: the pick moves on from whoever picked this tile, even if it was passed to someone else.
    const from = turns ? session.turnStart ?? session.turnIndex ?? 0 : session.turnIndex ?? 0;
    const next = (from + 1) % sideCount;
    run({
      rounds,
      currentRound: -1,
      revealed: false,
      turnIndex: next,
      ...(turns ? { turnStart: next, passes: 0 } : {}),
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

  /**
   * Starting the game puts the first question (or, on a quiz board, the board)
   * on the big screen and the overlay. The countdown starts with it, the same
   * as when moving on to the next round.
   */
  function startGame() {
    run({ started: true, ...timerFields(!isBoard && timer.enabled ? "running" : "idle", timer.total) });
  }

  const onEventScreen = !!event && event.view === "game" && event.activeSessionId === session.id;
  const backHref = session.eventId ? `/games/events/${session.eventId}` : "/games";
  const presentHref = session.eventId ? `/games/events/${session.eventId}/present` : `/games/${session.id}/present`;

  const hasAwards = Object.values(awarded).some((n) => n !== 0);

  return (
    <Page size="lg">
      <PageHeader
        backHref={backHref}
        backLabel={event ? event.title : "All games"}
        title={session.title}
        description={`${GAME_LABEL[session.game]} · ${MODE_LABEL[session.mode]}${turns ? " · Turn by turn" : ""}${startedByName(session, excos) ? ` · Started by ${startedByName(session, excos)}` : ""}`}
        actions={
          <>
            <Badge tone={finished ? "gray" : started ? "green" : "amber"} dot={!finished}>
              {finished ? "Finished" : started ? "Live" : "Not started"}
            </Badge>
            <Link href={presentHref} target="_blank" className="btn-secondary">
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
      {overlayProblem && canControl && (
        <Notice tone="warning" className="mb-4">
          The game is fine, but the OBS overlay didn&rsquo;t update. Check that the new Firestore rules (gameOverlays) are
          deployed, then use &ldquo;Resync overlay&rdquo; at the bottom of this page.
        </Notice>
      )}
      {event && canControl && !onEventScreen && (
        <Notice tone="info" className="mb-4">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>This game isn&rsquo;t on the big screen or the overlay yet. They are showing {event.view === "game" ? "another game" : event.view === "cover" ? "the cover" : "the standings"}.</span>
            <button disabled={busy} onClick={showOnEventScreen} className="btn-primary btn-sm">
              Show this game on screen
            </button>
          </span>
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
            <Link href={backHref} className="btn-primary">
              {event ? "Back to the event" : "Back to games"}
            </Link>
          </div>
        </Card>
      ) : !started ? (
        <Card title="Ready to start?">
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <GameTag game={session.game} />
            <HowToPlay session={session} />
            <p className="max-w-md text-sm text-muted">
              The big screen shows the game name and these rules. The OBS overlay shows only the name.{" "}
              {canControl
                ? `Start the game to show ${isBoard ? "the board" : "the first question"}${!isBoard && timer.enabled ? " and start the countdown" : ""}.`
                : "The game hasn't been started yet."}
            </p>
            {canControl && (
              <button disabled={busy} onClick={startGame} className="btn-primary">
                Start game
              </button>
            )}
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

          {canControl && turns && (
            <Card
              title={`${turnNow?.name ?? "No one"}\u2019s turn`}
              description={
                (session.passes ?? 0) > 0
                  ? "This question was passed on, so it is worth half points."
                  : isBoard
                    ? "Picked the tile. If they miss, you can pass it on for half points."
                    : "If they miss, you can pass it on for half points."
              }
            >
              {session.revealed ? (
                <p className="text-sm text-muted">This one is done. Move on when you are ready.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button disabled={busy || !turnNow} onClick={turnCorrect} className="btn-primary">
                    Correct · {turnNow?.name} +{turnPoints}
                  </button>
                  {canPass(session) && (
                    <button disabled={busy} onClick={turnPass} className="btn-secondary">
                      Missed · pass to {passTo?.name} (half, {basePoints / 2})
                    </button>
                  )}
                  <button disabled={busy} onClick={turnNobody} className="btn-secondary">
                    Missed · no points to anyone
                  </button>
                </div>
              )}
            </Card>
          )}

          <Card
            title="Scoreboard"
            description={canControl ? (turns ? "Points are given with the buttons above." : "Tap a side to give it points. Awarding points also reveals the answer.") : undefined}
            action={
              canControl && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {shownAuto !== null ? (
                    <span className="text-muted">
                      {isBoard ? `This tile is worth ${shownAuto}` : `Worth ${shownAuto} right now`}
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
                  {!turns && (
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input type="checkbox" checked={takeAway} onChange={(e) => setTakeAway(e.target.checked)} className="accent-rccg-red-600" />
                    <span className={takeAway ? "font-medium text-rccg-red-600" : "text-muted"}>{isBoard ? "Wrong answer (lose points)" : "Take away"}</span>
                  </label>
                  )}
                </div>
              )
            }
          >
            <Scoreboard
              session={session}
              onSideClick={canControl && !busy && !turns ? award : undefined}
              awardedThisRound={awarded}
              pickerId={pickerId}
              pickerLabel={turns ? "Their turn" : "Picks next"}
            />
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
      {canControl && !session.eventId && (
        <ObsCard overlayKey={session.overlayKey} busy={busy} onSync={handleSyncOverlay} />
      )}
      {canControl && event && (
        <ObsCard
          overlayKey={event.overlayKey}
          busy={busy}
          onSync={handleSyncEventOverlay}
          subject={`${event.title}`}
          deleteNote="These links are shared by every game in the event, so they stay the same all day. Deleting the event turns them off."
        />
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
