"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  PitWallSlider,
  PitWallToggle,
  StintPlan,
  TyrePicker,
} from "@/components/paddock/PitWall";
import { Qualifying } from "@/components/paddock/Qualifying";
import { RaceViewer } from "@/components/paddock/RaceViewer";
import { Button } from "@/components/ui/button";
import {
  PADDOCK_LAPS,
  PADDOCK_TRACK_ID,
  rankDrivers,
  runQuickRace,
} from "@/lib/paddock/field";
import { type CarLevels, ZERO_LEVELS } from "@/lib/paddock/garage";
import type { RatedDriver } from "@/lib/paddock/ratings";
import type { PaddockRaceSettlement } from "@/lib/paddock/settle";
import { type Strategy, type Tuning } from "@/lib/race-sim";

// Quick Race — the first thing here you can actually play.
//
// You pick a driver and you commit a plan. That's the whole game: the strategy
// is chosen BEFORE the lights and then executed literally, so the race is your
// decisions playing out rather than your reflexes. Everything else — the grid,
// the tyres going off, the pass into Stowe — follows from it.
//
// The race itself is built in lib/paddock/field.ts, because it now runs twice:
// once on the server, which mints the seed and banks the coins, and once here,
// where the identical race is replayed as the broadcast. When no server hookup
// exists (tests, or the settlement failing), the race still runs locally — the
// economy must never block the racing — it just pays nothing.

const DEFAULT_STRATEGY: Strategy = {
  startCompound: "medium",
  pitCompound: "hard",
  pitAtWear: 0.65,
  boxUnderSafetyCar: true, // what a real pit wall would do
  attackWithin: 1.0,
  conserveWhenLeadingBy: 3.0,
};

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

