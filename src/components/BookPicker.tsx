"use client";

import { useMemo, useState } from "react";
import { BIBLE_BOOKS, type BibleBook } from "@/lib/bibleBooks";
import { normalize } from "@/lib/teasers";

interface Props {
  /** Called with the book's name when one is tapped (or Enter is pressed on a filtered result). */
  onPick: (name: string) => void;
  /** Books to mark: already named in a game, or ticked while building a teaser. */
  marked?: string[];
  /** "select" is for building a teaser: marked books show a tick, and tapping toggles. */
  mode?: "pick" | "select";
  disabled?: boolean;
}

function groupBooks(books: BibleBook[]): [string, BibleBook[]][] {
  const out: [string, BibleBook[]][] = [];
  for (const b of books) {
    const last = out[out.length - 1];
    if (last && last[0] === b.group) last[1].push(b);
    else out.push([b.group, [b]]);
  }
  return out;
}

/**
 * All 66 books, split into the Old and New Testament and grouped, with a quick filter.
 * Numbered books are their own buttons. It is used by the teaser host and the teaser
 * builder, and is meant to be reused wherever a book has to be chosen.
 */
export default function BookPicker({ onPick, marked = [], mode = "pick", disabled }: Props) {
  const [filter, setFilter] = useState("");
  const markedSet = new Set(marked);

  const shown = useMemo(() => {
    const q = normalize(filter);
    if (!q) return BIBLE_BOOKS;
    return BIBLE_BOOKS.filter((b) => [b.name, ...(b.aliases ?? [])].some((n) => normalize(n).includes(q)));
  }, [filter]);

  function button(b: BibleBook) {
    const on = markedSet.has(b.name);
    return (
      <button
        key={b.name}
        type="button"
        disabled={disabled}
        onClick={() => onPick(b.name)}
        aria-pressed={mode === "select" ? on : undefined}
        className={[
          "rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
          on
            ? mode === "select"
              ? "border-rccg-green-500 bg-rccg-green-50 text-rccg-green-700"
              : "border-line bg-gray-100 text-muted line-through"
            : "border-line bg-white hover:border-rccg-purple-300 hover:bg-rccg-purple-50",
        ].join(" ")}
      >
        {mode === "select" && on && <span aria-hidden="true">✓ </span>}
        {b.name}
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && shown.length >= 1 && filter.trim()) {
            e.preventDefault();
            onPick(shown[0].name);
            setFilter("");
          }
        }}
        placeholder="Filter books, then press Enter to pick the first…"
        aria-label="Filter books"
        className="input py-1.5"
        disabled={disabled}
      />
      {shown.length === 0 && <p className="text-sm text-muted">No book matches &ldquo;{filter}&rdquo;. Pressing Enter does nothing.</p>}
      {(["Old", "New"] as const).map((testament) => {
        const groups = groupBooks(shown.filter((b) => b.testament === testament));
        if (groups.length === 0) return null;
        return (
          <section key={testament}>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-rccg-purple-700">{testament} Testament</h3>
            <div className="space-y-2">
              {groups.map(([group, list]) => (
                <div key={group} className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 w-28 shrink-0 text-xs text-muted">{group}</span>
                  {list.map(button)}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
