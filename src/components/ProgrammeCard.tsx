"use client";

import { useState } from "react";
import Link from "next/link";
import { MONTH_NAMES, STATUS_LABEL, type ProgrammeInput } from "@/lib/programmes";
import { formatDate, naira } from "@/lib/format";
import ProgrammeForm from "./ProgrammeForm";
import { Badge, Field, Notice, type Tone } from "./ui";
import type { Programme, ProgrammeStatus } from "@/types";

const STATUS_TONE: Record<ProgrammeStatus, Tone> = {
  suggested: "amber",
  approved: "green",
  declined: "gray",
};

interface Props {
  programme: Programme;
  years: number[];
  canManage: boolean; // can approve/decline/edit anything/create events
  isMine: boolean; // they suggested it
  showMonth?: boolean; // show the month in the summary line (status view)
  onSetStatus: (status: ProgrammeStatus) => Promise<void>;
  onSave: (input: ProgrammeInput) => Promise<void>;
  onDelete: () => Promise<void>;
  onCreateEvent: (details: { title: string; date: string; theme: string }) => Promise<void>;
}

export default function ProgrammeCard({
  programme: p,
  years,
  canManage,
  isMine,
  showMonth,
  onSetStatus,
  onSave,
  onDelete,
  onCreateEvent,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"view" | "edit" | "event">("view");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Event form defaults: the suggested month's 1st (the team picks the real day).
  const [evTitle, setEvTitle] = useState(p.title);
  const [evDate, setEvDate] = useState(`${p.year}-${String(p.month ?? 1).padStart(2, "0")}-01`);
  const [evTheme, setEvTheme] = useState("");

  // A suggester can tweak or withdraw their own idea until it's decided.
  const canEdit = canManage || (isMine && p.status === "suggested");
  const canDelete = !p.eventId && (canManage || (isMine && p.status === "suggested"));

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      setError("That didn't work. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const summary = [
    showMonth ? (p.month ? MONTH_NAMES[p.month - 1] : "Month not decided") : null,
    p.timeNote,
    p.estimatedBudget ? naira(p.estimatedBudget) : null,
  ].filter(Boolean);

  return (
    <div className="card !p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 p-3.5 text-left hover:bg-rccg-purple-50/50"
      >
        <div className="min-w-0">
          <p className="font-semibold text-rccg-purple-800">{p.title}</p>
          {summary.length > 0 && <p className="mt-0.5 text-xs text-muted">{summary.join(" · ")}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={STATUS_TONE[p.status]} dot>
            {STATUS_LABEL[p.status]}
          </Badge>
          {p.eventId && <Badge tone="purple">Event created</Badge>}
        </div>
      </button>

      {open && (
        <div className="space-y-3 border-t border-line p-3.5">
          {mode === "edit" ? (
            <ProgrammeForm
              initial={p}
              defaultYear={p.year}
              years={years}
              submitLabel="Save changes"
              onSubmit={async (input) => {
                await onSave(input);
                setMode("view");
              }}
              onCancel={() => setMode("view")}
            />
          ) : mode === "event" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await onCreateEvent({ title: evTitle, date: evDate, theme: evTheme });
                  setMode("view");
                });
              }}
              className="space-y-3"
            >
              <p className="text-sm font-semibold text-rccg-purple-800">Create an event from this programme</p>
              <p className="text-xs text-muted">
                The idea becomes the event's planning notes{p.estimatedBudget ? ", and the rough budget becomes a budget line" : ""}.
              </p>
              <Field label="Event title">
                <input value={evTitle} onChange={(e) => setEvTitle(e.target.value)} className="input" required />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Date">
                  <input type="date" value={evDate} onChange={(e) => setEvDate(e.target.value)} className="input" required />
                </Field>
                <Field label="Theme (optional)">
                  <input value={evTheme} onChange={(e) => setEvTheme(e.target.value)} className="input" />
                </Field>
              </div>
              <div className="flex gap-2">
                <button disabled={busy} className="btn-primary btn-sm">
                  {busy ? "Creating…" : "Create event"}
                </button>
                <button type="button" onClick={() => setMode("view")} className="btn-secondary btn-sm">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              {p.idea ? (
                <p className="whitespace-pre-wrap text-sm text-ink">{p.idea}</p>
              ) : (
                <p className="text-sm italic text-muted">No description yet.</p>
              )}

              <p className="text-xs text-muted">
                Suggested by {p.createdByName} · {formatDate(p.createdAt)}
                {p.decidedByName && p.decidedAt
                  ? ` · ${STATUS_LABEL[p.status]} by ${p.decidedByName} on ${formatDate(p.decidedAt)}`
                  : ""}
              </p>

              {error && <Notice tone="error">{error}</Notice>}

              <div className="flex flex-wrap items-center gap-2">
                {p.eventId && (
                  <Link href={`/events/${p.eventId}`} className="btn-primary btn-sm">
                    Open event
                  </Link>
                )}
                {canManage && p.status === "suggested" && (
                  <>
                    <button disabled={busy} onClick={() => run(() => onSetStatus("approved"))} className="btn-primary btn-sm">
                      Approve
                    </button>
                    <button disabled={busy} onClick={() => run(() => onSetStatus("declined"))} className="btn-secondary btn-sm">
                      Decline
                    </button>
                  </>
                )}
                {canManage && p.status === "approved" && !p.eventId && (
                  <>
                    <button disabled={busy} onClick={() => setMode("event")} className="btn-primary btn-sm">
                      Create event
                    </button>
                    <button disabled={busy} onClick={() => run(() => onSetStatus("suggested"))} className="btn-secondary btn-sm">
                      Move back to suggested
                    </button>
                  </>
                )}
                {canManage && p.status === "declined" && (
                  <button disabled={busy} onClick={() => run(() => onSetStatus("suggested"))} className="btn-secondary btn-sm">
                    Reopen
                  </button>
                )}
                {canEdit && (
                  <button disabled={busy} onClick={() => setMode("edit")} className="btn-ghost">
                    Edit
                  </button>
                )}
                {canDelete && (
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Delete “${p.title}”? This can't be undone.`)) run(onDelete);
                    }}
                    className="btn-ghost-danger"
                  >
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
