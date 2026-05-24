"use client";

import { useState, useTransition } from "react";

import type { SaveResultsResult } from "@/app/admin/results/actions";
import { Button } from "@/components/ui/button";
import type { Entrant, ResultRow } from "@/lib/queries";

type Status = "classified" | "dnf" | "dsq" | "dns";

type RowState = {
  position: string;
  grid: string;
  status: Status;
  fastestLap: boolean;
};

const STATUSES: { value: Status; label: string }[] = [
  { value: "classified", label: "Classified" },
  { value: "dnf", label: "DNF" },
  { value: "dsq", label: "DSQ" },
  { value: "dns", label: "DNS" },
];

const inputClass =
  "h-8 w-16 rounded-sm border border-border-default bg-surface px-2 text-center font-mono text-sm text-primary tabular-nums focus:border-border-strong focus:outline-none";

export function ResultsForm({
  sessionId,
  sessionType,
  entrants,
  existing,
  onSave,
}: {
  sessionId: number;
  sessionType: string;
  entrants: Entrant[];
  existing: ResultRow[];
  onSave: (input: {
    sessionId: number;
    results: {
      driverId: number;
      position: number | null;
      gridPosition: number | null;
      status: Status;
      fastestLap: boolean;
    }[];
  }) => Promise<SaveResultsResult>;
}) {
  const isQuali = sessionType === "qualifying";
  const byDriver = new Map(existing.map((r) => [r.driverId, r]));

  const [rows, setRows] = useState<Record<number, RowState>>(() => {
    const init: Record<number, RowState> = {};
    for (const e of entrants) {
      const r = byDriver.get(e.driverId);
      init[e.driverId] = {
        position: r?.position?.toString() ?? "",
        grid: r?.gridPosition?.toString() ?? "",
        status: r?.status ?? "classified",
        fastestLap: r?.fastestLap ?? false,
      };
    }
    return init;
  });
  const [result, setResult] = useState<SaveResultsResult | null>(null);
  const [pending, startTransition] = useTransition();

  function update(driverId: number, patch: Partial<RowState>) {
    setResult(null);
    setRows((prev) => ({ ...prev, [driverId]: { ...prev[driverId], ...patch } }));
  }

  // Only one fastest lap per race.
  function setFastestLap(driverId: number) {
    setResult(null);
    setRows((prev) => {
      const next: Record<number, RowState> = {};
      for (const [id, row] of Object.entries(prev)) {
        next[Number(id)] = { ...row, fastestLap: Number(id) === driverId };
      }
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const results = entrants.map((e) => {
        const row = rows[e.driverId];
        return {
          driverId: e.driverId,
          position: row.position ? Number(row.position) : null,
          gridPosition: isQuali || !row.grid ? null : Number(row.grid),
          status: row.status,
          fastestLap: row.fastestLap,
        };
      });
      setResult(await onSave({ sessionId, results }));
    });
  }

  return (
    <div className="pb-28">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border-default text-left font-body text-xs tracking-wider text-secondary uppercase">
            <th className="py-2 pr-3 font-normal">Driver</th>
            <th className="px-2 py-2 font-normal">Pos</th>
            {!isQuali ? <th className="px-2 py-2 font-normal">Grid</th> : null}
            <th className="px-2 py-2 font-normal">Status</th>
            {!isQuali ? <th className="px-2 py-2 font-normal">FL</th> : null}
          </tr>
        </thead>
        <tbody>
          {entrants.map((e) => {
            const row = rows[e.driverId];
            return (
              <tr key={e.driverId} className="border-b border-border-default last:border-0">
                <td className="py-2 pr-3">
                  <span className="font-mono text-xs text-secondary tabular-nums">
                    #{e.carNumber ?? "—"}
                  </span>{" "}
                  <span className="font-body text-sm text-primary">
                    {e.shortName}
                  </span>
                  {e.isWildcard ? (
                    <span className="ml-2 font-mono text-[10px] tracking-wider text-accent uppercase">
                      WC
                    </span>
                  ) : null}
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={row.position}
                    onChange={(ev) => update(e.driverId, { position: ev.target.value })}
                    disabled={row.status !== "classified"}
                    className={inputClass}
                  />
                </td>
                {!isQuali ? (
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={row.grid}
                      onChange={(ev) => update(e.driverId, { grid: ev.target.value })}
                      className={inputClass}
                    />
                  </td>
                ) : null}
                <td className="px-2 py-2">
                  <select
                    value={row.status}
                    onChange={(ev) =>
                      update(e.driverId, { status: ev.target.value as Status })
                    }
                    className="h-8 rounded-sm border border-border-default bg-surface px-2 font-body text-sm text-primary focus:border-border-strong focus:outline-none"
                  >
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
                {!isQuali ? (
                  <td className="px-2 py-2">
                    <input
                      type="radio"
                      name="fastestLap"
                      checked={row.fastestLap}
                      onChange={() => setFastestLap(e.driverId)}
                      className="accent-accent"
                    />
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-end gap-4 border-t border-border-default bg-elevated px-6 py-4 sm:px-12">
        {result ? (
          <span
            className={`font-body text-sm ${result.ok ? "text-success" : "text-danger"}`}
          >
            {result.ok ? "Results saved ✓" : result.error}
          </span>
        ) : null}
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save results"}
        </Button>
      </div>
    </div>
  );
}
