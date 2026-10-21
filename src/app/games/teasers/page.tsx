"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addTeaser,
  answersToLines,
  createTeaserRun,
  deleteTeaser,
  listTeasers,
  parseAnswerLines,
  seedStarterTeasers,
  slotCountOf,
  updateTeaser,
} from "@/lib/teasers";
import { useAuth } from "@/lib/useAuth";
import RequireAuth from "@/components/RequireAuth";
import GamesTabs from "@/components/GamesTabs";
import BookPicker from "@/components/BookPicker";
import { Page, PageHeader, Card, Field, Badge, Loading, EmptyState, Notice } from "@/components/ui";
import { PICKER_LABEL } from "@/types/teasers";
import type { PickerKind, Teaser } from "@/types/teasers";

interface FormState {
  title: string;
  prompt: string;
  picker: PickerKind;
  seconds: string;
  count: string; // how many must be named; empty means all of them
  books: string[]; // books picker: the accepted books
  lines: string; // list picker: one answer per line, "Name | alias | alias"
  distractors: string; // list picker: one wrong option per line
}

const EMPTY: FormState = { title: "", prompt: "", picker: "books", seconds: "60", count: "", books: [], lines: "", distractors: "" };

function toForm(t: Teaser): FormState {
  return {
    title: t.title,
    prompt: t.prompt,
    picker: t.picker,
    seconds: String(t.seconds),
    count: t.count && t.count < t.answers.length ? String(t.count) : "",
    books: t.picker === "books" ? t.answers.map((a) => a.name) : [],
    lines: t.picker === "list" ? answersToLines(t.answers) : "",
    distractors: (t.distractors ?? []).join("\n"),
  };
}

