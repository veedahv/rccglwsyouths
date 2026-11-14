"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import {
  buildYearReview,
  getYearReviewExtras,
  saveYearReviewExtras,
  type ReviewHighlight,
  type YearReviewData,
  MAX_ORDER_STEPS,
} from "@/lib/yearReview";
import { Card, Notice } from "@/components/ui";
import YearReviewSlides from "@/components/YearReviewSlides";
import YearReviewExportMenu from "@/components/YearReviewExportMenu";
import { MEMORY_CAPACITY } from "@/components/YearReviewSlides";
import {
  MAX_SESSION_PHOTOS,
  getSessionPhotos,
  readPhotoFile,
  setSessionPhotos,
  type MemoryPhoto,
  type SessionPhoto,
} from "@/lib/yearReviewPhotos";

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * The yearly planner's "Year in review" card: plays the end-of-year slideshow, and lets whoever
 * manages events add the things the app doesn't know about (an event that was never added, a
 * milestone, a win) and a tagline for the first slide.
 */
export default function YearReviewCard() {
  const { user, hasPermission } = useAuth();
  const canEdit = hasPermission("canEditEvents");
  const thisYear = new Date().getFullYear();
  const years = [thisYear - 1, thisYear];

  const [year, setYear] = useState(thisYear);
  const [playing, setPlaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [tagline, setTagline] = useState("");
  const [highlights, setHighlights] = useState<ReviewHighlight[]>([]);
  const [saving, setSaving] = useState(false);
  // Memories pictures: kept in memory only (a refresh clears them), see lib/yearReviewPhotos.ts.
  const [photos, setPhotos] = useState<SessionPhoto[]>(() => getSessionPhotos());
  const [showPhotos, setShowPhotos] = useState(false);
  const [reading, setReading] = useState(false);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    setMessage(null);
    getYearReviewExtras(year)
      .then((x) => {
        if (cancelled) return;
        setTagline(x.tagline ?? "");
        setHighlights(x.highlights);
      })
      .catch(() => !cancelled && setMessage({ tone: "error", text: "Couldn't load the saved highlights." }));
    return () => {
      cancelled = true;
    };
  }, [editing, year]);

  function updatePhotos(next: SessionPhoto[]) {
    setPhotos(next);
    setSessionPhotos(next);
  }

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setReading(true);
    setPhotoNote(null);
    const room = Math.max(0, MAX_SESSION_PHOTOS - photos.length);
    const picked = Array.from(files).slice(0, room);
    const next = [...photos];
    const failed: string[] = [];
    for (const file of picked) {
      try {
        next.push(await readPhotoFile(file));
      } catch {
        failed.push(file.name);
      }
    }
    updatePhotos(next);
    const notes: string[] = [];
    if (files.length > room) notes.push(`Only ${MAX_SESSION_PHOTOS} pictures can be added, so ${files.length - room} were skipped.`);
    if (failed.length > 0) notes.push(`Couldn't read ${failed.join(", ")}. Try a JPG or PNG.`);
    setPhotoNote(notes.length > 0 ? notes.join(" ") : null);
    setReading(false);
  }

  const shown = (o: MemoryPhoto["orientation"]) => photos.filter((p) => p.orientation === o).length;
  const photoWithPictures = (data: YearReviewData): YearReviewData => (photos.length > 0 ? { ...data, memoryPhotos: photos } : data);

  // Moves a step of a highlight's order of events up or down.
  function moveStep(h: ReviewHighlight, i: number, by: -1 | 1) {
    const order = [...(h.order ?? [])];
    const j = i + by;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    updateHighlight(h.id, { order });
  }

  function updateHighlight(id: string, patch: Partial<ReviewHighlight>) {
    setHighlights((list) => list.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    setMessage(null);
    try {
      await saveYearReviewExtras(year, { tagline, highlights }, user.uid);
      setHighlights((list) => list.filter((h) => h.title.trim()));
      setMessage({ tone: "success", text: "Saved. They will show in the slideshow." });
    } catch (err) {
      console.error(err);
      setMessage({ tone: "error", text: "Couldn't save. Check your connection and try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Year in review"
      description="A slideshow to wrap up the year: events, games, giving, the books and the plans for next year."
      className="mb-6"
      action={
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="review-year">
            Year to review
          </label>
          <select id="review-year" value={year} onChange={(e) => setYear(Number(e.target.value))} className="input !w-auto">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <YearReviewExportMenu year={year} getData={async () => photoWithPictures(await buildYearReview(year))} />
          <button type="button" onClick={() => setPlaying(true)} className="btn-primary">
            ▶ Play
          </button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <p>
          Uses completed events (with their after-event reports), game days, contribution drives, the financial totals and next
          year&apos;s plans from this page.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setShowPhotos((v) => !v)} className="btn-ghost">
            {showPhotos ? "Done" : photos.length > 0 ? `Memories pictures (${photos.length})` : "Add memories pictures"}
          </button>
          {canEdit && (
            <button type="button" onClick={() => setEditing((v) => !v)} className="btn-ghost">
              {editing ? "Done" : "Add highlights & tagline"}
            </button>
          )}
        </div>
      </div>

      {showPhotos && (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <div>
            <p className="label">Pictures for the memories slides</p>
            <p className="text-xs text-muted">
              Choose the pictures to show on the last two slides. They stay in this browser tab only: nothing is uploaded or
              saved, so if you refresh the page you will need to add them again. There is room for 6 portraits, 8 landscapes
              and 2 squares; each one is shrunk and fitted into a frame of its shape.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="btn-secondary cursor-pointer">
              {reading ? "Reading pictures…" : "Choose pictures"}
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={reading}
                className="sr-only"
                onChange={(e) => {
                  void addFiles(e.target.files);
                  e.target.value = ""; // so choosing the same file again works
                }}
              />
            </label>
            {photos.length > 0 && (
              <button type="button" onClick={() => updatePhotos([])} className="btn-ghost-danger btn-sm">
                Remove all
              </button>
            )}
          </div>

          {photos.length > 0 && (
            <>
              <p className="text-sm text-ink">
                {(["portrait", "landscape", "square"] as const).map((o, i) => {
                  const over = shown(o) > MEMORY_CAPACITY[o];
                  return (
                    <span key={o}>
                      {i > 0 && " · "}
                      <span className={over ? "font-semibold text-rccg-red-700" : undefined}>
                        {o === "portrait" ? "Portraits" : o === "landscape" ? "Landscapes" : "Squares"} {shown(o)} of {MEMORY_CAPACITY[o]}
                      </span>
                    </span>
                  );
                })}
              </p>
              {(["portrait", "landscape", "square"] as const).some((o) => shown(o) > MEMORY_CAPACITY[o]) && (
                <p className="text-xs text-rccg-red-700">
                  Some pictures won&apos;t fit in a frame of their shape and will be left out. Change a picture&apos;s shape below
                  to use a different kind of frame, or remove it.
                </p>
              )}
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {photos.map((p) => (
                  <li key={p.id} className="rounded-xl border border-line bg-white/70 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.src} alt={p.name} className="h-24 w-full rounded-lg object-cover" />
                    <select
                      value={p.orientation}
                      onChange={(e) =>
                        updatePhotos(photos.map((x) => (x.id === p.id ? { ...x, orientation: e.target.value as MemoryPhoto["orientation"] } : x)))
                      }
                      aria-label={`Shape of ${p.name}`}
                      className="input mt-2 !py-1 text-sm"
                    >
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                      <option value="square">Square</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => updatePhotos(photos.filter((x) => x.id !== p.id))}
                      className="btn-ghost-danger btn-sm mt-1 w-full"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {photoNote && <Notice tone="warning">{photoNote}</Notice>}
        </div>
      )}

      {editing && canEdit && (
        <div className="mt-4 space-y-4 border-t border-line pt-4">
          <div>
            <label className="label" htmlFor="review-tagline">
              Tagline for the first slide <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="review-tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g. A year of growing together"
              className="input"
              maxLength={90}
            />
          </div>

          <div>
            <p className="label">Events &amp; highlights not in the app</p>
            <p className="mb-2 text-xs text-muted">
              For an event that was never added, a milestone or a win. Give it a date, a short summary, the order of events
              and, if there were games, which ones and whether they were outdoors. They appear among the events, in date order.
            </p>
            <div className="space-y-3">
              {highlights.map((h) => (
                <div key={h.id} className="rounded-xl border border-line bg-white/70 p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input
                      value={h.title}
                      onChange={(e) => updateHighlight(h.id, { title: e.target.value })}
                      placeholder="Event or highlight, e.g. Valentine's Outing"
                      aria-label="Highlight title"
                      className="input"
                      maxLength={80}
                    />
                    <input
                      type="date"
                      value={h.date ?? ""}
                      onChange={(e) => updateHighlight(h.id, { date: e.target.value || undefined })}
                      aria-label="Highlight date"
                      className="input !w-auto"
                    />
                  </div>
                  <textarea
                    value={h.note ?? ""}
                    onChange={(e) => updateHighlight(h.id, { note: e.target.value })}
                    placeholder="Summary: how did it go? A few sentences (the slide shows the first few lines)"
                    aria-label="Summary"
                    rows={3}
                    maxLength={500}
                    className="input mt-2"
                  />
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-ink">Order of events</p>
                    <p className="mb-1.5 text-xs text-muted">
                      What happened, step by step, e.g. meet up at church, jog to the venue, warm up, games, group pictures.
                      It shows on the event&apos;s card.
                    </p>
                    <ol className="space-y-1.5">
                      {(h.order ?? []).map((step, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="w-5 shrink-0 text-right text-sm text-muted">{i + 1}.</span>
                          <input
                            value={step}
                            onChange={(e) =>
                              updateHighlight(h.id, { order: (h.order ?? []).map((s, k) => (k === i ? e.target.value : s)) })
                            }
                            placeholder={i === 0 ? "e.g. Meet up at church" : "Next step"}
                            aria-label={`Step ${i + 1}`}
                            className="input"
                            maxLength={60}
                          />
                          <button
                            type="button"
                            onClick={() => moveStep(h, i, -1)}
                            disabled={i === 0}
                            aria-label="Move step up"
                            className="btn-ghost btn-sm"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveStep(h, i, 1)}
                            disabled={i === (h.order ?? []).length - 1}
                            aria-label="Move step down"
                            className="btn-ghost btn-sm"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => updateHighlight(h.id, { order: (h.order ?? []).filter((_, k) => k !== i) })}
                            aria-label="Remove step"
                            className="btn-ghost-danger btn-sm"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ol>
                    {(h.order ?? []).length < MAX_ORDER_STEPS ? (
                      <button
                        type="button"
                        onClick={() => updateHighlight(h.id, { order: [...(h.order ?? []), ""] })}
                        className="btn-ghost btn-sm mt-1.5"
                      >
                        + Add a step
                      </button>
                    ) : (
                      <p className="mt-1.5 text-xs text-muted">That&apos;s the most that fits on a slide ({MAX_ORDER_STEPS} steps).</p>
                    )}
                  </div>

                  <div className="mt-3 rounded-lg bg-mist/70 p-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
                      <input
                        type="checkbox"
                        checked={Boolean(h.hadGames)}
                        onChange={(e) => updateHighlight(h.id, { hadGames: e.target.checked })}
                        className="h-4 w-4 accent-[#028A2C]"
                      />
                      There were games at this event
                    </label>
                    {h.hadGames && (
                      <div className="mt-2 space-y-2">
                        <input
                          value={h.games ?? ""}
                          onChange={(e) => updateHighlight(h.id, { games: e.target.value })}
                          placeholder="Which games? Separate with commas, e.g. Race, egg race, football"
                          aria-label="Games played"
                          className="input"
                          maxLength={120}
                        />
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                          <input
                            type="checkbox"
                            checked={Boolean(h.outdoorGames)}
                            onChange={(e) => updateHighlight(h.id, { outdoorGames: e.target.checked })}
                            className="h-4 w-4 accent-[#028A2C]"
                          />
                          The games were outdoors
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={() => setHighlights((list) => list.filter((x) => x.id !== h.id))}
                      className="btn-ghost-danger btn-sm"
                    >
                      Remove this event
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setHighlights((list) => [...list, { id: newId(), title: "" }])}
              className="btn-secondary btn-sm mt-3"
            >
              + Add an event or highlight
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button type="button" onClick={save} disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Save"}
            </button>
            {message && <Notice tone={message.tone}>{message.text}</Notice>}
          </div>
        </div>
      )}

      {playing && <YearReviewSlides year={year} onClose={() => setPlaying(false)} photos={photos} />}
    </Card>
  );
}
