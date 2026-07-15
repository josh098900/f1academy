"use client";

import { useState, useTransition } from "react";

import type { RosterEntry } from "@/lib/paddock/roster";
import type { DriverSignature } from "@/lib/paddock/sign";

// The roster. Fastest at the top — that's the point of the ladder — with
// the free seats at the bottom where every team starts, and a contract
// price on everyone in between.

export function RosterShop({
  entries,
  initialCoins,
  rank,
  sign,
}: {
  entries: RosterEntry[];
  initialCoins: number;
  rank: number;
  sign: (driverId: number) => Promise<DriverSignature>;
}) {
  const [coins, setCoins] = useState(initialCoins);
  const [signedExtra, setSignedExtra] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  function signHer(driverId: number) {
    setPendingId(driverId);
    setMessage(null);
    startTransition(async () => {
      const res = await sign(driverId);
      if (res.ok) {
        setCoins(res.coins);
        setSignedExtra((prev) => new Set(prev).add(res.driverId));
      } else {
        setMessage(res.error);
      }
      setPendingId(null);
    });
  }

  return (
    <div className="space-y-px">
      <div className="flex items-baseline justify-between border border-border-default bg-surface px-5 py-3">
        <p
          data-tabular
          className="font-mono text-sm tracking-wider uppercase tabular-nums"
        >
          <span className="text-muted">Balance · </span>
          <span className="text-accent">{coins} coins</span>
        </p>
        {message && <p className="font-body text-xs text-warning">{message}</p>}
      </div>

      <ol className="border border-border-default bg-surface">
        {entries.map((entry, i) => {
          const { driver, band } = entry;
          const status = signedExtra.has(driver.driverId)
            ? "signed"
            : entry.status;
          const busy = pendingId === driver.driverId;
          const affordable = band !== null && coins >= band.price;
          return (
            <li
              key={driver.driverId}
              className="flex items-center gap-3 border-b border-border-default px-4 py-3 last:border-b-0"
            >
              <span
                data-tabular
                className="w-5 font-mono text-[10px] text-muted tabular-nums"
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-body text-sm text-primary">
                  {driver.name}
                </span>
                <span
                  data-tabular
                  className="font-mono text-[10px] text-secondary tabular-nums"
                >
                  {driver.stats.pace}/{driver.stats.racecraft}/
                  {driver.stats.consistency}
                </span>
              </span>
              {band && (
                <span className="hidden font-mono text-[10px] tracking-wider text-muted uppercase sm:block">
                  {band.label}
                </span>
              )}

              {status === "free" ? (
                <span className="font-mono text-xs tracking-wider text-success uppercase">
                  Free seat
                </span>
              ) : status === "signed" ? (
                <span className="font-mono text-xs tracking-wider text-accent uppercase">
                  Signed
                </span>
              ) : status === "locked" ? (
                <span className="font-mono text-xs tracking-wider text-muted uppercase">
                  Rank {band!.rankNeeded} · you&apos;re {rank}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => signHer(driver.driverId)}
                  disabled={!affordable || busy}
                  className={`h-8 border px-3 font-mono text-xs tracking-wider uppercase transition-colors ${
                    affordable
                      ? "border-accent text-accent hover:bg-accent/10"
                      : "border-border-default text-muted"
                  } disabled:cursor-not-allowed`}
                >
                  {busy ? "Signing…" : `Sign · ${band!.price}`}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
