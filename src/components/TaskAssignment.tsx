"use client";

import { useState } from "react";
import { formatPersonName } from "@/lib/formatName";
import { formatDate } from "@/lib/format";
import { Badge, Tone } from "@/components/ui";
import type { EventTask, ExcoMember, Youth } from "@/types";

interface Props {
  tasks: EventTask[];
  excos: ExcoMember[];
  youths: Youth[];
  canEdit: boolean;
  onChange: (tasks: EventTask[]) => void; // caller persists (updateEventTasks)
  // Wording overrides so the same component serves event tasks and
  // after-meeting actions.
  emptyLabel?: string;
  placeholder?: string;
  addLabel?: string;
}

const STATUS_LABEL: Record<EventTask["status"], string> = {
  pending: "Pending",
  in_progress: "In progress",
  done: "Done",
};

const STATUS_TONE: Record<EventTask["status"], Tone> = {
  pending: "gray",
  in_progress: "amber",
  done: "green",
};

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function TaskAssignment({
  tasks,
  excos,
  youths,
  canEdit,
  onChange,
  emptyLabel = "No tasks assigned yet.",
  placeholder = "Task",
  addLabel = "Add task",
}: Props) {
  const [title, setTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");

  function addTask() {
    if (!title.trim() || !assignedTo) return;
    onChange([
      ...tasks,
      { id: genId(), title, assignedTo, status: "pending", dueDate: dueDate || undefined },
    ]);
    setTitle("");
    setAssignedTo("");
    setDueDate("");
  }

  function updateStatus(id: string, status: EventTask["status"]) {
    onChange(tasks.map((t) => (t.id === id ? { ...t, status } : t)));
  }

  function removeTask(id: string) {
    onChange(tasks.filter((t) => t.id !== id));
  }

  // Excos are checked first so an id shared between an exco and a youth
  // (shouldn't happen in practice — different Firestore ID spaces) still
  // resolves sensibly, and so the common case (assigning to an exco) is
  // the first lookup rather than the second.
  function assigneeName(id: string) {
    const exco = excos.find((m) => m.id === id);
    if (exco) return formatPersonName(exco.name, exco.gender);
    const youth = youths.find((y) => y.id === id);
    if (youth) return formatPersonName(youth.name, youth.gender);
    return "—";
  }

  return (
    <div>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted">{emptyLabel}</p>
      ) : (
        <ul className="mb-4 divide-y divide-line text-sm">
          {tasks.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0">
              <div className="min-w-0">
                <p className={`font-medium ${t.status === "done" ? "text-muted line-through" : "text-ink"}`}>
                  {t.title}
                </p>
                <p className="text-xs text-muted">
                  {assigneeName(t.assignedTo)}
                  {t.dueDate && `, due ${formatDate(t.dueDate)}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {canEdit ? (
                  <select
                    value={t.status}
                    onChange={(e) => updateStatus(t.id, e.target.value as EventTask["status"])}
                    aria-label={`Status of ${t.title}`}
                    className="input w-auto py-1 text-xs"
                  >
                    {Object.entries(STATUS_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge>
                )}
                {canEdit && (
                  <button onClick={() => removeTask(t.id)} className="btn-ghost-danger">
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-end gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="input min-w-[10rem] flex-1"
          />
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            aria-label="Assign to"
            className="input w-auto"
          >
            <option value="">Assign to…</option>
            <optgroup label="Excos">
              {excos.map((m) => (
                <option key={m.id} value={m.id}>
                  {formatPersonName(m.name, m.gender)}
                </option>
              ))}
            </optgroup>
            <optgroup label="Youths">
              {youths.map((y) => (
                <option key={y.id} value={y.id}>
                  {formatPersonName(y.name, y.gender)}
                </option>
              ))}
            </optgroup>
          </select>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            aria-label="Due date (optional)"
            className="input w-auto"
          />
          <button onClick={addTask} className="btn-primary">
            {addLabel}
          </button>
        </div>
      )}
    </div>
  );
}