export function QuickRace({
  drivers,
  runRace,
  carLevels = ZERO_LEVELS,
  usableDriverIds,
}: {
  drivers: RatedDriver[];
  // The server action that mints the seed and banks the payout. Optional so
  // the component still races (unpaid) in tests and when settlement fails.
  runRace?: (input: {
    driverId: number;
    strategy: Strategy;
  }) => Promise<PaddockRaceSettlement>;
  // The player's garage, for local (unpaid) races and the pit-wall display.
  // Paid races replay with the levels the SERVER echoes back, so a purchase
  // in another tab can never desync the broadcast from the banked result.
  carLevels?: CarLevels;
  // Free seats + signed contracts. Omitted (tests) = the whole grid.
  usableDriverIds?: number[];
}) {
  const router = useRouter();
  const ranked = useMemo(() => rankDrivers(drivers), [drivers]);
  const usable = useMemo(
    () => new Set(usableDriverIds ?? ranked.map((d) => d.driverId)),
    [usableDriverIds, ranked]
  );

  const [phase, setPhase] = useState<Phase>("setup");
  // Default to the best driver you're actually ALLOWED to run.
  const [driverId, setDriverId] = useState<number>(
    () =>
      ranked.find((d) =>
        usableDriverIds ? usableDriverIds.includes(d.driverId) : true
      )?.driverId ?? 0
  );
  const [strategy, setStrategy] = useState<Strategy>(DEFAULT_STRATEGY);
  const [showResult, setShowResult] = useState(false);
  const [settled, setSettled] = useState<{
    coins: number;
    balance: number;
    racesToday: number;
  } | null>(null);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [starting, startTransition] = useTransition();

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
    carLevels: CarLevels;
  } | null>(null);

  const race = useMemo(() => {
    if (!committed) return null;
    return runQuickRace(
      ranked,
      committed.driverId,
      committed.strategy,
      committed.seed,
      {
        tuning: committed.shakedown ? SHAKEDOWN_TUNING : undefined,
        carLevels: committed.carLevels,
      }
    );
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
    // The URL is read in the click handler — it only ever runs in the
    // browser, so there is no server/client disagreement to hydrate wrongly.
    const shakedown = new URLSearchParams(window.location.search).has(
      "safetycar"
    );
    setShowResult(false);
    setSettled(null);
    setSettleError(null);

    // Shakedown races run test tuning the server would never settle, and
    // tests have no server at all — both race locally, unpaid. (Math.random
    // is fine for an unpaid seed; paid seeds are minted server-side so a
    // client can't shop for a winner.)
    if (shakedown || !runRace) {
      setCommitted({
        driverId,
        strategy,
        seed: Math.floor(Math.random() * 1e9),
        shakedown,
        carLevels,
      });
      setPhase("quali");
      return;
    }

    startTransition(async () => {
      const res = await runRace({ driverId, strategy });
      if (res.ok) {
        setSettled({
          coins: res.coinsEarned,
          balance: res.balance,
          racesToday: res.racesToday,
        });
        setCommitted({
          driverId,
          strategy,
          seed: res.seed,
          shakedown: false,
          // Replay with the garage the SERVER raced, not the page's copy.
          carLevels: res.carLevels,
        });
      } else {
        // The economy must never block the racing: race locally, unpaid —
        // and say why it's unpaid on the result screen.
        setSettleError(res.error);
        setCommitted({
          driverId,
          strategy,
          seed: Math.floor(Math.random() * 1e9),
          shakedown: false,
          carLevels,
        });
      }
      setPhase("quali");
    });
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
              const locked = !usable.has(d.driverId);
              return (
                <li key={d.driverId}>
                  <button
                    type="button"
                    onClick={() => setDriverId(d.driverId)}
                    disabled={locked}
                    aria-pressed={active}
                    className={`flex w-full items-center gap-3 border px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "border-accent bg-accent/10"
                        : locked
                          ? "border-border-default opacity-45"
                          : "border-border-default hover:border-border-strong"
                    } disabled:cursor-not-allowed`}
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
                    {locked ? (
                      <span className="font-mono text-[10px] tracking-wider text-muted uppercase">
                        Contract
                      </span>
                    ) : (
                      <span
                        data-tabular
                        className="font-mono text-[10px] text-secondary tabular-nums"
                      >
                        {d.stats.pace}/{d.stats.racecraft}/{d.stats.consistency}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 font-mono text-[10px] tracking-wider text-muted uppercase">
            Pace / Racecraft / Consistency · a driver with few races is rated
            cautiously until the season proves her
            {usableDriverIds && usable.size < ranked.length && (
              <>
                {" "}
                ·{" "}
                <Link
                  href="/paddock/drivers"
                  className="text-accent underline-offset-4 hover:underline"
                >
                  contracts are signed in the roster →
                </Link>
              </>
            )}
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
            <StintPlan
              strategy={strategy}
              trackId={PADDOCK_TRACK_ID}
              laps={PADDOCK_LAPS}
            />
          </div>
        </section>

        <div className="flex items-center gap-4 pt-5">
          <Button onClick={startRace} disabled={starting}>
            {starting ? "Forming the grid…" : "Lights out"}
          </Button>
          <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
            Silverstone · {PADDOCK_LAPS} laps · qualifying sets the grid
          </p>
        </div>
      </div>
    );
  }

  if (!race) return null;
  const myGrid = race.gridPosition;

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
          <span className="text-accent">P{myGrid}</span> · Silverstone ·{" "}
          rank {race.rank} field
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
        trackId={PADDOCK_TRACK_ID}
        onFinish={() => {
          setShowResult(true);
          // The page's coin balance and race history are deliberately left
          // stale at settlement (the race is DECIDED at lights out, but the
          // player hasn't watched it yet — updating the header then would
          // announce the result during qualifying). The flag has dropped
          // now: let them catch up.
          if (settled) router.refresh();
        }}
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
          <p
            data-tabular
            className="mt-5 font-mono text-sm tracking-wider uppercase tabular-nums"
          >
            {settled ? (
              <>
                <span className="text-accent">+{settled.coins} coins</span>
                <span className="text-muted">
                  {" "}
                  · balance {settled.balance} · race {settled.racesToday}/10
                  today
                </span>
              </>
            ) : (
              <span className="text-muted">
                {committed?.shakedown
                  ? "Shakedown race — no payout"
                  : (settleError ?? "Result not banked — no payout this time")}
              </span>
            )}
          </p>
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
