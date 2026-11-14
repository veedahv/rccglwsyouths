"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { subscribeChurchEvent } from "@/lib/events";
import { listExcos } from "@/lib/excos";
import { PALETTES, screenOf } from "@/lib/eventScreen";
import RequireAuth from "@/components/RequireAuth";
import FullscreenButton from "@/components/FullscreenButton";
import EventScreenView from "@/components/EventScreenView";
import { Loading, Notice } from "@/components/ui";
import type { ChurchEvent, ExcoMember } from "@/types";

// The big screen for an event. It only listens: the cover, the agenda, the colours and icons
// are all chosen on the event page, and this screen follows. It sits on top of the app's sidebar.
function PresentInner() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<ChurchEvent | null>(null);
  const [excos, setExcos] = useState<ExcoMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Owner names on the agenda are a nice extra, so a failure here doesn't stop the screen.
    listExcos().then(setExcos).catch(() => setExcos([]));
    return subscribeChurchEvent(
      id,
      (e) => {
        setEvent(e);
        setLoading(false);
      },
      () => {
        setError("Couldn't load this event.");
        setLoading(false);
      }
    );
  }, [id]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-mist">
        <Loading />
      </div>
    );
  }
  if (error || !event) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-mist p-8">
        <Notice tone="error">{error ?? "This event was not found."}</Notice>
      </div>
    );
  }

  const dark = PALETTES[screenOf(event).palette].dark;
  return (
    <div className="fixed inset-0 z-50">
      <EventScreenView event={event} excos={excos} />
      <div className="absolute right-4 top-6 z-30 flex items-center gap-3">
        <FullscreenButton tone="dark" className={dark ? "" : "!text-black/40 hover:!text-black"} />
        <Link href={`/events/${event.id}`} className={`text-sm ${dark ? "text-white/40 hover:text-white" : "text-black/40 hover:text-black"}`}>
          Exit
        </Link>
      </div>
    </div>
  );
}

export default function EventPresentPage() {
  return (
    <RequireAuth>
      <PresentInner />
    </RequireAuth>
  );
}
