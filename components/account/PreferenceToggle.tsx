"use client";

import { useOptimistic, useTransition } from "react";

import { cn } from "@/lib/utils";

// One optimistic switch for every boolean account preference (Coach,
// reminders, whatever comes next). The action is a server action that
// persists the flag under RLS and revalidates the layout — useOptimistic
// flips the UI immediately and snaps back to server truth if the write
// is rejected. Replaces the near-identical CoachToggle/RemindersToggle pair.
export function PreferenceToggle({
  label,
  description,
  enabled,
  ariaLabel,
  action,
}: {
  label: string;
  description: string;
  enabled: boolean;
  ariaLabel: string;
  action: (enabled: boolean) => Promise<void>;
}) {
  const [optimistic, setOptimistic] = useOptimistic(enabled);
  const [pending, start] = useTransition();

  function flip() {
    const next = !optimistic;
    start(async () => {
      setOptimistic(next);
      await action(next);
    });
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="font-display text-sm tracking-wider text-primary uppercase">
          {label}
        </p>
        <p className="mt-1 font-body text-xs leading-relaxed text-muted">
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={optimistic}
        aria-label={ariaLabel}
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
