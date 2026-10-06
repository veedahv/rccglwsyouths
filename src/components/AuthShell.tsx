import type { ReactNode } from "react";
import Logo from "./Logo";

// The split-screen layout shared by every signed-out page (sign in,
// forgot password, reset password, recover email), so they all look like
// one flow. Brand panel on the left, the form on the right.
export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel */}
      <div className="flex flex-col justify-between bg-rccg-purple-700 px-6 py-8 text-white sm:px-10 lg:w-[44%] lg:px-14 lg:py-14">
        <Logo size={56} chip />
        <div className="mt-10 lg:mt-0">
          <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
            LWS RCCG
            <br />
            Youths Platform
          </h1>
          <p className="mt-3 max-w-sm text-sm text-rccg-purple-200 sm:text-base">
            Dues, meetings, events and contributions for the youth department excos, in one place.
          </p>
        </div>
        <div className="mt-10 hidden h-1.5 w-24 overflow-hidden rounded-full lg:flex" aria-hidden="true">
          <span className="h-full flex-1 bg-rccg-green-500" />
          <span className="h-full flex-1 bg-rccg-red-600" />
        </div>
      </div>

      {/* Form area */}
      <div className="flex flex-1 items-center justify-center bg-mist px-6 py-10">
        <div className="w-full max-w-sm space-y-5">{children}</div>
      </div>
    </div>
  );
}
