"use client";

import { useMemo, useState, useTransition } from "react";

import type { SaveTeamResult } from "@/app/(app)/team/actions";
import { Button } from "@/components/ui/button";
import type { LineupDriver } from "@/lib/queries";
import {
  BUDGET_CAP,
  SQUAD_SIZE,
  countTransfers,
  transferPenalty,
} from "@/lib/team-rules";
import { cn } from "@/lib/utils";

import { BudgetBar } from "./BudgetBar";
import { DriverCard } from "./DriverCard";

// Order-independent key for detecting unsaved changes.
function teamKey(ids: number[], boost: number | null, wildcard: boolean): string {
  return `${[...ids].sort((a, b) => a - b).join(",")}|${boost ?? ""}|${wildcard}`;
}

type Props = {
  lineup: LineupDriver[];
  initialSelected?: number[];
  initialBoost?: number | null;
  initialWildcard?: boolean;
  baseline?: number[] | null;
  wildcardUsedInPriorRound?: boolean;
  onSave: (input: {
    driverIds: number[];
    boostDriverId: number;
    wildcard: boolean;
  }) => Promise<SaveTeamResult>;
};

export function TeamPicker({
  lineup,
  initialSelected = [],
  initialBoost = null,
  initialWildcard = false,
  baseline = null,
  wildcardUsedInPriorRound = false,
  onSave,
}: Props) {
  const [selected, setSelected] = useState<number[]>(initialSelected);
  const [boost, setBoost] = useState<number | null>(initialBoost);
  const [wildcard, setWildcard] = useState(initialWildcard);
  const [saved, setSaved] = useState({
    driverIds: initialSelected,
    boostDriverId: initialBoost,
    wildcard: initialWildcard,
  });
  const [error, setError] = useState<string | null>(null);
  const [confirmWildcard, setConfirmWildcard] = useState(false);
  const [pending, startTransition] = useTransition();

  const byId = useMemo(
    () => new Map(lineup.map((d) => [d.driverId, d])),
    [lineup]
  );

  // Transfers only apply once there's a previous squad to change from.
  const hasBaseline = Boolean(baseline && baseline.length > 0);
  const transfers = countTransfers(baseline, selected);
  const penalty = transferPenalty(transfers, wildcard);

  const spent =
    Math.round(
      selected.reduce((sum, id) => sum + (byId.get(id)?.price ?? 0), 0) * 10
    ) / 10;
  const full = selected.length >= SQUAD_SIZE;
  const overBudget = spent > BUDGET_CAP;
  const valid =
    selected.length === SQUAD_SIZE &&
    !overBudget &&
    boost !== null &&
    selected.includes(boost);
  const dirty =
    teamKey(selected, boost, wildcard) !==
    teamKey(saved.driverIds, saved.boostDriverId, saved.wildcard);
  const isSavedComplete = !dirty && saved.driverIds.length === SQUAD_SIZE;

  function toggle(id: number) {
    setError(null);
    setSelected((prev) => {
      if (prev.includes(id)) {
        if (boost === id) setBoost(null);
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= SQUAD_SIZE) return prev;
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
      const res = await onSave({
        driverIds: selected,
        boostDriverId: boost,
        wildcard,
      });
      if (res.ok) {
        setSaved({ driverIds: selected, boostDriverId: boost, wildcard });
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
          ? `Over budget by £${(spent - BUDGET_CAP).toFixed(1)}M`
          : selected.length < SQUAD_SIZE
            ? `Pick ${SQUAD_SIZE - selected.length} more`
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
      <div className="grid grid-cols-1 gap-px pb-44 sm:grid-cols-2 lg:grid-cols-3">
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
            <BudgetBar spent={spent} cap={BUDGET_CAP} />
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-xs tracking-wider uppercase">
            <span className={full ? "text-success" : "text-secondary"}>
              {selected.length}/{SQUAD_SIZE} picked
            </span>
            <span className="text-secondary">
              Boost{" "}
              <span className={boost !== null ? "text-accent" : "text-muted"}>
                {boost !== null ? byId.get(boost)?.lastName : "—"}
              </span>
            </span>
            {hasBaseline ? (
              <span className="text-secondary">
                Transfers <span className="text-primary">{transfers}</span>
                {wildcard ? (
                  <span className="text-accent"> · wildcard</span>
                ) : penalty > 0 ? (
                  <span className="text-danger"> · −{penalty} pts</span>
                ) : null}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            {hasBaseline ? <WildcardChip /> : null}
            <span className={cn("font-body text-sm", messageTone)}>{message}</span>
            <Button onClick={save} disabled={!valid || pending || !dirty}>
              {pending ? "Saving…" : dirty ? "Save team" : "Saved"}
            </Button>
          </div>
        </div>
      </div>

      {confirmWildcard ? (
        <ConfirmWildcard
          onCancel={() => setConfirmWildcard(false)}
          onConfirm={() => {
            setWildcard(true);
            setError(null);
            setConfirmWildcard(false);
          }}
        />
      ) : null}
    </>
  );

  function WildcardChip() {
    // Already saved this round — sticky, can't be undone.
    if (saved.wildcard) {
      return (
        <span className="rounded-full border border-accent bg-accent px-3 py-1 font-mono text-[10px] tracking-wider text-inverse uppercase">
          Wildcard active ✓
        </span>
      );
    }
    if (wildcardUsedInPriorRound) {
      return (
        <span className="font-mono text-[10px] tracking-wider text-muted uppercase">
          Wildcard used
        </span>
      );
    }
    // Activated this session but not yet saved — can still back out.
    if (wildcard) {
      return (
        <button
          type="button"
          onClick={() => setWildcard(false)}
          className="rounded-full border border-accent bg-accent px-3 py-1 font-mono text-[10px] tracking-wider text-inverse uppercase"
        >
          Wildcard on ✓
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setConfirmWildcard(true)}
        className="rounded-full border border-border-strong px-3 py-1 font-mono text-[10px] tracking-wider text-secondary uppercase transition-colors hover:text-primary"
      >
        Play wildcard
      </button>
    );
  }
}

function ConfirmWildcard({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Play your wildcard"
      className="fixed inset-0 z-20 flex items-center justify-center bg-base/80 px-6"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm border border-border-strong bg-elevated p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl tracking-wide text-primary uppercase">
          Play your wildcard?
        </h2>
        <p className="mt-3 font-body text-sm leading-relaxed text-secondary">
          Your wildcard lets you make unlimited transfers this round with no
          points penalty. You only get <span className="text-primary">one per
          season</span> — it can&apos;t be undone after you save.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={onConfirm}>
            Play wildcard
          </Button>
        </div>
      </div>
    </div>
  );
}
