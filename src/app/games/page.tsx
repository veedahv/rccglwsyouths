"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buildBoard, buildRounds, createSession, deleteSession, listQuestions, listSessions, startedByName, winners } from "@/lib/games";
import { listExcos } from "@/lib/excos";
import { listYouths } from "@/lib/youths";
import { useAuth } from "@/lib/useAuth";
import { formatDate } from "@/lib/format";
import RequireAuth from "@/components/RequireAuth";
import GamesTabs from "@/components/GamesTabs";
import GameSetupForm, { type GameDraft } from "@/components/GameSetupForm";
import EventSetupForm, { type EventDraft } from "@/components/EventSetupForm";
import { createEvent, listEvents } from "@/lib/gameEvents";
import { Page, PageHeader, Card, Badge, Loading, EmptyState, Notice } from "@/components/ui";
import { GAME_LABEL, MODE_LABEL, hasStarted } from "@/types/games";
import type { GameEvent, GameQuestion, GameSession } from "@/types/games";
import type { ExcoMember, Youth } from "@/types";

function GamesInner() {
  const router = useRouter();
  const { user, exco, hasPermission } = useAuth();
  const canRun = hasPermission("canEditEvents");

  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [youths, setYouths] = useState<Youth[]>([]);
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [excos, setExcos] = useState<ExcoMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<"event" | "session" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      // The excos list only fills in names for sessions made before names were saved,
      // so a failure there shouldn't stop the page loading.
      const [s, y, q, e, ev] = await Promise.all([
        listSessions(),
        listYouths({ activeOnly: true }),
        listQuestions(),
        listExcos().catch(() => [] as ExcoMember[]),
        listEvents(),
      ]);
      setEvents(ev);
      setSessions(s);
      setYouths(y);
      setQuestions(q);
      setExcos(e);
    } catch {
      setError("Couldn't load games. Try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  // Games inside an event are listed under that event, not here.
  const standalone = sessions.filter((s) => !s.eventId);

  async function handleStart(draft: GameDraft) {
    if (!user) return;
    const pool = questions.filter((q) => q.game === draft.game && draft.categories.includes(q.category));
    const board = draft.game === "board" ? buildBoard(pool, draft.categories) : null;
    const rounds = board ? board.rounds : buildRounds(pool, draft.roundCount);
    if (rounds.length === 0) return setError("None of those categories have questions yet.");
    if (board && board.categories.length < 2) return setError("The board needs at least two categories that have clues with point values.");
    if (draft.game === "spouses" && rounds.length < 2) return setError("Bible Couples needs at least two couples with different names. Add more to the question bank.");
    setError(null);
    setSaving(true);
    try {
      const id = await createSession({
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
      });
      router.push(`/games/${id}`);
    } catch {
      setError("Couldn't start this session. Try again.");
      setSaving(false);
    }
  }

  async function handleCreateEvent(draft: EventDraft) {
    if (!user) return;
    setError(null);
    setSaving(true);
    try {
      const id = await createEvent({ ...draft, createdBy: user.uid, createdByName: exco?.name ?? user.email ?? "Unknown" });
      router.push(`/games/events/${id}`);
    } catch {
      setError("Couldn't create this event. Try again.");
      setSaving(false);
    }
  }

  async function handleDelete(s: GameSession) {
    if (!window.confirm(`Delete “${s.title}”? Its scores will be gone.`)) return;
    try {
      await deleteSession(s);
      setSessions((prev) => prev.filter((x) => x.id !== s.id));
    } catch {
      setError("Couldn't delete that session.");
    }
  }

  return (
    <Page size="md">
      <PageHeader
        title="Games"
        description="Run a games day with several games, or a single game. You control the rounds and award the points."
        actions={
          <>
            {canRun &&
              (showForm ? (
                <button onClick={() => setShowForm(null)} className="btn-secondary">
                  Cancel
                </button>
              ) : (
                <>
                  <button onClick={() => setShowForm("session")} className="btn-secondary">
                    Single game
                  </button>
                  <button onClick={() => setShowForm("event")} className="btn-primary">
                    New games event
                  </button>
                </>
              ))}
          </>
        }
      />

      <GamesTabs />

      {error && (
        <Notice tone="error" className="mb-4">
          {error}
        </Notice>
      )}

      {showForm === "event" && (
        <Card
          title="New games event"
          description="One occasion with a cover screen, one video overlay and an overall result. Add its games one by one."
          className="mb-6"
        >
          <EventSetupForm saving={saving} onSubmit={handleCreateEvent} />
        </Card>
      )}
      {showForm === "session" && (
        <Card title="New single game" description="A quick one-off game with its own screen and overlay, outside any event." className="mb-6">
          <GameSetupForm youths={youths} questions={questions} saving={saving} onSubmit={handleStart} />
        </Card>
      )}

      {!loading && events.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Games events</h2>
          <ul className="space-y-2">
            {events.map((ev) => {
              const games = sessions.filter((s) => s.eventId === ev.id);
              return (
                <li key={ev.id} className="card !p-4 transition-colors hover:border-rccg-purple-300">
                  <Link href={`/games/events/${ev.id}`} className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-rccg-purple-800">{ev.title}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {[ev.subtitle, `${games.length} game${games.length === 1 ? "" : "s"} added`, `Created ${formatDate(ev.createdAt.slice(0, 10))}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <Badge tone={ev.status === "finished" ? "gray" : "green"} dot={ev.status !== "finished"}>
                      {ev.status === "finished" ? "Finished" : "Live"}
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!loading && events.length > 0 && standalone.length > 0 && (
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Single games</h2>
      )}

      {loading ? (
        <Loading />
      ) : events.length === 0 && standalone.length === 0 ? (
        <EmptyState
          title="No games yet"
          description={canRun ? "Start a games event for a whole games day, or a single game for a quick round." : undefined}
        />
      ) : standalone.length === 0 ? null : (
        <ul className="space-y-2">
          {standalone.map((s) => {
            const won = s.status === "finished" ? winners(s) : [];
            return (
              <li key={s.id} className="card flex items-center justify-between gap-3 !p-4 transition-colors hover:border-rccg-purple-300">
                <Link href={`/games/${s.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-rccg-purple-800">{s.title}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {GAME_LABEL[s.game]} · {MODE_LABEL[s.mode]} · {s.rounds.length} {s.game === "board" ? "clues" : "rounds"} · {formatDate(s.createdAt.slice(0, 10))}
                  </p>
                  {(startedByName(s, excos) || s.status === "finished") && (
                    <p className="mt-0.5 text-xs text-muted">
                      {[
                        startedByName(s, excos) ? `Started by ${startedByName(s, excos)}` : null,
                        s.status === "finished" ? (won.length === 0 ? "No winner" : `Won by ${won.map((w) => w.name).join(" and ")}`) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </Link>
                <Badge tone={s.status === "live" ? (hasStarted(s) ? "green" : "amber") : "gray"} dot={s.status === "live"}>
                  {s.status === "live" ? (hasStarted(s) ? "Live" : "Not started") : "Finished"}
                </Badge>
                {canRun && (
                  <button onClick={() => handleDelete(s)} className="btn-ghost-danger" aria-label={`Delete ${s.title}`}>
                    Delete
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}

export default function GamesPage() {
  return (
    <RequireAuth>
      <GamesInner />
    </RequireAuth>
  );
}
