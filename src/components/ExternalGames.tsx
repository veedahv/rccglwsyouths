"use client";

import { useState } from "react";
import { addExternalGame, deleteExternalGame, resultLine, updateExternalGame, withoutHosts } from "@/lib/externalGames";
import HostPicker from "@/components/HostPicker";
import ExternalTeamsGame from "@/components/ExternalTeamsGame";
import ExternalRoundsGame from "@/components/ExternalRoundsGame";
import { Badge, Card, Field, Notice } from "@/components/ui";
import { EXTERNAL_FORMAT_LABEL } from "@/types/games";
import type { ExternalFormat, ExternalGame, GamePlayer } from "@/types/games";
import type { Youth } from "@/types";

const SUGGESTIONS: { title: string; format: ExternalFormat }[] = [
  { title: "Football", format: "teams" },
  { title: "Tug of war", format: "teams" },
  { title: "Egg race", format: "rounds" },
  { title: "Sack race", format: "rounds" },
  { title: "Relay race", format: "rounds" },
];

interface Props {
  eventId: string;
  games: ExternalGame[];
  /** Everyone who can play: the people present (or every active youth if no one is marked present), plus guests. Hosts are taken out per game. */
  pool: GamePlayer[];
  youths: Youth[];
  presentIds: string[] | null; // listed first when choosing hosts; null if attendance wasn't taken
  canEdit: boolean;
}

/**
 * Games played for real (football, egg race…) and only recorded here. Each has its own hosts,
 * and is either two or more teams with a score, or rounds of players with the places they finished in.
 */
export default function ExternalGames({ eventId, games, pool, youths, presentIds, canEdit }: Props) {
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New game form
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<ExternalFormat>("teams");
  const [hosts, setHosts] = useState<GamePlayer[]>([]);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setTitle("");
    setFormat("teams");
    setHosts([]);
    setAdding(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Give the game a name, like Football or Egg race.");
    setError(null);
    setSaving(true);
    try {
      const id = await addExternalGame(eventId, { title, format, hosts });
      setOpenId(id);
      resetForm();
    } catch {
      setError("Couldn't add this game. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function save(game: ExternalGame, patch: Partial<Omit<ExternalGame, "id">>) {
    updateExternalGame(eventId, game.id, patch).catch(() => setError("That didn't save. Check your connection and try again."));
  }

  function changeHosts(game: ExternalGame, next: GamePlayer[]) {
    // Someone who becomes a host stops playing, so they come off any team or round.
    save(game, withoutHosts(game, next));
  }

  async function handleDelete(game: ExternalGame) {
    if (!window.confirm(`Delete “${game.title}”? Its teams, scores and places will be gone.`)) return;
    try {
      await deleteExternalGame(eventId, game.id);
      if (openId === game.id) setOpenId(null);
    } catch {
      setError("Couldn't delete that game.");
    }
  }

  return (
    <Card
      title="Games played away from the screen"
      description="Football, egg race and other real games. Record the teams and score, or the rounds and who came first, second and third. Every game has its own host."
      action={
        canEdit && (
          <button onClick={() => (adding ? resetForm() : setAdding(true))} className={adding ? "btn-secondary" : "btn-primary"}>
            {adding ? "Cancel" : "Add a game"}
          </button>
        )
      }
    >
      {error && (
        <Notice tone="error" className="mb-3">
          {error}
        </Notice>
      )}

      {adding && canEdit && (
        <form onSubmit={handleAdd} className="mb-5 space-y-4 rounded-xl border border-line bg-mist p-4">
          <Field label="Game">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Football" className="input" autoFocus />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.title}
                type="button"
                onClick={() => {
                  setTitle(s.title);
                  setFormat(s.format);
                }}
                className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-rccg-purple-800 hover:border-rccg-purple-300"
              >
                {s.title}
              </button>
            ))}
          </div>

          <fieldset>
            <legend className="label">How is it played?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["teams", "rounds"] as ExternalFormat[]).map((f) => (
                <label
                  key={f}
                  className={[
                    "flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm transition-colors",
                    format === f ? "border-rccg-green-500 bg-rccg-green-50" : "border-line bg-white hover:border-rccg-purple-300",
                  ].join(" ")}
                >
                  <input type="radio" name="external-format" checked={format === f} onChange={() => setFormat(f)} className="mt-0.5 accent-rccg-green-600" />
                  <span>
                    <span className="block font-medium">{EXTERNAL_FORMAT_LABEL[f]}</span>
                    <span className="block text-xs text-muted">
                      {f === "teams" ? "Teams play for a score, like football. Boys vs Girls, a random draw, or picked by hand." : "Groups of people run in turns, like an egg race. Note who came 1st, 2nd, 3rd."}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <span className="label">Host of this game</span>
            <HostPicker hosts={hosts} youths={youths} presentIds={presentIds} canEdit onChange={setHosts} emptyText="No host yet. You can add one now or later." />
          </div>

          <button disabled={saving} className="btn-primary">
            {saving ? "Adding…" : "Add game"}
          </button>
        </form>
      )}

      {games.length === 0 ? (
        <p className="py-3 text-sm text-muted">No games recorded yet.</p>
      ) : (
        <ul className="space-y-2">
          {games.map((g) => {
            const open = openId === g.id;
            return (
              <li key={g.id} className="rounded-lg border border-line bg-white">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : g.id)}
                  aria-expanded={open}
                  className="flex w-full flex-wrap items-center gap-3 p-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-rccg-purple-800">{g.title}</p>
                    <p className="text-xs text-muted">{resultLine(g)}</p>
                    <p className="text-xs text-muted">{g.hosts.length > 0 ? `Hosted by ${g.hosts.map((h) => h.name).join(", ")}` : "No host yet"}</p>
                  </div>
                  <Badge tone="purple">{g.format === "teams" ? "Teams" : "Rounds"}</Badge>
                  <Badge tone={g.status === "finished" ? "gray" : "green"} dot={g.status !== "finished"}>
                    {g.status === "finished" ? "Finished" : "Live"}
                  </Badge>
                  <span className="text-muted" aria-hidden="true">
                    {open ? "▲" : "▼"}
                  </span>
                </button>

                {open && (
                  <div className="space-y-4 border-t border-line p-4">
                    <div>
                      <span className="label">{g.hosts.length === 1 ? "Host" : "Hosts"}</span>
                      <HostPicker hosts={g.hosts} youths={youths} presentIds={presentIds} canEdit={canEdit} onChange={(h) => changeHosts(g, h)} />
                    </div>

                    {g.format === "teams" ? (
                      <ExternalTeamsGame game={g} pool={pool} canEdit={canEdit} onSave={(patch) => save(g, patch)} />
                    ) : (
                      <ExternalRoundsGame game={g} pool={pool} canEdit={canEdit} onSave={(patch) => save(g, patch)} />
                    )}

                    {canEdit && (
                      <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-3">
                        <button
                          onClick={() => save(g, { status: g.status === "finished" ? "live" : "finished" })}
                          className={g.status === "finished" ? "btn-secondary btn-sm" : "btn-primary btn-sm"}
                        >
                          {g.status === "finished" ? "Reopen" : "Mark as finished"}
                        </button>
                        <button onClick={() => handleDelete(g)} className="btn-ghost-danger btn-sm">
                          Delete game
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
