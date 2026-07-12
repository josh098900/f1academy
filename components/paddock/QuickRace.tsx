"use client";

import { useMemo, useState } from "react";

import {
  PitWallSlider,
  PitWallToggle,
  StintPlan,
  TyrePicker,
} from "@/components/paddock/PitWall";
import { Qualifying } from "@/components/paddock/Qualifying";
import { RaceViewer } from "@/components/paddock/RaceViewer";
import { Button } from "@/components/ui/button";
import type { RatedDriver } from "@/lib/paddock/ratings";
import {
  type Entrant,
  Rng,
  type Strategy,
  type Tuning,
  buildRaceReport,
  getTrack,
  simulateQualifying,
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
  boxUnderSafetyCar: true, // what a real pit wall would do
  attackWithin: 1.0,
  conserveWhenLeadingBy: 3.0,
};

// Believable opposition: a spread of plans, so the field doesn't all pit on the
// same lap and the race has some shape to it.
function npcStrategy(rng: Rng): Strategy {
  const roll = rng.next();
  if (roll < 0.3) {
    // The opportunist: aggressive tyres, jumps at a cheap stop.
    return {
      startCompound: "soft",
      pitCompound: "medium",
      pitAtWear: 0.58,
      boxUnderSafetyCar: true,
      attackWithin: 1.3,
      conserveWhenLeadingBy: 2.5,
    };
  }
  if (roll < 0.75) {
    return {
      startCompound: "medium",
      pitCompound: "hard",
      pitAtWear: 0.66,
      boxUnderSafetyCar: true,
      attackWithin: 0.9,
      conserveWhenLeadingBy: 3.0,
    };
  }
  // The track-position team: hards, run long, and a caution doesn't tempt
  // them out of the plan.
  return {
    startCompound: "hard",
    pitCompound: "medium",
    pitAtWear: 0.8,
    boxUnderSafetyCar: false,
    attackWithin: 0.7,
    conserveWhenLeadingBy: 3.5,
  };
}

// The shakedown switch: add ?safetycar to the URL and every race runs on
// crash-prone tuning with a guaranteed deployment, so the safety car can be
// WATCHED on demand instead of waiting for the dice (it appears in ~11% of
// normal races). Test tuning, not the game: without the URL flag, races run
// the real balance untouched.
const SHAKEDOWN_TUNING: Partial<Tuning> = {
  incidentBase: 0.008,
  incidentMajorShare: 0.35,
  scDeployChance: 1,
};

type Phase = "setup" | "quali" | "race";

const COMPOUND_LABEL = { soft: "Soft", medium: "Medium", hard: "Hard" } as const;
const CLIFF = { soft: 0.7, medium: 0.8, hard: 0.88 } as const;

