"use client";

import { useOptimistic, useTransition } from "react";

import { setRemindersEnabled } from "@/app/(app)/dashboard/actions";
import { cn } from "@/lib/utils";

// Lock-time reminder opt-out. Default-on (most signups expect a transactional
// nudge); the toggle here lets players silence it. Same optimistic switch
// pattern as CoachToggle.
export function RemindersToggle({ enabled }: { enabled: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(enabled);
  const [pending, start] = useTransition();

  function flip() {
    const next = !optimistic;
    start(async () => {
      setOptimistic(next);
      await setRemindersEnabled(next);
    });
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="font-display text-sm tracking-wider text-primary uppercase">
          Lock-time email reminders
        </p>
        <p className="mt-1 font-body text-xs leading-relaxed text-muted">
          A short nudge ~24 hours before each round locks, if you haven&apos;t
          picked yet. Sent from noreply@academy.jmathers.com.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={optimistic}
        aria-label="Toggle lock-time reminders"
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