function TeasersInner() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const canRun = hasPermission("canEditEvents");

  const [teasers, setTeasers] = useState<Teaser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; form: FormState } | null>(null);

  async function refresh() {
    try {
      setTeasers(await listTeasers());
    } catch {
      setError("Couldn't load teasers. Try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function play(t: Teaser) {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      router.push(`/games/play/${await createTeaserRun(t, user.uid)}`);
    } catch {
      setError("Couldn't start that teaser. Try again.");
      setBusy(false);
    }
  }

  async function loadStarter() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const added = await seedStarterTeasers(teasers);
      setMessage(added === 0 ? "The starter teasers are already here." : `Added ${added} starter teaser${added === 1 ? "" : "s"}.`);
      await refresh();
    } catch {
      setError("Couldn't load the starter set.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(t: Teaser) {
    if (!window.confirm(`Delete the teaser “${t.title}”? Games already played aren't affected.`)) return;
    try {
      await deleteTeaser(t.id);
      setTeasers((prev) => prev.filter((x) => x.id !== t.id));
    } catch {
      setError("Couldn't delete that teaser.");
    }
  }

  async function save() {
    if (!editing) return;
    const f = editing.form;
    const answers = f.picker === "books" ? f.books.map((name) => ({ name })) : parseAnswerLines(f.lines);
    const seconds = Number(f.seconds);
    const count = f.count.trim() === "" ? undefined : Number(f.count);

    if (!f.title.trim() || !f.prompt.trim()) return setError("Give the teaser a title and a prompt.");
    if (answers.length === 0) return setError(f.picker === "books" ? "Pick the books that are right answers." : "Add at least one answer.");
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 3600) return setError("Set the timer between 0 and 3600 seconds, or 0 for no timer.");
    if (count !== undefined && (!Number.isInteger(count) || count < 1 || count > answers.length)) {
      return setError(`The number to name must be between 1 and ${answers.length}, or empty to need them all.`);
    }

    const data = {
      title: f.title.trim(),
      prompt: f.prompt.trim(),
      picker: f.picker,
      answers,
      ...(count && count < answers.length ? { count } : {}),
      distractors:
        f.picker === "list"
          ? f.distractors
              .split("\n")
              .map((d) => d.trim())
              .filter(Boolean)
          : [],
      seconds: Math.round(seconds),
    };
    setBusy(true);
    setError(null);
    try {
      if (editing.id) await updateTeaser(editing.id, { ...data, ...(count && count < answers.length ? {} : { count: 0 }) });
      else await addTeaser(data);
      setEditing(null);
      await refresh();
    } catch {
      setError("Couldn't save that teaser. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const set = (patch: Partial<FormState>) => editing && setEditing({ ...editing, form: { ...editing.form, ...patch } });

  return (
    <Page size="md">
      <PageHeader
        title="Games"
        description="Teasers are quick warm-up games: name as many answers as you can before the clock runs out. No teams or points needed."
        actions={
          canRun && (
            <>
              <button disabled={busy} onClick={loadStarter} className="btn-secondary">
                Load starter set
              </button>
              <button onClick={() => setEditing(editing ? null : { id: null, form: EMPTY })} className={editing ? "btn-secondary" : "btn-primary"}>
                {editing ? "Cancel" : "New teaser"}
              </button>
            </>
          )
        }
      />
      <GamesTabs />

      {error && (
        <Notice tone="error" className="mb-4">
          {error}
        </Notice>
      )}
      {message && (
        <Notice tone="info" className="mb-4">
          {message}
        </Notice>
      )}

      {editing && canRun && (
        <Card title={editing.id ? "Edit teaser" : "New teaser"} className="mb-6">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title">
                <input value={editing.form.title} onChange={(e) => set({ title: e.target.value })} placeholder="4-letter books" className="input" />
              </Field>
              <Field label="Seconds for the whole game" hint="0 means no timer.">
                <input type="number" min={0} max={3600} value={editing.form.seconds} onChange={(e) => set({ seconds: e.target.value })} className="input" />
              </Field>
            </div>
            <Field label="Prompt" hint="What the host reads out and the screen shows.">
              <input
                value={editing.form.prompt}
                onChange={(e) => set({ prompt: e.target.value })}
                placeholder="Name 9 books of the Bible with only 4 letters"
                className="input"
              />
            </Field>

            <fieldset className="space-y-2">
              <legend className="label">How does the host pick answers?</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["books", "list"] as const).map((p) => (
                  <label
                    key={p}
                    className={[
                      "flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-sm transition-colors",
                      editing.form.picker === p ? "border-rccg-green-500 bg-rccg-green-50" : "border-line bg-white hover:border-rccg-purple-300",
                    ].join(" ")}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <input type="radio" name="picker" checked={editing.form.picker === p} onChange={() => set({ picker: p })} className="accent-rccg-green-600" />
                      {PICKER_LABEL[p]}
                    </span>
                    <span className="text-xs text-muted">
                      {p === "books" ? "A grid of all 66 books. The right answers are books." : "Taps from a list of answers, or the host types one."}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {editing.form.picker === "books" ? (
              <div>
                <p className="label">Which books are right answers? ({editing.form.books.length} picked)</p>
                <div className="rounded-lg border border-line bg-white p-3">
                  <BookPicker
                    mode="select"
                    marked={editing.form.books}
                    onPick={(name) =>
                      set({ books: editing.form.books.includes(name) ? editing.form.books.filter((b) => b !== name) : [...editing.form.books, name] })
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Right answers" hint={'One per line. Other accepted names go after a bar: Peter | Simon Peter | Cephas'}>
                  <textarea rows={8} value={editing.form.lines} onChange={(e) => set({ lines: e.target.value })} className="input" />
                </Field>
                <Field label="Wrong options (optional)" hint="Shown in the picker among the right ones. One per line.">
                  <textarea rows={8} value={editing.form.distractors} onChange={(e) => set({ distractors: e.target.value })} className="input" />
                </Field>
              </div>
            )}

            <Field
              label="How many must be named? (optional)"
              hint="Leave empty when every answer is needed. For open-ended ones (Name 5 miracles of Jesus), list many answers and set 5 here."
              className="max-w-sm"
            >
              <input type="number" min={1} value={editing.form.count} onChange={(e) => set({ count: e.target.value })} className="input" />
            </Field>

            <div className="flex gap-2">
              <button disabled={busy} onClick={save} className="btn-primary">
                {busy ? "Saving…" : "Save teaser"}
              </button>
              <button disabled={busy} onClick={() => setEditing(null)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <Loading />
      ) : teasers.length === 0 ? (
        <EmptyState
          title="No teasers yet"
          description={canRun ? "Load the starter set to get 4-letter books, books starting with J, the minor prophets, the 12 disciples and the fruit of the Spirit." : undefined}
        />
      ) : (
        <ul className="space-y-2">
          {teasers.map((t) => (
            <li key={t.id} className="card flex flex-wrap items-center gap-3 !p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-rccg-purple-800">{t.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted">{t.prompt}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {slotCountOf(t)} to name · {t.seconds > 0 ? `${t.seconds}s` : "no timer"}
                </p>
              </div>
              <Badge tone="purple">{PICKER_LABEL[t.picker]}</Badge>
              {canRun && (
                <div className="flex items-center gap-1">
                  <button disabled={busy} onClick={() => play(t)} className="btn-primary btn-sm">
                    Play
                  </button>
                  <button
                    onClick={() => {
                      setEditing({ id: t.id, form: toForm(t) });
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="btn-secondary btn-sm"
                  >
                    Edit
                  </button>
                  <button onClick={() => remove(t)} className="btn-ghost-danger btn-sm" aria-label={`Delete ${t.title}`}>
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

export default function TeasersPage() {
  return (
    <RequireAuth>
      <TeasersInner />
    </RequireAuth>
  );
}