export function QuickRace({ drivers }: { drivers: RatedDriver[] }) {
  const ranked = useMemo(
    () => [...drivers].sort((a, b) => b.stats.pace - a.stats.pace),
    [drivers]
  );

  const [phase, setPhase] = useState<Phase>("setup");
  const [driverId, setDriverId] = useState<number>(ranked[0]?.driverId ?? 0);
  const [strategy, setStrategy] = useState<Strategy>(DEFAULT_STRATEGY);
  const [showResult, setShowResult] = useState(false);

  // The plan the player has actually COMMITTED to. Nothing is simulated until
  // this exists.
  //
  // The race used to be a useMemo keyed on `strategy`, which meant every slider
  // input event re-ran the entire 15-lap simulation — ~13ms a go, ~800ms of work
  // for every second of dragging, so the pit wall stuttered under your thumb.
  // It also ran server-side on every page load, simulating a full race for a
  // screen that doesn't show one. The strategy screen needs no race; it only
  // needs the stint plan, which is arithmetic.
  const [committed, setCommitted] = useState<{
    driverId: number;
    strategy: Strategy;
    seed: number;
    shakedown: boolean;
  } | null>(null);

  const race = useMemo(() => {
    if (!committed) return null;
    const me = ranked.find((d) => d.driverId === committed.driverId);
    if (!me) return null;

    const playerId = String(committed.driverId);
    const rng = new Rng(committed.seed ^ 0x5f3759df);
    const rivals = ranked
      .filter((d) => d.driverId !== committed.driverId)
      .slice(0, FIELD - 1);

    const entrants: Entrant[] = [
      {
        id: playerId,
        name: me.shortName,
        driver: me.stats,
        car: STOCK_CAR,
        strategy: committed.strategy,
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
    // Qualify once, and keep the sheet: it IS the grid, and it's also the screen
    // the player now sees. (gridFromQualifying would re-run the shootout and
    // throw the lap times away.)
    const quali = simulateQualifying(entrants, track, committed.seed);
    const byId = new Map(entrants.map((e) => [e.id, e]));
    const grid = quali.map((q) => byId.get(q.id)!);

    const result = simulateRace({
      track,
      laps: LAPS,
      entrants: grid,
      seed: committed.seed,
      tuning: committed.shakedown ? SHAKEDOWN_TUNING : undefined,
    });
    const report = buildRaceReport({
      result,
      playerId,
      gridOrder: grid.map((e) => e.id),
    });
    return { entrants: grid, result, report, grid, quali, playerId };
  }, [ranked, committed]);

  const me = ranked.find((d) => d.driverId === driverId);
  if (!me) {
    return (
      <p className="font-body text-sm text-secondary">
        Not enough driver data to build a grid yet.
      </p>
    );
  }

  function startRace() {
    // The seed is minted here, not during render: Math.random() in a useState
    // initializer runs on the server AND the client and disagrees. The URL is
    // read here too — a click handler only ever runs in the browser, so there
    // is no server/client disagreement to hydrate wrongly.
    const shakedown = new URLSearchParams(window.location.search).has(
      "safetycar"
    );
    setCommitted({
      driverId,
      strategy,
      seed: Math.floor(Math.random() * 1e9),
      shakedown,
    });
    setShowResult(false);
    setPhase("quali");
  }

  function raceAgain() {
    setCommitted(null);
    setShowResult(false);
    setPhase("setup");
  }

  if (phase === "setup") {
    return (
      <div className="space-y-px">
        {/* Driver */}
        <section className="border border-border-default bg-surface p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xs tracking-[0.2em] text-accent uppercase">
              01 · Driver
            </h2>
            <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
              Rated from real 2026 results
            </p>
          </div>
          <ul className="mt-4 grid gap-px sm:grid-cols-2">
            {ranked.map((d, i) => {
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
                      data-tabular
                      className="w-5 font-mono text-[10px] text-muted tabular-nums"
                    >
                      {i + 1}
                    </span>
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
                      {d.stats.pace}/{d.stats.racecraft}/{d.stats.consistency}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 font-mono text-[10px] tracking-wider text-muted uppercase">
            Pace / Racecraft / Consistency · a driver with few races is rated
            cautiously until the season proves her
          </p>
        </section>

        {/* The pit wall */}
        <section className="border border-border-default bg-surface p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xs tracking-[0.2em] text-accent uppercase">
              02 · Pit wall
            </h2>
            <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
              {me.shortName} follows this literally
            </p>
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-[auto_1fr]">
            <div className="flex gap-8">
              <TyrePicker
                label="Start"
                value={strategy.startCompound}
                onChange={(c) => setStrategy((s) => ({ ...s, startCompound: c }))}
              />
              <TyrePicker
                label="Fit at stop"
                value={strategy.pitCompound}
                onChange={(c) => setStrategy((s) => ({ ...s, pitCompound: c }))}
              />
            </div>

            <div className="space-y-5">
              <PitWallSlider
                label="Box at"
                readout={`${Math.round(strategy.pitAtWear * 100)}% worn`}
                hint={`The ${COMPOUND_LABEL[strategy.startCompound]} falls off a cliff at ${Math.round(
                  CLIFF[strategy.startCompound] * 100
                )}% — past that you lose seconds a lap.`}
                min={40}
                max={95}
                value={Math.round(strategy.pitAtWear * 100)}
                onChange={(v) => setStrategy((s) => ({ ...s, pitAtWear: v / 100 }))}
                danger={strategy.pitAtWear > CLIFF[strategy.startCompound]}
              />
              <PitWallSlider
                label="Race hard within"
                readout={`${strategy.attackWithin.toFixed(1)}s`}
                hint="Attacking or defending. Pushing is quicker but eats the tyres."
                min={2}
                max={25}
                value={Math.round(strategy.attackWithin * 10)}
                onChange={(v) => setStrategy((s) => ({ ...s, attackWithin: v / 10 }))}
              />
              <PitWallSlider
                label="Back off when clear by"
                readout={`${strategy.conserveWhenLeadingBy.toFixed(1)}s`}
                hint="Saves the tyres, hands back time."
                min={10}
                max={80}
                value={Math.round(strategy.conserveWhenLeadingBy * 10)}
                onChange={(v) =>
                  setStrategy((s) => ({ ...s, conserveWhenLeadingBy: v / 10 }))
                }
              />
              <PitWallToggle
                label="If the safety car comes out"
                onLabel="Box for the cheap stop"
                offLabel="Stay out"
                value={strategy.boxUnderSafetyCar}
                onChange={(v) =>
                  setStrategy((s) => ({ ...s, boxUnderSafetyCar: v }))
                }
                hint="A stop under the caution costs a fraction of the usual track position — but it spends your only stop the moment the yellows fly, however early that is."
              />
            </div>
          </div>

          <div className="mt-6 border-t border-border-default pt-5">
            <StintPlan strategy={strategy} trackId={TRACK_ID} laps={LAPS} />
          </div>
        </section>

        <div className="flex items-center gap-4 pt-5">
          <Button onClick={startRace}>Lights out</Button>
          <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
            Silverstone · {LAPS} laps · qualifying sets the grid
          </p>
        </div>
      </div>
    );
  }

  if (!race) return null;
  const myGrid = race.grid.findIndex((e) => e.id === race.playerId) + 1;

  if (phase === "quali") {
    return (
      <Qualifying
        results={race.quali}
        entrants={race.entrants}
        playerId={race.playerId}
        onContinue={() => setPhase("race")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <p className="font-mono text-xs tracking-wider text-secondary uppercase">
          {me.shortName} · qualified{" "}
          <span className="text-accent">P{myGrid}</span> · Silverstone
        </p>
        {committed?.shakedown && (
          <span className="border border-warning/50 px-2 py-0.5 font-mono text-[10px] tracking-wider text-warning uppercase">
            Shakedown · safety car armed
          </span>
        )}
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
