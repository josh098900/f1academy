"use client";

import { useMemo, useState, useTransition } from "react";

import type { SaveTeamResult } from "@/app/(app)/team/actions";
import { Button } from "@/components/ui/button";
import type { LineupDriver } from "@/lib/queries";
import { cn } from "@/lib/utils";

import { BudgetBar } from "./BudgetBar";
import { DriverCard } from "./DriverCard";

const CAP = 40;
const SQUAD = 4;

type Props = {
  lineup: LineupDriver[];
  initialSelected?: number[];
  initialBoost?: number | null;
  onSave: (input: {
    driverIds: number[];
    boostDriverId: number;
  }) => Promise<SaveTeamResult>;
};

export function TeamPicker({
  lineup,
  initialSelected = [],
  initialBoost = null,
  onSave,
}: Props) {
  const [selected, setSelected] = useState<number[]>(initialSelected);
  const [boost, setBoost] = useState<number | null>(initialBoost);
  const [result, setResult] = useState<SaveTeamResult | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = useMemo(
    () => new Map(lineup.map((d) => [d.driverId, d])),
    [lineup]
  );

  const spent =
    Math.round(
      selected.reduce((sum, id) => sum + (byId.get(id)?.price ?? 0), 0) * 10
    ) / 10;
  const full = selected.length >= SQUAD;
  const overBudget = spent > CAP;
  const valid =
    selected.length === SQUAD &&
    !overBudget &&
    boost !== null &&
    selected.includes(boost);

  function toggle(id: number) {
    setResult(null);
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
    setResult(null);
    setBoost((prev) => (prev === id ? null : id));
  }

  function save() {
    if (!valid || boost === null) return;
    startTransition(async () => {
      setResult(await onSave({ driverIds: selected, boostDriverId: boost }));
    });
  }

  const status = overBudget
    ? `Over budget by £${(spent - CAP).toFixed(1)}M`
    : selected.length < SQUAD
      ? `Pick ${SQUAD - selected.length} more`
      : boost === null
        ? "Tap 2× to choose your boost"
        : "Team ready";

  // The status/result message shown in the action bar.
  const message = pending
    ? "Saving…"
    : result?.ok
      ? "Team saved ✓"
      : result && !result.ok
        ? result.error
        : status;
  const messageTone = result?.ok
    ? "text-success"
    : (result && !result.ok) || overBudget
      ? "text-danger"
      : valid
        ? "text-success"
        : "text-secondary";

  return (
    <>
      {/* pb leaves room for the sticky action bar */}
      <div className="grid grid-cols-1 gap-px pb-40 sm:grid-cols-2 lg:grid-cols-3">
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
          <div className="sm:w-56">
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

          <div className="flex items-center gap-4">
            <span className={cn("font-body text-sm", messageTone)}>{message}</span>
            <Button onClick={save} disabled={!valid || pending}>
              {pending ? "Saving…" : "Save team"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
