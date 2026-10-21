"use client";

import { useState } from "react";
import { formatPersonName } from "@/lib/formatName";
import { formatDate } from "@/lib/format";
import { youthsNotInExcos } from "@/lib/excos";
import Modal, { ConfirmDialog } from "@/components/Modal";
import { Badge, Field, Notice, Tone } from "@/components/ui";
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

/**
 * Who needs to do what. The list reads cleanly, with the status changeable
 * right on the row; adding and editing a task happen in a dialog.
 */
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
  const [editing, setEditing] = useState<EventTask | "new" | null>(null);
  const [deleting, setDeleting] = useState<EventTask | null>(null);

  function updateStatus(id: string, status: EventTask["status"]) {
    onChange(tasks.map((t) => (t.id === id ? { ...t, status } : t)));
  }

  function save(task: EventTask) {
    onChange(editing === "new" ? [...tasks, task] : tasks.map((t) => (t.id === task.id ? task : t)));
    setEditing(null);
  }

  function remove() {
    if (!deleting) return;
    onChange(tasks.filter((t) => t.id !== deleting.id));
    setDeleting(null);
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
        <p className="mb-3 text-sm text-muted">{emptyLabel}</p>
      ) : (
        <ul className="mb-3 divide-y divide-line/70 text-sm">
          {tasks.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0">
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${t.status === "done" ? "text-muted line-through" : "text-ink"}`}>{t.title}</p>
                <p className="text-xs text-muted">
                  {assigneeName(t.assignedTo)}
                  {t.dueDate && ` · due ${formatDate(t.dueDate)}`}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
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
                  <button type="button" onClick={() => setEditing(t)} className="btn-ghost" aria-label={`Edit ${t.title}`}>
                    Edit
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <button type="button" onClick={() => setEditing("new")} className="btn-secondary btn-sm w-full border-dashed">
          + {addLabel}
        </button>
      )}

      {editing !== null && (
        <TaskModal
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
          excos={excos}
          youths={youths}
          placeholder={placeholder}
          addLabel={addLabel}
          onSave={save}
          onClose={() => setEditing(null)}
          onRemove={() => {
            if (editing !== "new") setDeleting(editing);
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          open
          title="Remove this?"
          subject={{ name: deleting.title, detail: assigneeName(deleting.assignedTo) }}
          tone="danger"
          confirmLabel="Remove"
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function TaskModal({
  initial,
  excos,
  youths,
  placeholder,
  addLabel,
  onSave,
  onClose,
  onRemove,
}: {
  initial: EventTask | null;
  excos: ExcoMember[];
  youths: Youth[];
  placeholder: string;
  addLabel: string;
  onSave: (task: EventTask) => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [assignedTo, setAssignedTo] = useState(initial?.assignedTo ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [status, setStatus] = useState<EventTask["status"]>(initial?.status ?? "pending");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Enter the task.");
    if (!assignedTo) return setError("Choose who it is assigned to.");
    // Firestore rejects `undefined`, so a blank due date is left out.
    onSave({
      id: initial?.id ?? genId(),
      title: title.trim(),
      assignedTo,
      status,
      ...(dueDate ? { dueDate } : {}),
    });
  }

  return (
    <Modal
      open
      title={initial ? "Edit" : addLabel}
      onClose={onClose}
      footer={
        <>
          {initial && (
            <button type="button" onClick={onRemove} className="btn-ghost-danger mr-auto">
              Remove
            </button>
          )}
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" form="task-form" className="btn-primary">
            {initial ? "Save changes" : addLabel}
          </button>
        </>
      }
    >
      <form id="task-form" onSubmit={submit} className="space-y-4">
        <Field label="What needs doing">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={placeholder} className="input" />
        </Field>
        <Field label="Assigned to">
          <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="input">
            <option value="">Choose…</option>
            <optgroup label="Excos">
              {excos.map((m) => (
                <option key={m.id} value={m.id}>
                  {formatPersonName(m.name, m.gender)}
                </option>
              ))}
            </optgroup>
            <optgroup label="Youths">
              {/* Youths who are excos are already listed above — not offered twice. */}
              {youthsNotInExcos(youths, excos).map((y) => (
                <option key={y.id} value={y.id}>
                  {formatPersonName(y.name, y.gender)}
                </option>
              ))}
            </optgroup>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Due date (optional)">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" />
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as EventTask["status"])} className="input">
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
      </form>
    </Modal>
  );
}
