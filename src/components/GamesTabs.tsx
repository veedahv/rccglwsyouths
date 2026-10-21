"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/games", label: "Games", match: (p: string) => p === "/games" || (p.startsWith("/games/") && !p.startsWith("/games/teasers") && !p.startsWith("/games/questions") && !p.startsWith("/games/play")) },
  { href: "/games/teasers", label: "Teasers", match: (p: string) => p.startsWith("/games/teasers") || p.startsWith("/games/play") },
  { href: "/games/questions", label: "Question bank", match: (p: string) => p.startsWith("/games/questions") },
];

/** The tabs along the top of the games pages. */
export default function GamesTabs() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="mb-5 flex gap-1 border-b border-line" aria-label="Games sections">
      {TABS.map((t) => {
        const on = t.match(pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={[
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              on ? "border-rccg-green-500 text-rccg-purple-800" : "border-transparent text-muted hover:text-rccg-purple-700",
            ].join(" ")}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
