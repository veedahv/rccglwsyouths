"use client";

import RequireAuth from "@/components/RequireAuth";
import WarmupLeader from "@/components/WarmupLeader";
import { WARMUP_STEPS, WARMUP_TITLE } from "@/lib/warmups";

// Leader mode for the whole routine. A games event's own fitness sessions use the same view with
// just the moves chosen for them (see /games/events/[id]/fitness/[sessionId]).
export default function WarmupsLeadPage() {
  return (
    <RequireAuth>
      <WarmupLeader title={WARMUP_TITLE} steps={WARMUP_STEPS} exitHref="/games/warm-ups" />
    </RequireAuth>
  );
}
