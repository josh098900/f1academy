"use client";

import { useTransition } from "react";

import { setCoachEnabled } from "@/app/(app)/coach-actions";

// One-tap opt-in shown wherever a Coach insight would appear when the player
// has the Coach turned off. Visually mirrors CoachCard so the page rhythm
// holds; calls the per-user toggle and lets the server revalidate the surface.
export function CoachOptIn({
  title = "Coach's Take",
  body = "The Coach can give you a quick AI take here — grounded in the round and form data only.",
}: {
  title?: string;
  body?: string;
}) {
  const [pending, start] = useTransition();

  return (
    <aside className="space-y-3 border border-accent/30 bg-accent/[0.03] p-5">
      <div className="flex items-center justify-between">
        <span className="font-display text-xs tracking-[0.2em] text-accent uppercase">
          {title}
        </span>
        <span className="font-mono text-[10px] tracking-wider text-muted uppercase">
          AI-generated · Gemini
        </span>
      </div>
      <p className="font-body text-sm leading-relaxed text-secondary">{body}</p>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => setCoachEnabled(true))}
        className="inline-flex h-9 items-center rounded-sm border border-accent px-4 font-display text-xs tracking-wider text-accent uppercase transition-colors hover:bg-accent hover:text-inverse focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40"
      >
        {pending ? "Turning on…" : "Turn on Coach"}
      </button>
    </aside>
  );
}
