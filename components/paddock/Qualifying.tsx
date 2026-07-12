"use client";

import { Button } from "@/components/ui/button";
import type { Entrant, QualifyingResult } from "@/lib/race-sim";

// The shootout. One lap, everything on the line, and the grid falls out of it.
//
// Qualifying was always in the simulation — it's why you don't start P1 every
// time — but the player never SAW it, so the grid looked arbitrary. A one-lap
// time sheet is the cheapest drama in motorsport: eight laps, tenths between
// them, and your name somewhere in the list.

export function formatLap(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

export function Qualifying({
  results,
  entrants,
  playerId,
  onContinue,
}: {
  results: QualifyingResult[];
  entrants: Entrant[];
  playerId: string;
  onContinue: () => void;
}) {
  const nameOf = (id: string) =>
    entrants.find((e) => e.id === id)?.name ?? id;
  const mine = results.find((r) => r.id === playerId);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-display text-xs tracking-[0.2em] text-accent uppercase">
          Qualifying · Silverstone
        </p>
        <h2 className="mt-2 font-display text-[clamp(1.75rem,5vw,2.75rem)] leading-none tracking-wide uppercase">
          {mine?.position === 1 ? "Pole position" : `P${mine?.position ?? "—"}`}
        </h2>
      </div>

      <ol className="border border-border-default bg-surface">
        {results.map((r) => {
          const isMe = r.id === playerId;
          return (
            <li
              key={r.id}
              className={`flex items-center gap-3 border-b border-border-default px-4 py-2.5 last:border-b-0 ${
                isMe ? "bg-accent/10" : ""
              }`}
            >
              <span
                data-tabular
                className={`w-6 font-mono text-xs tabular-nums ${
                  isMe ? "text-accent" : "text-muted"
                }`}
              >
                {r.position}
              </span>
              <span
                className={`flex-1 truncate font-body text-sm ${
                  isMe ? "text-accent" : "text-primary"
                }`}
              >
                {nameOf(r.id)}
              </span>
              <span
                data-tabular
                className={`font-mono text-sm tabular-nums ${
                  r.position === 1 ? "text-accent" : "text-secondary"
                }`}
              >
                {formatLap(r.lapTime)}
              </span>
              <span
                data-tabular
                className="w-16 text-right font-mono text-xs text-muted tabular-nums"
              >
                {r.position === 1 ? "POLE" : `+${r.gap.toFixed(3)}`}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="flex items-center gap-4">
        <Button onClick={onContinue}>To the grid</Button>
        <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
          You start P{mine?.position ?? "—"} · 15 laps
        </p>
      </div>
    </div>
  );
}
