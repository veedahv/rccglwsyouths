"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CoverDecor } from "@/components/EventScreens";
import FullscreenButton from "@/components/FullscreenButton";

/**
 * The frame every big-screen page sits in: the green, gold and red stripe from the poster,
 * faded icons behind the content, and a navy header with the title. It covers the app's
 * sidebar so nothing but the game is visible.
 */
export default function PresentFrame({
  title,
  subtitle,
  exitHref,
  right,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Where Exit goes. Left out on the public screen, where there is nothing to go back to. */
  exitHref?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-mist">
      <div className="absolute inset-x-0 top-0 z-20 flex h-2" aria-hidden="true">
        <span className="flex-1 bg-rccg-green-500" />
        <span className="flex-1" style={{ background: "#E8B04A" }} />
        <span className="flex-1 bg-rccg-red-600" />
      </div>
      <CoverDecor tone="light" />
      <div className="relative z-10 mx-auto flex min-h-full max-w-6xl flex-col px-6 pb-8 pt-8 sm:px-10">
        <header className="mb-6 flex items-center justify-between gap-4 rounded-2xl bg-rccg-purple-700 px-6 py-4 text-white shadow-lg">
          <div className="min-w-0">
            <p className="truncate font-display text-2xl font-bold sm:text-4xl">{title}</p>
            {subtitle && (
              <p className="mt-0.5 truncate text-sm font-semibold uppercase tracking-[0.2em] sm:text-base" style={{ color: "#E8B04A" }}>
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-4">
            {right}
            <FullscreenButton />
            {exitHref && (
              <Link href={exitHref} className="text-sm text-white/50 hover:text-white">
                Exit
              </Link>
            )}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
