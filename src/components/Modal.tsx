"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { Notice } from "@/components/ui";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  /** While something is saving, Esc and clicking outside don't close it. */
  busy?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  /** "md" suits a question or a small form; "xl" is a tall, wide panel for previews. */
  size?: "md" | "xl";
}

/**
 * A centred dialog over a dimmed page. Esc, the ✕ and clicking outside
 * close it (unless it's busy); the page behind doesn't scroll; focus moves
 * into the dialog when it opens and goes back to the button that opened it
 * when it closes; Tab stays inside it.
 */
export default function Modal({ open, title, onClose, busy = false, children, footer, size = "md" }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  onCloseRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the safe choice: anything marked data-autofocus (the Cancel
    // button on a destructive dialog), else the first control.
    const panel = panelRef.current;
    const first =
      panel?.querySelector<HTMLElement>("[data-autofocus]") ??
      panel?.querySelector<HTMLElement>("select, input, textarea, button:not([data-close])");
    first?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busyRef.current) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focusable = [
        ...panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ),
      ];
      if (focusable.length === 0) return;
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-rccg-purple-900/50 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl ${
          size === "xl" ? "h-[92vh] max-w-4xl" : "max-w-md"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-rccg-purple-800">
            {title}
          </h2>
          <button
            type="button"
            data-close
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="-mr-1 rounded-md px-2 py-0.5 text-lg leading-none text-muted hover:bg-mist disabled:opacity-50"
          >
            ✕
          </button>
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto ${size === "xl" ? "bg-mist p-3 sm:p-5" : "space-y-4 px-5 py-4"}`}>
          {children}
        </div>
        {footer && (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-line bg-mist/60 px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}

/**
 * The person (or thing) an action is about, set apart so it can't be
 * missed: their name large and bold in a tinted box. `detail` carries
 * whatever tells two people with the same name apart: unit, phone, role.
 */
export function Subject({ name, detail, tone = "purple" }: { name: string; detail?: string; tone?: "purple" | "red" }) {
  const box =
    tone === "red"
      ? "border-rccg-red-100 bg-rccg-red-50 text-rccg-red-700"
      : "border-rccg-purple-200 bg-rccg-purple-50 text-rccg-purple-800";
  return (
    <div className={`rounded-xl border px-4 py-3 text-center ${box}`}>
      <p className="text-lg font-bold uppercase tracking-wide">{name}</p>
      {detail && <p className="mt-0.5 text-xs opacity-80">{detail}</p>}
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Who or what this is about. Shown highlighted at the top. */
  subject?: { name: string; detail?: string };
  /** What will happen, in a sentence or two. */
  description?: ReactNode;
  /** Extra controls, e.g. a role or reason picker. */
  children?: ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  /** "danger" makes the confirm button red and puts focus on Cancel. */
  tone?: "primary" | "danger";
  busy?: boolean;
  confirmDisabled?: boolean;
  error?: string | null;
  /** Shown instead of the confirm button's action when something prevents it. */
  blockedReason?: string | null;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/** "Are you sure?" for actions on a person or record, with the name front and centre. */
export function ConfirmDialog({
  open,
  title,
  subject,
  description,
  children,
  confirmLabel,
  busyLabel,
  tone = "primary",
  busy = false,
  confirmDisabled = false,
  error,
  blockedReason,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const danger = tone === "danger";
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={busy} data-autofocus={danger ? "" : undefined} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || confirmDisabled || !!blockedReason}
            className={danger ? "btn-danger" : "btn-primary"}
          >
            {busy ? busyLabel ?? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      {subject && <Subject name={subject.name} detail={subject.detail} tone={danger ? "red" : "purple"} />}
      {description && <div className="text-sm text-ink">{description}</div>}
      {children}
      {blockedReason && <Notice tone="warning">{blockedReason}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
    </Modal>
  );
}
