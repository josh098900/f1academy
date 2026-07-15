"use client";

import { useState, useTransition } from "react";

import type { Component, UpgradePurchase } from "@/lib/paddock/buy";
import {
  type CarLevels,
  MAX_LEVEL,
  TIERS,
  TIER_SIZE,
  statFor,
  tierIndexOf,
  upgradeCost,
} from "@/lib/paddock/garage";

// The garage floor. Four components, twenty-five levels each, five tiers of
// paint — and every card shows the CONSEQUENCE before the purchase: the stat
// you'd have, the price on the part, and how far up the ladder you are.

const COMPONENTS: Array<{
  key: Component;
  label: string;
  blurb: string;
}> = [
  { key: "power", label: "Power Unit", blurb: "Straight-line speed — lap time and overtaking punch." },
  { key: "aero", label: "Aero Package", blurb: "Cornering speed — pure lap time." },
  { key: "reliability", label: "Reliability", blurb: "Steadier laps, and a car that makes the flag." },
  { key: "pitCrew", label: "Pit Crew", blurb: "Seconds shaved off every stop, standing still." },
];

function partName(key: Component, level: number): string {
  const label = COMPONENTS.find((c) => c.key === key)!.label;
  if (level <= 0) return `Stock ${label}`;
  return `${TIERS[tierIndexOf(level)].label} ${label}`;
}

export function GarageShop({
  initialCoins,
  initialLevels,
  buy,
}: {
  initialCoins: number;
  initialLevels: CarLevels;
  buy: (component: Component) => Promise<UpgradePurchase>;
}) {
  const [coins, setCoins] = useState(initialCoins);
  const [levels, setLevels] = useState(initialLevels);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingPart, setPendingPart] = useState<Component | null>(null);
  const [, startTransition] = useTransition();

  function purchase(component: Component) {
    setPendingPart(component);
    setMessage(null);
    startTransition(async () => {
      const res = await buy(component);
      if (res.ok) {
        setCoins(res.coins);
        setLevels(res.carLevels);
      } else {
        setMessage(res.error);
      }
      setPendingPart(null);
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
        {message && (
          <p className="font-body text-xs text-warning">{message}</p>
        )}
      </div>

      <div className="grid gap-px sm:grid-cols-2">
        {COMPONENTS.map(({ key, label, blurb }) => {
          const level = levels[key];
          const cost = upgradeCost(level);
          const nextTier = cost !== null ? TIERS[tierIndexOf(level + 1)] : null;
          const affordable = cost !== null && coins >= cost;
          const busy = pendingPart === key;
          return (
            <section
              key={key}
              className="border border-border-default bg-surface p-5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-xs tracking-[0.2em] text-primary uppercase">
                  {label}
                </h2>
                <span
                  data-tabular
                  className="font-mono text-xs text-secondary tabular-nums"
                >
                  {statFor(level) % 1 === 0
                    ? statFor(level)
                    : statFor(level).toFixed(1)}
                </span>
              </div>
              <p className="mt-1 font-body text-[11px] leading-snug text-muted">
                {blurb}
              </p>

              {/* The ladder: 25 cells, painted in the tier they belong to. */}
              <div className="mt-4 flex gap-px" aria-hidden="true">
                {Array.from({ length: MAX_LEVEL }, (_, i) => {
                  const cellTier = TIERS[Math.floor(i / TIER_SIZE)];
                  const owned = i < level;
                  return (
                    <span
                      key={i}
                      className="h-3 flex-1"
                      style={{
                        background: owned ? cellTier.colour : "#1c1c1c",
                        opacity: owned ? 0.9 : 1,
                      }}
                    />
                  );
                })}
              </div>
              <p className="mt-1.5 font-mono text-[10px] tracking-wider text-muted uppercase">
                <span style={{ color: level > 0 ? TIERS[tierIndexOf(level)].colour : undefined }}>
                  {partName(key, level)}
                </span>{" "}
                · level {level}/{MAX_LEVEL}
              </p>

              <div className="mt-4 flex items-center justify-between gap-3">
                {cost === null ? (
                  <p className="font-mono text-xs tracking-wider text-secondary uppercase">
                    Full Diamond — nothing left to buy
                  </p>
                ) : (
                  <>
                    <p className="font-body text-xs text-secondary">
                      Next:{" "}
                      <span style={{ color: nextTier!.colour }}>
                        {nextTier!.label}
                      </span>{" "}
                      level {level + 1}
                    </p>
                    <button
                      type="button"
                      onClick={() => purchase(key)}
                      disabled={!affordable || busy}
                      className={`h-8 border px-3 font-mono text-xs tracking-wider uppercase transition-colors ${
                        affordable
                          ? "border-accent text-accent hover:bg-accent/10"
                          : "border-border-default text-muted"
                      } disabled:cursor-not-allowed`}
                    >
                      {busy ? "Fitting…" : `Buy · ${cost}`}
                    </button>
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
