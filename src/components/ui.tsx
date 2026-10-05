import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeftIcon } from "./icons";

/* -------------------------------------------------------------------------
 * Shared building blocks. Keeping layout, cards, badges and states here is
 * what keeps every page looking like part of the same app.
 * ---------------------------------------------------------------------- */

type PageSize = "sm" | "md" | "lg";

const PAGE_MAX: Record<PageSize, string> = {
  sm: "max-w-2xl",
  md: "max-w-4xl",
  lg: "max-w-6xl",
};

/** Page wrapper: consistent padding, and a readable max width per page. */
export function Page({ size = "lg", children }: { size?: PageSize; children: ReactNode }) {
  return (
    <div className={`w-full ${PAGE_MAX[size]} px-4 py-6 sm:px-6 lg:px-8 lg:py-8`}>{children}</div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  children?: ReactNode; // extra rows under the title (badges, dates…)
}) {
  return (
    <header className="mb-6">
      {backHref && (
        <Link
          href={backHref}
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-rccg-purple-700"
        >
          <ChevronLeftIcon />
          {backLabel ?? "Back"}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-rccg-purple-800 sm:text-3xl">{title}</h1>
          {description && <p className="mt-1 max-w-prose text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export function Card({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold text-rccg-purple-800">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export type Tone = "green" | "red" | "purple" | "amber" | "gray";

const BADGE_TONE: Record<Tone, string> = {
  green: "bg-rccg-green-50 text-rccg-green-700",
  red: "bg-rccg-red-50 text-rccg-red-700",
  purple: "bg-rccg-purple-100 text-rccg-purple-700",
  amber: "bg-amber-50 text-amber-800",
  gray: "bg-gray-100 text-gray-600",
};

const DOT_TONE: Record<Tone, string> = {
  green: "bg-rccg-green-500",
  red: "bg-rccg-red-600",
  purple: "bg-rccg-purple-500",
  amber: "bg-amber-500",
  gray: "bg-gray-400",
};

export function Badge({ tone = "gray", dot = false, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`badge ${BADGE_TONE[tone]}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${DOT_TONE[tone]}`} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "green" | "red" | "purple";
}) {
  const valueTone = {
    default: "text-ink",
    green: "text-rccg-green-700",
    red: "text-rccg-red-600",
    purple: "text-rccg-purple-700",
  }[tone];
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      <p className={`num mt-0.5 font-display text-2xl font-bold ${valueTone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-10 text-sm text-muted">
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-rccg-purple-200 border-t-rccg-green-500"
        aria-hidden="true"
      />
      {label}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-rccg-purple-200 bg-white px-6 py-10 text-center">
      <p className="font-display text-base font-semibold text-rccg-purple-800">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const NOTICE_TONE: Record<"info" | "success" | "warning" | "error", string> = {
  info: "border-rccg-purple-200 bg-rccg-purple-50 text-rccg-purple-800",
  success: "border-rccg-green-200 bg-rccg-green-50 text-rccg-green-700",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  error: "border-rccg-red-100 bg-rccg-red-50 text-rccg-red-700",
};

export function Notice({
  tone = "info",
  children,
  className = "",
}: {
  tone?: "info" | "success" | "warning" | "error";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-lg border px-3.5 py-2.5 text-sm ${NOTICE_TONE[tone]} ${className}`}
    >
      {children}
    </div>
  );
}

/** Label + control (+ optional hint) with the label wrapping the control, so no ids are needed. */
export function Field({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}

/** Active/retired style status pill used on youth + exco lists. */
export function ActiveBadge({ active, inactiveLabel = "Inactive" }: { active: boolean; inactiveLabel?: string }) {
  return active ? (
    <Badge tone="green" dot>
      Active
    </Badge>
  ) : (
    <Badge tone="gray">{inactiveLabel}</Badge>
  );
}
