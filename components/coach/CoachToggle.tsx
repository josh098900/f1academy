"use client";

import { useOptimistic, useTransition } from "react";

import { setCoachEnabled } from "@/app/(app)/coach-actions";
import { cn } from "@/lib/utils";

// Per-user Coach preference (default off — see the migration). Optimistic so
// the switch flips immediately on tap while the server action persists.
export function CoachToggle({ enabled }: { enabled: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(enabled);
  const [pending, start] = useTransition();

  function flip() {
    const next = !optimistic;
    start(async () => {
      setOptimistic(next);
      await setCoachEnabled(next);
    });
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="font-display text-sm tracking-wider text-primary uppercase">
          Coach (AI insights)
        </p>
        <p className="mt-1 font-body text-xs leading-relaxed text-muted">
          Pre-race reads, post-race recaps and driver takes — Gemini, grounded
          in the round and form data only.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={optimistic}
        aria-label="Toggle Coach"
        onClick={flip}
        disabled={pending}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60",
          optimistic
            ? "border-accent bg-accent"
            : "border-border-strong bg-surface"
        )}
      >
        <span
          className={cn(
            "inline-block size-5 transform rounded-full transition-transform",
            optimistic ? "translate-x-6 bg-inverse" : "translate-x-0.5 bg-secondary"
          )}
        />
      </button>
    </div>
  );
}
