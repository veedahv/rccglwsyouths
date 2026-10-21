"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { buildBoard, buildRounds, createSession, deleteSession, listQuestions, winners } from "@/lib/games";
import {
  deleteEvent,
  previousLineups,
  setEventView,
  updateEvent,
  subscribeEvent,
  subscribeEventSessions,
  summarizeEvent,
  writeEventOverlay,
} from "@/lib/gameEvents";
import { listYouths } from "@/lib/youths";
import { useAuth } from "@/lib/useAuth";
import RequireAuth from "@/components/RequireAuth";
import ObsCard from "@/components/ObsCard";
import GameAttendance, { type AttendancePatch } from "@/components/GameAttendance";
import GameSetupForm, { type GameDraft } from "@/components/GameSetupForm";
import { OverallBoard } from "@/components/EventScreens";
import { Page, PageHeader, Card, Badge, Loading, EmptyState, Notice } from "@/components/ui";
import { GAME_LABEL, MODE_LABEL, hasStarted } from "@/types/games";
import type { EventView, GameEvent, GameQuestion, GameSession } from "@/types/games";
import type { Youth } from "@/types";

const VIEW_LABEL: Record<EventView, string> = {
  cover: "Cover",
  game: "A game",
  standings: "Standings",
  final: "Final result",
};

function EventInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, exco, hasPermission } = useAuth();
  const canRun = hasPermission("canEditEvents");

  const [event, setEvent] = useState<GameEvent | null>(null);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [youths, setYouths] = useState<Youth[]>([]);
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overlayProblem, setOverlayProblem] = useState(false);

  useEffect(() => {
    const off = [
      subscribeEvent(
        id,
        (e) => {
          setEvent(e);
          setLoading(false);
        },
        () => {
          setError("Couldn't load this event.");
          setLoading(false);
        }
      ),
      subscribeEventSessions(id, setSessions, () => setError("Couldn't load this event's games.")),
    ];
    return () => off.forEach((f) => f());
  }, [id]);

  // The player list and question bank are only needed when adding a game.
  useEffect(() => {
    if (!canRun) return;
    Promise.all([listYouths({ activeOnly: true }), listQuestions()])
      .then(([y, q]) => {
        setYouths(y);
        setQuestions(q);
      })
      .catch(() => setError("Couldn't load the youths and questions needed to add a game."));
  }, [canRun]);

  const summary = useMemo(() => summarizeEvent(sessions), [sessions]);
  const lineups = useMemo(
    () => previousLineups(sessions).map(({ label, session }) => ({ label, mode: session.mode, sides: session.sides })),
    [sessions]
  );

  // The next planned game that hasn't been added yet, so the form opens on it.
  const nextPlanned = useMemo(() => {
    if (!event) return undefined;
    const used = [...sessions];
    for (const g of event.plannedGames) {
      const at = used.findIndex((s) => s.game === g);
      if (at < 0) return g;
      used.splice(at, 1);
    }
    return undefined;
  }, [event, sessions]);

  async function show(view: EventView, sessionId?: string) {
    if (!event) return;
    setBusy(true);
    setError(null);
    try {
      const { overlayOk } = await setEventView(event, view, sessionId);
      setOverlayProblem(!overlayOk);
    } catch {
      setError("Couldn't change the screen. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAttendance(patch: AttendancePatch) {
    if (!event) return;
    try {
      await updateEvent(event.id, patch);
    } catch {
      setError("Couldn't save attendance. Check your connection and try again.");
    }
  }

  async function handleSync() {
    if (!event) return;
    setBusy(true);
    try {
      const { overlayOk } = await writeEventOverlay(event);
      setOverlayProblem(!overlayOk);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddGame(draft: GameDraft) {
    if (!user || !event) return;
    const pool = questions.filter((q) => q.game === draft.game && draft.categories.includes(q.category));
    const board = draft.game === "board" ? buildBoard(pool, draft.categories) : null;
    const rounds = board ? board.rounds : buildRounds(pool, draft.roundCount);
    if (rounds.length === 0) return setError("None of those categories have questions yet.");
    if (board && board.categories.length < 2) return setError("The board needs at least two categories that have clues with point values.");
    if (draft.game === "spouses" && rounds.length < 2) return setError("Bible Couples needs at least two couples with different names. Add more to the question bank.");
    setError(null);
    setBusy(true);
    try {
      const sessionId = await createSession({
        title: draft.title,
        game: draft.game,
        mode: draft.mode,
        sides: draft.sides,
        rounds,
        createdBy: user.uid,
        createdByName: exco?.name ?? user.email ?? "Unknown",
        timerSeconds: draft.timerSeconds,
        showHints: draft.showHints,
        playMode: draft.playMode,
        firstTurn: draft.firstTurn,
        board: board ? { categories: board.categories, values: board.values } : undefined,
        eventId: event.id,
      });
      router.push(`/games/${sessionId}`);
    } catch {
      setError("Couldn't add this game. Try again.");
      setBusy(false);
    }
  }

  async function handleDeleteGame(s: GameSession) {
    if (!event || !window.confirm(`Delete “${s.title}”? Its scores will be gone from the overall result too.`)) return;
    setBusy(true);
    try {
      await deleteSession({ id: s.id, overlayKey: undefined });
      if (event.view === "game" && event.activeSessionId === s.id) await show("cover");
    } catch {
      setError("Couldn't delete that game.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteEvent() {
    if (!event) return;
    if (!window.confirm(`Delete “${event.title}” and all ${sessions.length} of its games? Their scores will be gone.`)) return;
    setBusy(true);
    try {
      await deleteEvent(event);
      router.push("/games");
    } catch {
      setError("Couldn't delete this event.");
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
  if (!event) {
    return (
      <Page size="sm">
        <EmptyState
          title="Event not found"
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

  // Once anyone is marked present, games pick only from the people present.
  const attendanceTaken = (event.presentIds?.length ?? 0) + (event.guests?.length ?? 0) > 0;

  const active = event.view === "game" ? sessions.find((s) => s.id === event.activeSessionId) : undefined;
  const screenNow = active ? active.title : VIEW_LABEL[event.view];
  const playedAny = sessions.some(hasStarted);

  return (
    <Page size="lg">
      <PageHeader
        backHref="/games"
        backLabel="All games"
        title={event.title}
        description={[event.subtitle, event.venue].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            <Badge tone={event.status === "finished" ? "gray" : "green"} dot={event.status !== "finished"}>
              {event.status === "finished" ? "Finished" : "Live"}
            </Badge>
            <Link href={`/games/events/${event.id}/present`} target="_blank" className="btn-secondary">
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
      {overlayProblem && canRun && (
        <Notice tone="warning" className="mb-4">
          The event is fine, but the OBS overlay didn&rsquo;t update. Check that the new Firestore rules (gameEvents and
          gameOverlays) are deployed, then use &ldquo;Resync overlay&rdquo; at the bottom of this page.
        </Notice>
      )}
      {!canRun && (
        <Notice tone="info" className="mb-4">
          You can watch this event, but only excos who manage events can run it.
        </Notice>
      )}

      <div className="space-y-5">
        <Card
          title="On the big screen"
          description={`Showing now: ${screenNow}. The video overlay follows whatever you pick here.`}
        >
          <div className="flex flex-wrap gap-2">
            <button disabled={!canRun || busy} onClick={() => show("cover")} className={event.view === "cover" ? "btn-primary" : "btn-secondary"}>
              Cover
            </button>
            <button
              disabled={!canRun || busy || !playedAny}
              onClick={() => show("standings")}
              className={event.view === "standings" ? "btn-primary" : "btn-secondary"}
            >
              Standings
            </button>
            <button
              disabled={!canRun || busy || !playedAny}
              onClick={() => show("final")}
              className={event.view === "final" ? "btn-primary" : "btn-secondary"}
            >
              Final result
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            To put a game on screen, use &ldquo;Show on screen&rdquo; next to it below. Show the standings between games and the final result at the end.
          </p>
        </Card>

        <GameAttendance event={event} youths={youths} canEdit={canRun} onChange={saveAttendance} />

        <Card
          title="Games"
          description={
            event.plannedGames.length > 0
              ? `Planned: ${event.plannedGames.map((g) => GAME_LABEL[g]).join(", ")}.`
              : "Add the games as you get to them."
          }
          action={
            canRun && (
              <button onClick={() => setShowForm((v) => !v)} className={showForm ? "btn-secondary" : "btn-primary"}>
                {showForm ? "Cancel" : "Add a game"}
              </button>
            )
          }
        >
          {showForm && canRun && (
            <div className="mb-5 rounded-xl border border-line bg-mist p-4">
              <GameSetupForm
                youths={youths}
                questions={questions}
                saving={busy}
                onSubmit={handleAddGame}
                defaultGame={nextPlanned ?? event.plannedGames[0] ?? "scramble"}
                reuse={lineups}
                hosts={event.hosts ?? []}
                attendance={attendanceTaken ? { presentIds: event.presentIds ?? [], guests: event.guests ?? [] } : null}
                submitLabel="Add game"
              />
            </div>
          )}

          {sessions.length === 0 ? (
            <p className="py-3 text-sm text-muted">No games added yet.</p>
          ) : (
            <ul className="space-y-2">
              {sessions.map((s, i) => {
                const won = s.status === "finished" ? winners(s) : [];
                const onScreen = event.view === "game" && event.activeSessionId === s.id;
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white p-3">
                    <span className="num font-display text-lg font-bold text-rccg-purple-500">{String(i + 1).padStart(2, "0")}</span>
                    <Link href={`/games/${s.id}`} className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-rccg-purple-800">{s.title}</p>
                      <p className="text-xs text-muted">
                        {GAME_LABEL[s.game]} · {MODE_LABEL[s.mode]}
                        {s.status === "finished" && ` · ${won.length === 0 ? "No winner" : `Won by ${won.map((w) => w.name).join(" and ")}`}`}
                      </p>
                    </Link>
                    {onScreen && <Badge tone="purple">On screen</Badge>}
                    <Badge tone={s.status === "live" ? (hasStarted(s) ? "green" : "amber") : "gray"} dot={s.status === "live"}>
                      {s.status === "live" ? (hasStarted(s) ? "Live" : "Not started") : "Finished"}
                    </Badge>
                    {canRun && (
                      <div className="flex items-center gap-1">
                        {!onScreen && (
                          <button disabled={busy} onClick={() => show("game", s.id)} className="btn-secondary btn-sm">
                            Show on screen
                          </button>
                        )}
                        <Link href={`/games/${s.id}`} className="btn-primary btn-sm">
                          Run
                        </Link>
                        <button disabled={busy} onClick={() => handleDeleteGame(s)} className="btn-ghost-danger btn-sm" aria-label={`Delete ${s.title}`}>
                          Delete
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Overall result" description="Games played by the same sides are added up. Games with different sides are listed on their own.">
          <OverallBoard summary={summary} final={event.status === "finished"} />
        </Card>

        {canRun && (
          <>
            <ObsCard
              overlayKey={event.overlayKey}
              busy={busy}
              onSync={handleSync}
              subject={event.title}
              deleteNote="One set of links covers the whole event, so they stay the same all day. Deleting the event turns them off."
            />
            <div className="flex justify-end">
              <button disabled={busy} onClick={handleDeleteEvent} className="btn-ghost-danger">
                Delete this event
              </button>
            </div>
          </>
        )}
      </div>
    </Page>
  );
}

export default function GameEventPage() {
  return (
    <RequireAuth>
      <EventInner />
    </RequireAuth>
  );
}
