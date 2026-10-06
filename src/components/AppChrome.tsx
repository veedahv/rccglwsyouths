"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { formatPersonName } from "@/lib/formatName";
import Logo from "./Logo";
import {
  DashboardIcon,
  YouthsIcon,
  DuesIcon,
  ExcosIcon,
  MeetingsIcon,
  EventsIcon,
  PlannerIcon,
  ContributionsIcon,
  FinanceIcon,
  RolesIcon,
  ProfileIcon,
  SignOutIcon,
  MenuIcon,
  CloseIcon,
} from "./icons";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/youths", label: "Youths", Icon: YouthsIcon },
  { href: "/dues", label: "Dues", Icon: DuesIcon },
  { href: "/excos", label: "Excos", Icon: ExcosIcon },
  { href: "/meetings", label: "Meetings", Icon: MeetingsIcon },
  { href: "/events", label: "Events", Icon: EventsIcon },
  { href: "/planner", label: "Planner", Icon: PlannerIcon },
  { href: "/contributions", label: "Contributions", Icon: ContributionsIcon },
  { href: "/finance", label: "Finance", Icon: FinanceIcon },
  { href: "/roles", label: "Roles", Icon: RolesIcon },
  { href: "/profile", label: "My profile", Icon: ProfileIcon },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

// The sidebar's contents — shared between the always-visible desktop
// rail and the slide-out mobile drawer, so the two never drift apart.
function SidebarContent({
  pathname,
  excoName,
  roleLabel,
  onNavigate,
  onSignOut,
}: {
  pathname: string;
  excoName: string;
  roleLabel: string;
  onNavigate?: () => void; // closes the mobile drawer after a tap
  onSignOut: () => void;
}) {
  const initial = excoName.replace(/^(Bro|Sis)\s+/i, "").charAt(0).toUpperCase() || "?";

  return (
    <div className="flex h-full flex-col">
      <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-3 px-4 pb-4 pt-5">
        <Logo size={34} chip />
        <span className="font-display text-base font-semibold leading-tight text-white">
          LWS RCCG
          <br />
          Youths
        </span>
      </Link>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2" aria-label="Main">
        {NAV_LINKS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={[
                "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-white/10 text-white"
                  : "text-rccg-purple-200 hover:bg-white/5 hover:text-white",
              ].join(" ")}
            >
              {active && (
                <span
                  className="absolute inset-y-2 left-0 w-1 rounded-r bg-rccg-green-500"
                  aria-hidden="true"
                />
              )}
              <Icon />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <Link
          href="/profile"
          onClick={onNavigate}
          aria-current={isActive(pathname, "/profile") ? "page" : undefined}
          className={[
            "flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5",
            isActive(pathname, "/profile") ? "bg-white/10" : "",
          ].join(" ")}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rccg-green-600 text-sm font-bold text-white"
            aria-hidden="true"
          >
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{excoName}</p>
            <p className="truncate text-xs capitalize text-rccg-purple-300">{roleLabel}</p>
          </div>
        </Link>
        <button
          onClick={onSignOut}
          className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-rccg-purple-200 transition-colors hover:bg-white/5 hover:text-white"
        >
          <SignOutIcon />
          Sign out
        </button>
      </div>
    </div>
  );
}

// Wraps every page. Shows the sidebar/nav only once someone is actually
// signed in with a resolved exco profile — on /login (or mid-auth-check)
// it just renders children, so the sign-in screen isn't cluttered with
// nav links to pages that would immediately bounce them back out.
export default function AppChrome({ children }: { children: React.ReactNode }) {
  const { user, exco, loading, signOutUser, roleLabel } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    setMobileOpen(false);
    await signOutUser();
    router.push("/login");
  }

  if (loading || !user || !exco) {
    return <>{children}</>;
  }

  const excoName = formatPersonName(exco.name, exco.gender);

  return (
    <div className="min-h-screen bg-mist md:flex">
      {/* Desktop sidebar — fixed width, always visible at md+ */}
      <aside className="hidden bg-rccg-purple-700 md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
        <SidebarContent
          pathname={pathname}
          excoName={excoName}
          roleLabel={roleLabel}
          onSignOut={handleSignOut}
        />
      </aside>

      {/* Mobile top bar — hamburger opens the drawer below */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-rccg-purple-700 px-4 py-2.5 md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Logo size={26} chip />
          <span className="font-display text-sm font-semibold text-white">LWS RCCG Youths</span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="rounded-lg p-1.5 text-white hover:bg-white/10"
        >
          <MenuIcon />
        </button>
      </header>

      {/* Mobile drawer + overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-rccg-purple-900/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-rccg-purple-700 shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-2 top-3 rounded-lg p-1.5 text-rccg-purple-200 hover:bg-white/10 hover:text-white"
            >
              <CloseIcon />
            </button>
            <SidebarContent
              pathname={pathname}
              excoName={excoName}
              roleLabel={roleLabel}
              onNavigate={() => setMobileOpen(false)}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      )}

      {/* Content — offset by the sidebar's width at md+ */}
      <main className="min-w-0 flex-1 md:pl-64">
        <div className="mx-auto max-w-8xl">{children}</div>
      </main>
    </div>
  );
}
