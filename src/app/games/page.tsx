"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buildBoard, buildRounds, createSession, deleteSession, listQuestions, listSessions, winners } from "@/lib/games";
import { listYouths } from "@/lib/youths";
import { useAuth } from "@/lib/useAuth";
import { formatDate } from "@/lib/format";
import RequireAuth from "@/components/RequireAuth";
import GameSetupForm, { type GameDraft } from "@/components/GameSetupForm";
import { Page, PageHeader, Card, Badge, Loading, EmptyState, Notice } from "@/components/ui";
import { GAME_LABEL, MODE_LABEL } from "@/types/games";
import type { GameQuestion, GameSession } from "@/types/games";
import type { Youth } from "@/types";

function GamesInner() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const canRun = hasPermission("canEditEvents");

  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [youths, setYouths] = useState<Youth[]>([]);
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const [s, y, q] = await Promise.all([listSessions(), listYouths({ activeOnly: true }), listQuestions()]);
      setSessions(s);
      setYouths(y);
      setQuestions(q);
    } catch {
      setError("Couldn't load games. Try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleStart(draft: GameDraft) {
    if (!user) return;
    const pool = questions.filter((q) => q.game === draft.game && draft.categories.includes(q.category));
    const board = draft.game === "board" ? buildBoard(pool, draft.categories) : null;
    const rounds = board ? board.rounds : buildRounds(pool, draft.roundCount);
    if (rounds.length === 0) return setError("None of those categories have questions yet.");
    if (board && board.categories.length < 2) return setError("The board needs at least two categories that have clues with point values.");
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
        timerSeconds: draft.timerSeconds,
        showHints: draft.showHints,
        board: board ? { categories: board.categories, values: board.values } : undefined,
      });
      router.push(`/games/${id}`);
    } catch {
      setError("Couldn't start this session. Try again.");
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
        description="Run game sessions for youth programmes. You control the rounds and award the points."
        actions={
          <>
            <Link href="/games/questions" className="btn-secondary">
              Question bank
            </Link>
            {canRun && (
              <button onClick={() => setShowForm((s) => !s)} className={showForm ? "btn-secondary" : "btn-primary"}>
                {showForm ? "Cancel" : "New session"}
              </button>
            )}
          </>
        }
      />

      {error && (
        <Notice tone="error" className="mb-4">
          {error}
        </Notice>
      )}

      {showForm && (
        <Card title="New game session" className="mb-6">
          <GameSetupForm youths={youths} questions={questions} saving={saving} onSubmit={handleStart} />
        </Card>
      )}

      {loading ? (
        <Loading />
      ) : sessions.length === 0 ? (
        <EmptyState
          title="No game sessions yet"
          description={canRun ? "Start one to run scrambled words, Scripture or Cap, emoji trivia, Who Am I? or a quiz board." : undefined}
        />
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => {
            const won = s.status === "finished" ? winners(s) : [];
            return (
              <li key={s.id} className="card flex items-center justify-between gap-3 !p-4 transition-colors hover:border-rccg-purple-300">
                <Link href={`/games/${s.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-rccg-purple-800">{s.title}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {GAME_LABEL[s.game]} · {MODE_LABEL[s.mode]} · {s.rounds.length} {s.game === "board" ? "clues" : "rounds"} · {formatDate(s.createdAt.slice(0, 10))}
                  </p>
                  {s.status === "finished" && (
                    <p className="mt-0.5 text-xs text-muted">
                      {won.length === 0 ? "No winner" : `Won by ${won.map((w) => w.name).join(" and ")}`}
                    </p>
                  )}
                </Link>
                <Badge tone={s.status === "live" ? "green" : "gray"} dot={s.status === "live"}>
                  {s.status === "live" ? "Live" : "Finished"}
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
