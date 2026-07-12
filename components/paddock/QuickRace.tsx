"use client";

import { useMemo, useState } from "react";

import { RaceViewer } from "@/components/paddock/RaceViewer";
import { Button } from "@/components/ui/button";
import type { RatedDriver } from "@/lib/paddock/ratings";
import {
  COMPOUNDS,
  type CompoundId,
  type Entrant,
  Rng,
  type Strategy,
  buildRaceReport,
  getTrack,
  gridFromQualifying,
  simulateRace,
} from "@/lib/race-sim";

// Quick Race — the first thing here you can actually play.
//
// You pick a driver and you commit a plan. That's the whole game: the strategy
// is chosen BEFORE the lights and then executed literally, so the race is your
// decisions playing out rather than your reflexes. Everything else — the grid,
// the tyres going off, the pass into Stowe — follows from it.
//
// The entire race is a function of (driver, strategy, seed), so nothing is
// stored: press Race, and the deterministic sim produces the same 15 laps every
// time. The garage, where the car itself becomes yours, is next.

const TRACK_ID = "silverstone"; // the only circuit with a racing line so far
const LAPS = 15;
const FIELD = 8;

// Identical machinery for everyone, so this race is decided by the driver you
// picked and the plan you wrote — not by who has the better car. That changes
// when the garage lands.
const STOCK_CAR = { power: 60, aero: 60, reliability: 60, pitCrew: 60 };

const DEFAULT_STRATEGY: Strategy = {
  startCompound: "medium",
  pitCompound: "hard",
  pitAtWear: 0.65,
  attackWithin: 1.0,
  conserveWhenLeadingBy: 3.0,
};

// Believable opposition: a spread of plans, so the field doesn't all pit on the
// same lap and the race has some shape to it.
function npcStrategy(rng: Rng): Strategy {
  const roll = rng.next();
  if (roll < 0.3) {
    return {
      startCompound: "soft",
      pitCompound: "medium",
      pitAtWear: 0.58,
      attackWithin: 1.3,
      conserveWhenLeadingBy: 2.5,
    };
  }
  if (roll < 0.75) {
    return {
      startCompound: "medium",
      pitCompound: "hard",
      pitAtWear: 0.66,
      attackWithin: 0.9,
      conserveWhenLeadingBy: 3.0,
    };
  }
  return {
    startCompound: "hard",
    pitCompound: "medium",
    pitAtWear: 0.8,
    attackWithin: 0.7,
    conserveWhenLeadingBy: 3.5,
  };
}

type Phase = "setup" | "race";

