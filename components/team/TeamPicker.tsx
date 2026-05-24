"use client";

import { useMemo, useState } from "react";

import type { LineupDriver } from "@/lib/queries";
import { cn } from "@/lib/utils";

import { BudgetBar } from "./BudgetBar";
import { DriverCard } from "./DriverCard";

const CAP = 40;
const SQUAD = 4;

export function TeamPicker({ lineup }: { lineup: LineupDriver[] }) {
  const [selected, setSelected] = useState<number[]>([]);
  const [boost, setBoost] = useState<number | null>(null);

  const byId = useMemo(
    () => new Map(lineup.map((d) => [d.driverId, d])),
    [lineup]
  );

  const spent = selected.reduce((sum, id) => sum + (byId.get(id)?.price ?? 0), 0);
  const full = selected.length >= SQUAD;
  const overBudget = spent > CAP;
  const valid =
    selected.length === SQUAD &&
    !overBudget &&
    boost !== null &&
    selected.includes(boost);

  function toggle(id: number) {
    setSelected((prev) => {
      if (prev.includes(id)) {
        if (boost === id) setBoost(null);
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= SQUAD) return prev; // squad full
      return [...prev, id];
    });
  }

  function chooseBoost(id: number) {
    setBoost((prev) => (prev === id ? null : id));
  }

  const status = overBudget
    ? `Over budget by £${(spent - CAP).toFixed(1)}M`
    : selected.length < SQUAD
      ? `Pick ${SQUAD - selected.length} more`
      : boost === null
        ? "Tap 2× to choose your boost"
        : "Team ready";

  return (
    <>
      {/* pb leaves room for the sticky action bar */}
      <div className="grid grid-cols-1 gap-px pb-36 sm:grid-cols-2 lg:grid-cols-3">
        {lineup.map((d) => (
          <DriverCard
            key={d.driverId}
            driver={d}
            selected={selected.includes(d.driverId)}
            isBoost={boost === d.driverId}
            disabled={full && !selected.includes(d.driverId)}
            onToggle={() => toggle(d.driverId)}
            onBoost={() => chooseBoost(d.driverId)}
          />
        ))}
      </div>

      {/* Sticky action bar — thumb-reachable, solid (no glassmorphism). */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border-default bg-elevated px-6 py-4 sm:px-12">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="sm:w-64">
            <BudgetBar spent={spent} cap={CAP} />
          </div>

          <div className="flex items-center gap-5 font-mono text-xs tracking-wider uppercase">
            <span className={full ? "text-success" : "text-secondary"}>
              {selected.length}/{SQUAD} picked
            </span>
            <span className="text-secondary">
              Boost{" "}
              <span className={boost !== null ? "text-accent" : "text-muted"}>
                {boost !== null ? byId.get(boost)?.lastName : "—"}
              </span>
            </span>
          </div>

          <span
            className={cn(
              "font-body text-sm",
              valid
                ? "text-success"
                : overBudget
                  ? "text-danger"
                  : "text-secondary"
            )}
          >
            {status}
          </span>
        </div>
      </div>
    </>
  );
}
