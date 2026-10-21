"use client";

import { useState } from "react";
import Link from "next/link";
import BookPicker from "@/components/BookPicker";
import { TimerBadge } from "@/components/GameBoard";
import { teaserEnded } from "@/components/TeaserScreen";
import { ListPicker, TeaserSlots, useFlash } from "@/components/TeaserParts";
import { Badge, Card, Notice, Page, PageHeader } from "@/components/ui";
import { pickUpdate, updateRun } from "@/lib/teasers";
import { useRoundTimer } from "@/lib/useRoundTimer";
import type { TimerState } from "@/types/games";
import type { TeaserRun } from "@/types/teasers";

/** The host's side of a teaser: start and stop the clock, tap each answer as it is shouted, reveal at the end. */
export default function TeaserHost({ run, canControl }: { run: TeaserRun; canControl: boolean }) {
  const timer = useRoundTimer(run);
  const flash = useFlash(run);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ended = teaserEnded(run, timer);
  const named = run.slots.filter((s) => s.answer).length;
  const canPick = canControl && run.status === "live" && !ended;

  async function save(data: Parameters<typeof updateRun>[1]) {
    setBusy(true);
    setError(null);
    try {
      await updateRun(run.id, data);
    } catch {
      setError("That didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function timerFields(state: TimerState, remaining: number) {
    return { timerState: state, timerRemaining: Math.round(remaining * 10) / 10, timerSeq: run.timerSeq + 1 };
  }

  const start = () => save({ status: "live", ...timerFields(run.timerSeconds > 0 ? "running" : "idle", run.timerSeconds) });
  const pause = () => save(timerFields("paused", timer.remaining));
  const resume = () => save(timerFields("running", timer.remaining));
  // Revealing early stops the clock, and every screen shows what was left.
  const finish = () => save({ status: "finished", ...(timer.state === "idle" ? {} : timerFields("paused", timer.remaining)) });
  const reset = () =>
    save({
      status: "ready",
      slots: run.slots.map(() => ({ answer: "", by: "" })),
      flash: { kind: "hit", text: "", seq: (run.flash?.seq ?? 0) + 1 },
      ...timerFields("idle", run.timerSeconds),
    });

  function pick(text: string) {
    if (!canPick) return;
    save(pickUpdate(run, text, timer.remaining));
  }

  function setWho(index: number, who: string) {
    save({ slots: run.slots.map((s, i) => (i === index ? { ...s, by: who } : s)) });
  }

  return (
    <Page size="lg">
      <PageHeader
        backHref="/games/teasers"
        backLabel="Teasers"
        title={run.title}
        description={run.prompt}
        actions={
          <>
            <Badge tone={ended ? "gray" : run.status === "live" ? "green" : "amber"} dot={!ended}>
              {ended ? "Finished" : run.status === "live" ? "Live" : "Not started"}
            </Badge>
            <Link href={`/games/play/${run.id}/present`} target="_blank" className="btn-secondary">
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
          You can watch this game, but only excos who manage events can run it.
        </Notice>
      )}
      {flash?.kind === "dup" && (
        <Notice tone="warning" className="mb-4">
          Already named: <span className="font-semibold">{flash.text}</span>. Nothing was added.
        </Notice>
      )}
      {flash?.kind === "miss" && (
        <Notice tone="error" className="mb-4">
          Not one of the answers: <span className="font-semibold">{flash.text}</span>. Nothing was added.
        </Notice>
      )}

      <div className="space-y-5">
        <Card
          title="Controls"
          action={timer.enabled ? <TimerBadge timer={timer} inline /> : <span className="text-sm text-muted">No timer</span>}
        >
          <div className="flex flex-wrap items-center gap-2">
            {canControl && run.status === "ready" && (
              <button disabled={busy} onClick={start} className="btn-primary">
                Start{timer.enabled ? " the clock" : ""}
              </button>
            )}
            {canControl && run.status === "live" && !ended && timer.enabled && (
              timer.state === "running" ? (
                <button disabled={busy} onClick={pause} className="btn-secondary">
                  Pause
                </button>
              ) : (
                <button disabled={busy} onClick={resume} className="btn-secondary">
                  Resume
                </button>
              )
            )}
            {canControl && !ended && run.status !== "ready" && (
              <button disabled={busy} onClick={finish} className="btn-secondary">
                Reveal what&rsquo;s left
              </button>
            )}
            {canControl && run.status !== "ready" && (
              <button disabled={busy} onClick={reset} className="btn-ghost-danger">
                Reset
              </button>
            )}
            <span className="ml-auto text-sm text-muted">
              <span className="num font-semibold text-ink">{named}</span> of {run.slotCount} named
            </span>
          </div>
          {run.status === "ready" && (
            <p className="mt-2 text-xs text-muted">Start the game to begin taking answers. The big screen shows the empty slots until you do.</p>
          )}
        </Card>

        <Card title="On the big screen" description={canControl ? "Optionally note who got each answer." : undefined}>
          <TeaserSlots run={run} ended={ended} flash={flash} onWho={canControl ? setWho : undefined} />
        </Card>

        {canControl && (
          <Card
            title="Pick an answer"
            description={
              canPick
                ? "Tap the answer someone shouts. It fills the next slot. An answer already named, or not on the list, fills nothing."
                : run.status === "ready"
                  ? "Start the game first."
                  : "The game is over."
            }
          >
            {run.picker === "books" ? (
              <BookPicker onPick={pick} marked={run.slots.map((s) => s.answer).filter(Boolean)} disabled={!canPick || busy} />
            ) : (
              <ListPicker run={run} onPick={pick} disabled={!canPick || busy} />
            )}
          </Card>
        )}
      </div>
    </Page>
  );
}