export function QuickRace({ drivers }: { drivers: RatedDriver[] }) {
  const ranked = useMemo(
    () => [...drivers].sort((a, b) => b.stats.pace - a.stats.pace),
    [drivers]
  );

  const [phase, setPhase] = useState<Phase>("setup");
  const [driverId, setDriverId] = useState<number>(ranked[0]?.driverId ?? 0);
  const [strategy, setStrategy] = useState<Strategy>(DEFAULT_STRATEGY);
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 1e9));
  const [showResult, setShowResult] = useState(false);

  const playerId = String(driverId);

  // Build the race. Everything downstream — grid, result, report — is derived
  // from this one deterministic computation.
  const race = useMemo(() => {
    const me = ranked.find((d) => d.driverId === driverId);
    if (!me) return null;

    const rng = new Rng(seed ^ 0x5f3759df);
    const rivals = ranked
      .filter((d) => d.driverId !== driverId)
      .slice(0, FIELD - 1);

    const entrants: Entrant[] = [
      {
        id: playerId,
        name: me.shortName,
        driver: me.stats,
        car: STOCK_CAR,
        strategy,
        isPlayer: true,
      },
      ...rivals.map((d) => ({
        id: String(d.driverId),
        name: d.shortName,
        driver: d.stats,
        car: STOCK_CAR,
        strategy: npcStrategy(rng),
        isPlayer: false,
      })),
    ];

    const track = getTrack(TRACK_ID);
    const grid = gridFromQualifying(entrants, track, seed);
    const result = simulateRace({ track, laps: LAPS, entrants: grid, seed });
    const report = buildRaceReport({
      result,
      playerId,
      gridOrder: grid.map((e) => e.id),
    });
    return { entrants: grid, result, report, grid };
  }, [ranked, driverId, strategy, seed, playerId]);

  if (!race) {
    return (
      <p className="font-body text-sm text-secondary">
        Not enough driver data to build a grid yet.
      </p>
    );
  }

  const myGrid = race.grid.findIndex((e) => e.id === playerId) + 1;
  const me = ranked.find((d) => d.driverId === driverId)!;

  function startRace() {
    setShowResult(false);
    setPhase("race");
  }

  function raceAgain() {
    setSeed(Math.floor(Math.random() * 1e9));
    setShowResult(false);
    setPhase("setup");
  }

  if (phase === "setup") {
    return (
      <div className="space-y-6">
        {/* Pick your driver */}
        <section className="border border-border-default bg-surface p-5">
          <h2 className="font-display text-xs tracking-[0.2em] text-accent uppercase">
            1 · Your driver
          </h2>
          <p className="mt-2 font-body text-sm text-secondary">
            Every rating is read from her real 2026 results. Take the quickest,
            or take your favourite and make the strategy do the work.
          </p>
          <ul className="mt-4 grid gap-px sm:grid-cols-2">
            {ranked.map((d) => {
              const active = d.driverId === driverId;
              return (
                <li key={d.driverId}>
                  <button
                    type="button"
                    onClick={() => setDriverId(d.driverId)}
                    aria-pressed={active}
                    className={`flex w-full items-center gap-3 border px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "border-accent bg-accent/10"
                        : "border-border-default hover:border-border-strong"
                    }`}
                  >
                    <span
                      className={`flex-1 truncate font-body text-sm ${
                        active ? "text-accent" : "text-primary"
                      }`}
                    >
                      {d.name}
                    </span>
                    <span
                      data-tabular
                      className="font-mono text-[10px] text-secondary tabular-nums"
                    >
                      PAC {d.stats.pace} · RAC {d.stats.racecraft} · CON{" "}
                      {d.stats.consistency}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Commit a plan */}
        <section className="border border-border-default bg-surface p-5">
          <h2 className="font-display text-xs tracking-[0.2em] text-accent uppercase">
            2 · Your plan
          </h2>
          <p className="mt-2 max-w-2xl font-body text-sm text-secondary">
            You write the rules now; {me.shortName} follows them literally for 15
            laps. There is no safety net — box too late and the tyres will be gone.
          </p>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <CompoundPicker
              label="Start on"
              value={strategy.startCompound}
              onChange={(c) => setStrategy((s) => ({ ...s, startCompound: c }))}
            />
            <CompoundPicker
              label="Fit at the stop"
              value={strategy.pitCompound}
              onChange={(c) => setStrategy((s) => ({ ...s, pitCompound: c }))}
            />
          </div>

          <div className="mt-5 space-y-5">
            <Slider
              label="Box when tyres are this worn"
              hint={`${Math.round(strategy.pitAtWear * 100)}% worn. The ${
                COMPOUNDS[strategy.startCompound].label
              } falls off a cliff at ${Math.round(
                COMPOUNDS[strategy.startCompound].cliff * 100
              )}%.`}
              min={40}
              max={95}
              value={Math.round(strategy.pitAtWear * 100)}
              onChange={(v) => setStrategy((s) => ({ ...s, pitAtWear: v / 100 }))}
              danger={
                strategy.pitAtWear > COMPOUNDS[strategy.startCompound].cliff
              }
            />
            <Slider
              label="Race hard when within"
              hint={`${strategy.attackWithin.toFixed(
                1
              )}s of a rival — attacking or defending. Pushing is quicker but eats the tyres.`}
              min={2}
              max={25}
              value={Math.round(strategy.attackWithin * 10)}
              onChange={(v) =>
                setStrategy((s) => ({ ...s, attackWithin: v / 10 }))
              }
            />
            <Slider
              label="Back off when clear by"
              hint={`${strategy.conserveWhenLeadingBy.toFixed(
                1
              )}s — saves the tyres, but hands back time.`}
              min={10}
              max={80}
              value={Math.round(strategy.conserveWhenLeadingBy * 10)}
              onChange={(v) =>
                setStrategy((s) => ({ ...s, conserveWhenLeadingBy: v / 10 }))
              }
            />
          </div>

          {strategy.pitAtWear > COMPOUNDS[strategy.startCompound].cliff ? (
            <p className="mt-4 border-l-2 border-danger bg-danger/[0.06] px-3 py-2 font-body text-xs text-danger">
              That plan runs the {COMPOUNDS[strategy.startCompound].label} past its
              cliff. You&apos;ll be losing seconds a lap before you box — which is
              a choice, not a bug.
            </p>
          ) : null}
        </section>

        <div className="flex items-center gap-4">
          <Button onClick={startRace}>Go racing</Button>
          <p className="font-mono text-xs text-muted">
            Silverstone · {LAPS} laps · qualifying decides the grid
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <p className="font-mono text-xs tracking-wider text-secondary uppercase">
          {me.shortName} · qualified{" "}
          <span className="text-accent">P{myGrid}</span> · Silverstone
        </p>
        <button
          type="button"
          onClick={raceAgain}
          className="font-mono text-xs tracking-wider text-muted uppercase underline-offset-4 transition-colors hover:text-primary hover:underline"
        >
          ← New race
        </button>
      </div>

      <RaceViewer
        result={race.result}
        entrants={race.entrants}
        trackId={TRACK_ID}
        onFinish={() => setShowResult(true)}
      />

      {showResult ? (
        <section
          className={`border p-6 ${
            race.report.won
              ? "border-accent bg-accent/[0.06]"
              : "border-border-default bg-surface"
          }`}
        >
          <h2
            className={`font-display text-[clamp(1.5rem,4vw,2.25rem)] leading-none tracking-wide uppercase ${
              race.report.won ? "text-accent" : "text-primary"
            }`}
          >
            {race.report.headline}
          </h2>
          <ul className="mt-4 max-w-2xl space-y-2">
            {race.report.notes.map((note, i) => (
              <li
                key={i}
                className="border-l-2 border-border-strong pl-3 font-body text-sm leading-relaxed text-secondary"
              >
                {note}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={raceAgain}>Change the plan, race again</Button>
          </div>
        </section>
      ) : (
        <p className="font-body text-xs text-muted">
          The result appears when the flag drops — or hit Skip.
        </p>
      )}
    </div>
  );
}

function CompoundPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: CompoundId;
  onChange: (c: CompoundId) => void;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-[0.2em] text-secondary uppercase">
        {label}
      </p>
      <div className="mt-2 flex gap-px">
        {(Object.keys(COMPOUNDS) as CompoundId[]).map((id) => {
          const c = COMPOUNDS[id];
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-pressed={active}
              className={`flex-1 border px-3 py-2 font-display text-xs tracking-wider uppercase transition-colors ${
                active
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border-default text-secondary hover:text-primary"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 font-body text-[11px] text-muted">
        {value === "soft"
          ? "Quickest, dies first."
          : value === "medium"
            ? "The compromise."
            : "Slowest, goes the distance."}
      </p>
    </div>
  );
}

function Slider({
  label,
  hint,
  min,
  max,
  value,
  onChange,
  danger,
}: {
  label: string;
  hint: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  danger?: boolean;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] tracking-[0.2em] text-secondary uppercase">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-1 w-full max-w-md accent-[#ff2d92]"
      />
      <span
        className={`mt-1 block font-body text-[11px] ${
          danger ? "text-danger" : "text-muted"
        }`}
      >
        {hint}
      </span>
    </label>
  );
}
