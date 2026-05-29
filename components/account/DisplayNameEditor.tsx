"use client";

import { useOptimistic, useState, useTransition } from "react";

import { setDisplayName } from "@/app/(app)/dashboard/actions";
import { DISPLAY_NAME_MAX, DISPLAY_NAME_MIN } from "@/lib/display-name";
import { cn } from "@/lib/utils";

// In-place editor for the leaderboard display name. Optimistic update via
// useOptimistic + useTransition so the new name shows immediately while the
// server action persists. Validation matches the action's server-side check.
export function DisplayNameEditor({ current }: { current: string }) {
  const [optimistic, setOptimistic] = useOptimistic(current);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function startEdit() {
    setDraft(optimistic);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setError(null);
    setEditing(false);
  }

  function save() {
    const trimmed = draft.trim();
    if (
      trimmed.length < DISPLAY_NAME_MIN ||
      trimmed.length > DISPLAY_NAME_MAX
    ) {
      setError(
        `Between ${DISPLAY_NAME_MIN} and ${DISPLAY_NAME_MAX} characters.`
      );
      return;
    }
    if (trimmed === optimistic) {
      setEditing(false);
      return;
    }
    start(async () => {
      setOptimistic(trimmed);
      const res = await setDisplayName(trimmed);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display text-sm tracking-wider text-primary uppercase">
            Leaderboard name
          </p>
          <p className="mt-1 truncate font-body text-sm text-secondary">
            {optimistic}
          </p>
        </div>
        <button
          type="button"
          onClick={startEdit}
          className="shrink-0 rounded-sm border border-border-default px-3 py-1.5 font-mono text-xs tracking-wider text-secondary uppercase transition-colors hover:border-border-strong hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Edit
        </button>
      </div>
    );
  }

  const length = draft.trim().length;
  const counterTone =
    length < DISPLAY_NAME_MIN || length > DISPLAY_NAME_MAX
      ? "text-danger"
      : "text-muted";

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="font-display text-sm tracking-wider text-primary uppercase">
          Leaderboard name
        </span>
        <input
          type="text"
          value={draft}
          autoFocus
          maxLength={DISPLAY_NAME_MAX + 5}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              save();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
          }}
          className="mt-2 h-10 w-full rounded-sm border border-border-default bg-surface px-3 font-body text-sm text-primary placeholder:text-muted focus:border-border-strong focus:outline-none"
        />
      </label>
      <p
        className={cn(
          "font-mono text-[10px] tracking-wider uppercase",
          error ? "text-danger" : counterTone
        )}
      >
        {error ??
          `${DISPLAY_NAME_MIN}–${DISPLAY_NAME_MAX} characters · ${length}/${DISPLAY_NAME_MAX}`}
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-sm bg-accent px-4 font-display text-xs tracking-wider text-inverse uppercase transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="font-display text-xs tracking-wider text-secondary uppercase transition-colors hover:text-primary disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
