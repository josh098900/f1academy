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

// Order-independent key for comparing a selection against what's saved.
function teamKey(ids: number[], boost: number | null): string {
  return `${[...ids].sort((a, b) => a - b).join(",")}|${boost ?? ""}`;
}

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
  // What's currently persisted, so we can tell when there are unsaved changes.
  const [saved, setSaved] = useState({
    driverIds: initialSelected,
    boostDriverId: initialBoost,
  });
  const [error, setError] = useState<string | null>(null);
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
  const dirty =
    teamKey(selected, boost) !==
    teamKey(saved.driverIds, saved.boostDriverId);
  const isSavedComplete = !dirty && saved.driverIds.length === SQUAD;

  function toggle(id: number) {
    setError(null);
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
    setError(null);
    setBoost((prev) => (prev === id ? null : id));
  }

  function save() {
    if (!valid || boost === null) return;
    startTransition(async () => {
      const res = await onSave({ driverIds: selected, boostDriverId: boost });
      if (res.ok) {
        setSaved({ driverIds: selected, boostDriverId: boost });
        setError(null);
      } else {
        setError(res.error);
      }
    });
  }

  const message = pending
    ? "Saving…"
    : error
      ? error
      : isSavedComplete
        ? "Team saved ✓"
        : overBudget
          ? `Over budget by £${(spent - CAP).toFixed(1)}M`
          : selected.length < SQUAD
            ? `Pick ${SQUAD - selected.length} more`
            : boost === null
              ? "Tap 2× to choose your boost"
              : "Team ready";
  const messageTone = error
    ? "text-danger"
    : isSavedComplete
      ? "text-success"
      : overBudget
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
            <Button onClick={save} disabled={!valid || pending || !dirty}>
              {pending ? "Saving…" : dirty ? "Save team" : "Saved"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
