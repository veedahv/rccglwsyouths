"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addQuestion,
  addQuestions,
  blankProblem,
  deleteQuestion,
  deleteQuestions,
  listQuestions,
  parseBulk,
  seedStarterQuestions,
  updateQuestion,
} from "@/lib/games";
import { useAuth } from "@/lib/useAuth";
import RequireAuth from "@/components/RequireAuth";
import GamesTabs from "@/components/GamesTabs";
import { Page, PageHeader, Card, Field, Badge, Loading, EmptyState, Notice } from "@/components/ui";
import { BIBLE_BOOKS } from "@/lib/bibleBooks";
import { GAME_LABEL } from "@/types/games";
import type { GameKind, GameQuestion } from "@/types/games";

interface FormState {
  category: string;
  emojis: string;
  clues: string; // Who Am I?: one clue per line
  value: string; // quiz board points
  answer: string;
  hint: string;
  statement: string;
  isTrue: boolean;
  reference: string;
}

const EMPTY: FormState = { category: "", emojis: "", clues: "", value: "100", answer: "", hint: "", statement: "", isTrue: true, reference: "" };

function QuestionsInner() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("canEditEvents");

  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<GameKind>("scramble");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [showClear, setShowClear] = useState(false);
  const [clearGames, setClearGames] = useState<GameKind[]>([]);
  const [bulkText, setBulkText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setQuestions(await listQuestions());
    } catch {
      setError("Couldn't load the question bank.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const ofGame = useMemo(() => questions.filter((q) => q.game === game), [questions, game]);
  const categories = useMemo(() => [...new Set(ofGame.map((q) => q.category))].sort(), [ofGame]);
  const allCategories = useMemo(() => [...new Set(questions.map((q) => q.category))].sort(), [questions]);

  const shown = ofGame.filter((q) => {
    if (categoryFilter && q.category !== categoryFilter) return false;
    if (!search) return true;
    const hay = `${q.answer ?? ""} ${q.statement ?? ""} ${q.emojis ?? ""} ${q.hint ?? ""} ${(q.clues ?? []).join(" ")}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  function changeGame(next: GameKind) {
    setGame(next);
    setCategoryFilter("");
    setEditingId(null);
    setForm(EMPTY);
    setShowBulk(false);
  }

  function startEdit(q: GameQuestion) {
    setEditingId(q.id);
    setShowBulk(false);
    setForm({
      category: q.category,
      emojis: q.emojis ?? "",
      clues: (q.clues ?? []).join("\n"),
      value: String(q.value ?? 100),
      answer: q.answer ?? "",
      hint: q.hint ?? "",
      statement: q.statement ?? "",
      isTrue: q.isTrue ?? true,
      reference: (q.isTrue === false ? q.explanation : q.reference) ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const category = form.category.trim();
    if (!category) return setError("Give it a category.");
    if (game === "scramble" && !form.answer.trim()) return setError("Enter the word to unscramble.");
    if (game === "emoji" || game === "bookGuess") {
      if (!form.emojis.trim()) return setError("Enter the emojis.");
      if (!form.answer.trim()) return setError(game === "bookGuess" ? "Enter the book." : "Enter the answer.");
    }
    if (game === "fillBlank") {
      if (!form.statement.trim()) return setError("Enter the verse.");
      const problem = blankProblem(form.statement.trim(), form.answer);
      if (problem) return setError(problem);
    }
    if (game === "bibleOrCap" && !form.statement.trim()) return setError("Enter the quote.");
    const clueLines = form.clues.split("\n").map((c) => c.trim()).filter(Boolean);
    if (game === "whoAmI") {
      if (!form.answer.trim()) return setError("Enter who the answer is.");
      if (clueLines.length < 2) return setError("Add at least two clues, one per line.");
      if (clueLines.length > 8) return setError("Eight clues is the most a round can have.");
    }
    const points = Number(form.value);
    if (game === "board") {
      if (!form.statement.trim()) return setError("Enter the clue.");
      if (!form.answer.trim()) return setError("Enter the answer.");
      if (!Number.isInteger(points) || points <= 0) return setError("Points must be a whole number above zero, like 100.");
    }

    const note = form.reference.trim();
    const hint = form.hint.trim();
    let data: Omit<GameQuestion, "id" | "createdAt">;
    // On edit, empty strings (not undefined) are sent for optional fields so
    // clearing one really clears it; undefined fields are skipped by the save.
    let clearing: Partial<Omit<GameQuestion, "id" | "createdAt">>;
    if (game === "scramble") {
      data = { game, category, answer: form.answer.trim(), hint: hint || undefined };
      clearing = { hint };
    } else if (game === "emoji") {
      data = { game, category, emojis: form.emojis.trim(), answer: form.answer.trim(), hint: hint || undefined, reference: note || undefined };
      clearing = { hint, reference: note };
    } else if (game === "bookGuess") {
      data = { game, category, emojis: form.emojis.trim(), answer: form.answer.trim(), reference: note || undefined };
      clearing = { reference: note };
    } else if (game === "fillBlank") {
      data = { game, category, statement: form.statement.trim(), answer: form.answer.trim(), reference: note || undefined };
      clearing = { reference: note };
    } else if (game === "whoAmI") {
      data = { game, category, answer: form.answer.trim(), clues: clueLines, reference: note || undefined };
      clearing = { reference: note };
    } else if (game === "board") {
      data = { game, category, statement: form.statement.trim(), answer: form.answer.trim(), value: points, reference: note || undefined };
      clearing = { reference: note };
    } else {
      // Scripture keeps a verse; Cap keeps where the saying really comes from.
      data = {
        game,
        category,
        statement: form.statement.trim(),
        isTrue: form.isTrue,
        ...(form.isTrue ? { reference: note || undefined } : { explanation: note || undefined }),
      };
      clearing = { reference: form.isTrue ? note : "", explanation: form.isTrue ? "" : note };
    }

    setBusy(true);
    try {
      if (editingId) {
        await updateQuestion(editingId, { ...data, ...clearing });
        setMessage("Question updated.");
      } else {
        await addQuestion(data);
        setMessage("Question added.");
      }
      setEditingId(null);
      // Keep the category so several questions in a row are quick to add.
      setForm({ ...EMPTY, category });
      await refresh();
    } catch {
      setError("Couldn't save that question.");
    } finally {
      setBusy(false);
    }
  }

  async function handleBulk() {
    setError(null);
    setMessage(null);
    const category = form.category.trim();
    if (!category) return setError("Fill in the category above first.");
    const { questions: parsed, skipped } = parseBulk(game, category, bulkText);
    if (parsed.length === 0) return setError("Nothing to add. Check each line follows the format shown.");
    setBusy(true);
    try {
      await addQuestions(parsed);
      setMessage(`Added ${parsed.length} question${parsed.length === 1 ? "" : "s"}${skipped ? ` (${skipped} line${skipped === 1 ? "" : "s"} skipped)` : ""}.`);
      setBulkText("");
      setShowBulk(false);
      await refresh();
    } catch {
      setError("Couldn't add those questions.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSeed() {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const n = await seedStarterQuestions(questions);
      setMessage(n === 0 ? "The starter questions are already in the bank." : `Added ${n} starter questions.`);
      await refresh();
    } catch {
      setError("Couldn't load the starter questions.");
    } finally {
      setBusy(false);
    }
  }

  const gameKinds = Object.keys(GAME_LABEL) as GameKind[];
  const countOf = (g: GameKind) => questions.filter((q) => q.game === g).length;
  const clearCount = questions.filter((q) => clearGames.includes(q.game)).length;

  function toggleClearGame(g: GameKind) {
    setClearGames((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }

  async function handleClear() {
    const ids = questions.filter((q) => clearGames.includes(q.game)).map((q) => q.id);
    if (ids.length === 0) return;
    const names = clearGames.map((g) => GAME_LABEL[g]).join(" and ");
    if (!window.confirm(`Delete all ${ids.length} ${names} question${ids.length === 1 ? "" : "s"}? This can't be undone. Games already played keep their own copies.`)) return;
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await deleteQuestions(ids);
      setMessage(`Deleted ${ids.length} question${ids.length === 1 ? "" : "s"}.`);
      setClearGames([]);
      setShowClear(false);
      setEditingId(null);
      await refresh();
    } catch {
      setError("Couldn't clear those questions. Some may have been deleted, so check the list.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(q: GameQuestion) {
    if (!window.confirm("Delete this question? Past game sessions are not affected.")) return;
    try {
      await deleteQuestion(q.id);
      setQuestions((prev) => prev.filter((x) => x.id !== q.id));
    } catch {
      setError("Couldn't delete that question.");
    }
  }

  return (
    <Page size="md">
      <PageHeader
        backHref="/games"
        backLabel="Games"
        title="Question bank"
        description="The questions games draw from. Add your own or load the starter set. Editing a question never changes a game that has already been played."
        actions={
          canEdit && (
            <>
              <button onClick={() => setShowClear((v) => !v)} disabled={busy} className="btn-secondary">
                {showClear ? "Cancel clearing" : "Clear questions"}
              </button>
              <button onClick={handleSeed} disabled={busy} className="btn-secondary">
                Load starter questions
              </button>
            </>
          )
        }
      />
      <GamesTabs />

      {canEdit && showClear && (
        <Card
          title="Clear questions"
          description="Choose which games to empty. Questions are deleted for good, but games already played keep their own copies."
          className="mb-6"
        >
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={clearGames.length === gameKinds.length}
                onChange={(e) => setClearGames(e.target.checked ? gameKinds : [])}
                className="h-4 w-4 accent-rccg-red-600"
              />
              Everything ({questions.length})
            </label>
            {gameKinds.map((g) => (
              <label key={g} className="flex cursor-pointer items-center gap-2 pl-6 text-sm">
                <input
                  type="checkbox"
                  checked={clearGames.includes(g)}
                  onChange={() => toggleClearGame(g)}
                  className="h-4 w-4 accent-rccg-red-600"
                />
                {GAME_LABEL[g]} <span className="num text-xs text-muted">{countOf(g)}</span>
              </label>
            ))}
          </div>
          <button onClick={handleClear} disabled={busy || clearCount === 0} className="btn-danger mt-4">
            {clearCount === 0 ? "Delete selected questions" : `Delete ${clearCount} question${clearCount === 1 ? "" : "s"}`}
          </button>
        </Card>
      )}

      <div role="tablist" className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(GAME_LABEL) as GameKind[]).map((g) => (
          <button
            key={g}
            role="tab"
            aria-selected={game === g}
            onClick={() => changeGame(g)}
            className={game === g ? "btn-primary" : "btn-secondary"}
          >
            {GAME_LABEL[g]}
          </button>
        ))}
      </div>

      {error && (
        <Notice tone="error" className="mb-4">
          {error}
        </Notice>
      )}
      {message && (
        <Notice tone="success" className="mb-4">
          {message}
        </Notice>
      )}

      {canEdit && (
        <Card title={editingId ? "Edit question" : "Add a question"} className="mb-6">
          <form onSubmit={handleSave} className="space-y-4">
            <Field label="Category" hint="Pick an existing one or type a new one, e.g. “Bible characters”.">
              <input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                list="game-categories"
                className="input"
                required
              />
              <datalist id="game-categories">
                {allCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>

            {game === "scramble" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Word to unscramble" hint="Two words are fine; each word is scrambled on its own.">
                  <input value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} className="input" />
                </Field>
                <Field label="Hint (optional)">
                  <input value={form.hint} onChange={(e) => setForm({ ...form, hint: e.target.value })} className="input" />
                </Field>
              </div>
            )}

            {game === "emoji" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Emojis" hint="Three or four tell a story best, e.g. 🐋🚢.">
                    <input
                      value={form.emojis}
                      onChange={(e) => setForm({ ...form, emojis: e.target.value })}
                      className="input text-xl"
                    />
                  </Field>
                  <Field label="Answer" hint="The story, character or miracle.">
                    <input value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} className="input" />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Hint (optional)">
                    <input value={form.hint} onChange={(e) => setForm({ ...form, hint: e.target.value })} className="input" />
                  </Field>
                  <Field label="Reference (optional)" hint="Shown when the answer is revealed.">
                    <input
                      value={form.reference}
                      onChange={(e) => setForm({ ...form, reference: e.target.value })}
                      placeholder="Jonah 1-2"
                      className="input"
                    />
                  </Field>
                </div>
              </>
            )}

            {game === "bookGuess" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Emojis" hint="One scene, shown in a few emojis. Could they also fit another book? If so, change them.">
                    <input
                      value={form.emojis}
                      onChange={(e) => setForm({ ...form, emojis: e.target.value })}
                      className="input text-xl"
                    />
                  </Field>
                  <Field label="Book" hint="Easy: Genesis, Psalms. Hard: Obadiah, Habakkuk. Use Easy, Medium or Hard as the category.">
                    <input
                      list="book-names"
                      value={form.answer}
                      onChange={(e) => setForm({ ...form, answer: e.target.value })}
                      className="input"
                    />
                    <datalist id="book-names">
                      {BIBLE_BOOKS.map((b) => (
                        <option key={b.name} value={b.name} />
                      ))}
                    </datalist>
                  </Field>
                </div>
                <Field label="Scene (optional)" hint="Which scene the emojis show. Shown when the book is revealed. A book can have several clues; a game picks one at random.">
                  <input
                    value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
                    placeholder="Noah and the ark (Genesis 6-9)"
                    className="input"
                  />
                </Field>
              </>
            )}

            {game === "fillBlank" && (
              <>
                <Field label="Verse" hint="Type ___ (three underscores) where a word is missing.">
                  <textarea
                    value={form.statement}
                    onChange={(e) => setForm({ ...form, statement: e.target.value })}
                    rows={2}
                    placeholder="The Lord is my ___; I shall not want."
                    className="input"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Missing word(s)" hint="More than one blank? Separate the words with commas, in order.">
                    <input value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} placeholder="shepherd" className="input" />
                  </Field>
                  <Field label="Reference (optional)" hint="Shown when the answer is revealed.">
                    <input
                      value={form.reference}
                      onChange={(e) => setForm({ ...form, reference: e.target.value })}
                      placeholder="Psalm 23:1"
                      className="input"
                    />
                  </Field>
                </div>
              </>
            )}

            {game === "whoAmI" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Who am I?" hint="The answer, e.g. Esther.">
                    <input value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} className="input" />
                  </Field>
                  <Field label="Reference (optional)" hint="Shown when the answer is revealed.">
                    <input
                      value={form.reference}
                      onChange={(e) => setForm({ ...form, reference: e.target.value })}
                      placeholder="Esther 2-7"
                      className="input"
                    />
                  </Field>
                </div>
                <Field label="Clues" hint="One clue per line, 2 to 8. Put the hardest first and the easiest last. Fewer clues shown means more points.">
                  <textarea
                    value={form.clues}
                    onChange={(e) => setForm({ ...form, clues: e.target.value })}
                    rows={6}
                    placeholder={"I was raised by my cousin.\nI became queen of Persia.\nI saved my people from Haman's plot."}
                    className="input"
                  />
                </Field>
              </>
            )}

            {game === "board" && (
              <>
                <Field label="Clue">
                  <textarea
                    value={form.statement}
                    onChange={(e) => setForm({ ...form, statement: e.target.value })}
                    rows={2}
                    placeholder="This man built a large boat at God's command."
                    className="input"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Answer">
                    <input value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} className="input" />
                  </Field>
                  <Field label="Points" hint="100 to 500 gives a classic board.">
                    <input
                      type="number"
                      min={1}
                      step={100}
                      value={form.value}
                      onChange={(e) => setForm({ ...form, value: e.target.value })}
                      className="input"
                    />
                  </Field>
                  <Field label="Reference (optional)">
                    <input
                      value={form.reference}
                      onChange={(e) => setForm({ ...form, reference: e.target.value })}
                      placeholder="Genesis 6"
                      className="input"
                    />
                  </Field>
                </div>
              </>
            )}

            {game === "bibleOrCap" && (
              <>
                <Field label="Quote">
                  <textarea
                    value={form.statement}
                    onChange={(e) => setForm({ ...form, statement: e.target.value })}
                    rows={2}
                    className="input"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Is it Scripture or Cap?">
                    <select
                      value={form.isTrue ? "scripture" : "cap"}
                      onChange={(e) => setForm({ ...form, isTrue: e.target.value === "scripture" })}
                      className="input"
                    >
                      <option value="scripture">Scripture (it is in the Bible)</option>
                      <option value="cap">Cap (not in the Bible)</option>
                    </select>
                  </Field>
                  <Field
                    label={form.isTrue ? "Verse (optional)" : "Where it really comes from (optional)"}
                    hint="Shown when the answer is revealed."
                  >
                    <input
                      value={form.reference}
                      onChange={(e) => setForm({ ...form, reference: e.target.value })}
                      placeholder={form.isTrue ? "Philippians 4:13" : "A saying from…, not the Bible"}
                      className="input"
                    />
                  </Field>
                </div>
              </>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button disabled={busy} className="btn-primary">
                {editingId ? "Save changes" : "Add question"}
              </button>
              {editingId && (
                <button type="button" onClick={cancelEdit} className="btn-secondary">
                  Cancel
                </button>
              )}
              {!editingId && (
                <button type="button" onClick={() => setShowBulk((s) => !s)} className="btn-ghost">
                  {showBulk ? "Hide bulk add" : "Add many at once"}
                </button>
              )}
            </div>

            {showBulk && !editingId && (
              <div className="panel space-y-2">
                <p className="text-sm text-muted">
                  One per line, all under the category above.{" "}
                  {game === "scramble" && (
                    <>
                      Format: <code>word | hint</code> (the hint is optional).
                    </>
                  )}
                  {game === "bibleOrCap" && (
                    <>
                      Format: <code>quote | scripture or cap | note</code>. The note is the verse for Scripture, or where
                      a Cap saying really comes from (optional).
                    </>
                  )}
                  {game === "emoji" && (
                    <>
                      Format: <code>emojis | answer | hint | reference</code> (hint and reference are optional).
                    </>
                  )}
                  {game === "bookGuess" && (
                    <>
                      Format: <code>emojis | book | scene</code> (scene optional). Use Easy, Medium or Hard as the category. Give a book
                      several lines for several clues, each showing one scene that fits only that book.
                    </>
                  )}
                  {game === "whoAmI" && (
                    <>
                      Format: <code>answer | clue 1 | clue 2 | clue 3 …</code>. Hardest clue first, at least two clues.
                    </>
                  )}
                  {game === "board" && (
                    <>
                      Format: <code>clue | answer | points | reference</code> (reference optional). Use one category per
                      batch, and give each point level its own line.
                    </>
                  )}
                  {game === "fillBlank" && (
                    <>
                      Format: <code>verse with ___ | missing words | reference</code>. Several missing words are
                      separated by commas, in order. Lines whose blanks and words don&rsquo;t match are skipped.
                    </>
                  )}
                </p>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={6}
                  className="input font-mono"
                  placeholder={
                    game === "scramble"
                      ? "Moses | Led Israel out of Egypt\nEsther | Became queen and saved her people"
                      : game === "bookGuess"
                        ? "🐋🧍‍♂️ | Jonah | Jonah swallowed by a great fish (Jonah 1-2)\n🌧️🚢🐘🦁 | Genesis | Noah and the ark (Genesis 6-9)"
                      : game === "emoji"
                        ? "🐋🚢 | Jonah | Swallowed by a great fish | Jonah 1-2\n⭐🐪🎁 | The wise men"
                        : game === "whoAmI"
                          ? "Esther | I was raised by my cousin. | I became queen of Persia. | I saved my people from Haman's plot."
                          : game === "board"
                            ? "This man built a large boat at God's command. | Noah | 100 | Genesis 6\nThe first book of the Bible. | Genesis | 200"
                            : game === "fillBlank"
                          ? "The Lord is my ___; I shall not want. | shepherd | Psalm 23:1\nSo now faith, ___, and love abide; the greatest of these is ___. | hope, love | 1 Corinthians 13:13"
                          : "I can do all things through Christ who strengthens me. | scripture | Philippians 4:13\nGod helps those who help themselves. | cap | Aesop and Benjamin Franklin"
                  }
                />
                <button type="button" onClick={handleBulk} disabled={busy || !bulkText.trim()} className="btn-secondary">
                  Add these questions
                </button>
              </div>
            )}
          </form>
        </Card>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="input w-auto" aria-label="Filter by category">
          <option value="">All categories ({ofGame.length})</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c} ({ofGame.filter((q) => q.category === c).length})
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          aria-label="Search questions"
          className="input w-48"
        />
      </div>

      {loading ? (
        <Loading />
      ) : shown.length === 0 ? (
        <EmptyState
          title={ofGame.length === 0 ? `No ${GAME_LABEL[game]} questions yet` : "No questions match"}
          description={ofGame.length === 0 && canEdit ? "Load the starter questions or add your own above." : undefined}
        />
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-white">
          {shown.map((q) => (
            <li key={q.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                {q.game === "scramble" && (
                  <>
                    <p className="font-semibold text-rccg-purple-800">{q.answer}</p>
                    {q.hint && <p className="text-sm text-muted">{q.hint}</p>}
                  </>
                )}
                {q.game === "emoji" && (
                  <>
                    <p className="text-2xl leading-tight">{q.emojis}</p>
                    <p className="font-semibold text-rccg-purple-800">{q.answer}</p>
                    {(q.hint || q.reference) && (
                      <p className="text-sm text-muted">{[q.hint, q.reference].filter(Boolean).join(" · ")}</p>
                    )}
                  </>
                )}
                {q.game === "bookGuess" && (
                  <>
                    <p className="text-2xl leading-tight">{q.emojis}</p>
                    <p className="font-semibold text-rccg-purple-800">{q.answer}</p>
                    {q.reference && <p className="text-sm text-muted">{q.reference}</p>}
                  </>
                )}
                {q.game === "whoAmI" && (
                  <>
                    <p className="font-semibold text-rccg-purple-800">{q.answer}</p>
                    <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-muted">
                      {(q.clues ?? []).map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ol>
                  </>
                )}
                {q.game === "board" && (
                  <>
                    <p className="text-sm text-ink">
                      <span className="num mr-2 inline-block rounded-md bg-rccg-purple-700 px-1.5 py-0.5 text-xs font-bold text-white">
                        {q.value}
                      </span>
                      {q.statement}
                    </p>
                    <p className="mt-1 text-sm">
                      <span className="font-semibold text-rccg-purple-800">{q.answer}</span>
                      {q.reference && <span className="text-muted"> · {q.reference}</span>}
                    </p>
                  </>
                )}
                {q.game === "fillBlank" && (
                  <>
                    <p className="text-sm text-ink">&ldquo;{q.statement}&rdquo;</p>
                    <p className="mt-1 text-sm">
                      <span className="font-semibold text-rccg-purple-800">{q.answer}</span>
                      {q.reference && <span className="text-muted"> · {q.reference}</span>}
                    </p>
                  </>
                )}
                {q.game === "bibleOrCap" && (
                  <>
                    <p className="text-sm text-ink">&ldquo;{q.statement}&rdquo;</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <Badge tone={q.isTrue ? "green" : "red"}>{q.isTrue ? "Scripture" : "Cap"}</Badge>
                      {q.isTrue ? q.reference : q.explanation}
                    </p>
                  </>
                )}
                <p className="mt-1 text-xs text-muted">{q.category}</p>
              </div>
              {canEdit && (
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => startEdit(q)} className="btn-ghost">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(q)} className="btn-ghost-danger">
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

export default function QuestionBankPage() {
  return (
    <RequireAuth>
      <QuestionsInner />
    </RequireAuth>
  );
}
