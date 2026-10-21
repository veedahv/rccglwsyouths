"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { subscribeOverlay } from "@/lib/games";
import { useRoundTimer } from "@/lib/useRoundTimer";
import PresentFrame from "@/components/PresentFrame";
import FullscreenButton from "@/components/FullscreenButton";
import { EventResult } from "@/components/ResultCard";
import { EventCover, OverallBoard, SessionBigScreen } from "@/components/EventScreens";
import { Loading, Notice } from "@/components/ui";
import TeaserScreen from "@/components/TeaserScreen";
import { GAME_LABEL, isEventOverlay, isTeaserOverlay } from "@/types/games";
import type { OverlayDoc } from "@/types/games";

// The big screen for a projector or TV. It needs no sign-in: like the OBS overlay, the long
// random key in the address is the private link, and the data behind it only ever holds what
// is on screen right now (upcoming questions and face-down cards are never in it). It follows
// the admin live, so it can be opened on any device, signed in or not.
//
// One link covers a whole games event: the cover, each game as it is put on screen, then the
// standings and the final result. Press F, or use the button, for fullscreen.
function Screen({ doc }: { doc: OverlayDoc }) {
  const session = isEventOverlay(doc) || isTeaserOverlay(doc) ? null : doc;
  const timer = useRoundTimer(session);

  if (isTeaserOverlay(doc)) return <TeaserScreen run={doc} />;

  if (isEventOverlay(doc)) {
    if (doc.view === "cover") {
      return (
        <div className="fixed inset-0 z-50">
          <EventCover event={{ ...doc, hosts: doc.hosts?.map((name) => ({ name })) }} />
          <FullscreenButton tone="dark" className="absolute right-4 top-6 z-20" />
        </div>
      );
    }
    const final = doc.view === "final";
    return (
      <PresentFrame title={doc.title} subtitle={final ? "Final result" : "Standings so far"}>
        {final ? (
          <div className="mx-auto w-full max-w-5xl space-y-8">
            <EventResult summary={doc.summary} final large />
            {doc.summary.results.length > 0 && (
              <div className="rounded-3xl bg-white/80 p-6 shadow-sm">
                <OverallBoard summary={doc.summary} large final bare />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full">
              <OverallBoard summary={doc.summary} large />
            </div>
          </div>
        )}
      </PresentFrame>
    );
  }

  return (
    <PresentFrame title={doc.title} subtitle={doc.eventTitle ?? GAME_LABEL[doc.game]}>
      <SessionBigScreen session={doc} timer={timer} />
    </PresentFrame>
  );
}

export default function PublicScreenPage() {
  const { key } = useParams<{ key: string }>();
  const [doc, setDoc] = useState<OverlayDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    return subscribeOverlay(
      key,
      (d) => {
        setDoc(d);
        setLoading(false);
      },
      () => {
        setError(true);
        setLoading(false);
      }
    );
  }, [key]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-mist">
        <Loading />
      </div>
    );
  }
  if (error || !doc) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-mist p-8">
        <Notice tone="error">This screen link isn&apos;t working. It may have been deleted, or the address is wrong.</Notice>
      </div>
    );
  }
  return <Screen doc={doc} />;
}
