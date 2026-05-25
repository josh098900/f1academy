"use client";

import { useEffect, useState } from "react";

import type { InsightResult } from "@/lib/coach/insights";

// Loads an AI insight on mount and renders it in the Coach surface (see
// DESIGN_SYSTEM.md): faint accent border + tint, always labelled AI-generated.
export function CoachCard({
  load,
  title = "Coach's Take",
}: {
  load: () => Promise<InsightResult>;
  title?: string;
}) {
  const [state, setState] = useState<{
    loading: boolean;
    content?: string;
    error?: string;
  }>({ loading: true });

  useEffect(() => {
    let active = true;
    load().then((res) => {
      if (!active) return;
      setState(
        res.ok
          ? { loading: false, content: res.content }
          : { loading: false, error: res.error }
      );
    });
    return () => {
      active = false;
    };
  }, [load]);

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
      {state.loading ? (
        <p className="font-body text-sm text-muted">Thinking…</p>
      ) : state.error ? (
        <p className="font-body text-sm text-secondary">{state.error}</p>
      ) : (
        <p className="font-body text-sm leading-relaxed whitespace-pre-line text-primary">
          {state.content}
        </p>
      )}
    </aside>
  );
}
