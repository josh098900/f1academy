import { describe, expect, it } from "vitest";

import {
  COMPOUNDS,
  type CarStats,
  type DriverStats,
  type Entrant,
  type Strategy,
  Rng,
  getTrack,
  gridFromQualifying,
  simulateQualifying,
  simulateRace,
} from "../lib/race-sim";
import { tyreLapDelta, wearIncrement } from "../lib/race-sim/tyres";

const LAPS = 15;

function driver(overrides: Partial<DriverStats> = {}): DriverStats {
  return { pace: 60, racecraft: 60, consistency: 60, ...overrides };
}
function car(overrides: Partial<CarStats> = {}): CarStats {
  return { power: 60, aero: 60, reliability: 60, pitCrew: 60, ...overrides };
}
function strategy(overrides: Partial<Strategy> = {}): Strategy {
  return {
    startCompound: "medium",
    pitCompound: "hard",
    pitAtWear: 0.7,
    attackWithin: 1.0,
    conserveWhenLeadingBy: 3.0,
    ...overrides,
  };
}
function entrant(id: string, overrides: Partial<Entrant> = {}): Entrant {
  return {
    id,
    name: id,
    driver: driver(),
    car: car(),
    strategy: strategy(),
    isPlayer: false,
    ...overrides,
  };
}

// A standard 8-car grid of clones — any difference in the result then comes
// from the sim, not from the entrants.
function grid(count = 8): Entrant[] {
  return Array.from({ length: count }, (_, i) => entrant(`car-${i + 1}`));
}

function race(entrants: Entrant[], seed = 1234, trackId = "zandvoort") {
  return simulateRace({ track: getTrack(trackId), laps: LAPS, entrants, seed });
}

// The same race, without building the ~29,000 frame objects a renderer would
// animate. Statistical tests run hundreds of races and read only the events and
// the classification; the timeline is pure waste to them, and building it was
// what pushed these tests past CI's 5s timeout.
function raceResultOnly(
  entrants: Entrant[],
  seed: number,
  trackId = "zandvoort"
) {
  return simulateRace({
    track: getTrack(trackId),
    laps: LAPS,
    entrants,
    seed,
    captureFrames: false,
  });
}

// Statistical tests need hundreds of races to say anything true. They are
// legitimately slow, so say so rather than living one CI runner away from a
// flake.
const STATS_TIMEOUT = 30_000;

describe("Rng", () => {
  it("is deterministic for a seed and differs across seeds", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const c = new Rng(43);
    const drawA = [a.next(), a.next(), a.next()];
    const drawB = [b.next(), b.next(), b.next()];
    const drawC = [c.next(), c.next(), c.next()];
    expect(drawA).toEqual(drawB);
    expect(drawA).not.toEqual(drawC);
  });

  it("stays inside [0, 1)", () => {
    const rng = new Rng(7);
    for (let i = 0; i < 500; i++) {
      const n = rng.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});

describe("tyres", () => {
  it("makes a fresh soft quicker than a fresh medium, and a hard slower", () => {
    expect(tyreLapDelta(COMPOUNDS.soft, 0)).toBeLessThan(tyreLapDelta(COMPOUNDS.medium, 0));
    expect(tyreLapDelta(COMPOUNDS.hard, 0)).toBeGreaterThan(tyreLapDelta(COMPOUNDS.medium, 0));
  });

  it("degrades gently before the cliff and brutally after it — the whole game", () => {
    // Compare EQUAL steps of wear either side of the cliff. That ratio is the
    // non-linearity, and the non-linearity is what turns "when do I box?" from
    // arithmetic into tension: a soft is worth half a second a lap right up
    // until the lap it costs you the race.
    const soft = COMPOUNDS.soft;
    const step = 0.05;
    const preSlope =
      tyreLapDelta(soft, soft.cliff) - tyreLapDelta(soft, soft.cliff - step);
    const postSlope =
      tyreLapDelta(soft, soft.cliff + step) - tyreLapDelta(soft, soft.cliff);

    expect(postSlope).toBeGreaterThan(preSlope * 4); // it's a shelf, not a ramp
    // And falling off it properly hurts: seconds a lap, not tenths.
    const fallenOff =
      tyreLapDelta(soft, soft.cliff + 0.2) - tyreLapDelta(soft, soft.cliff);
    expect(fallenOff).toBeGreaterThan(3);
  });

  it("wears the soft out fastest and the hard slowest", () => {
    const lapsToDeath = (id: "soft" | "medium" | "hard") =>
      1 / wearIncrement(COMPOUNDS[id], "neutral", 1, 1);
    expect(lapsToDeath("soft")).toBeLessThan(lapsToDeath("medium"));
    expect(lapsToDeath("medium")).toBeLessThan(lapsToDeath("hard"));
    // A soft must not survive a 15-lap race — otherwise there's no strategy.
    expect(lapsToDeath("soft")).toBeLessThan(LAPS);
  });

  it("burns tyres faster when pushing and saves them when conserving", () => {
    const push = wearIncrement(COMPOUNDS.medium, "push", 1, 1);
    const neutral = wearIncrement(COMPOUNDS.medium, "neutral", 1, 1);
    const conserve = wearIncrement(COMPOUNDS.medium, "conserve", 1, 1);
    expect(push).toBeGreaterThan(neutral);
    expect(conserve).toBeLessThan(neutral);
  });
});

describe("simulateRace — determinism", () => {
  it("produces an identical race for the same seed", () => {
    const a = race(grid(), 99);
    const b = race(grid(), 99);
    expect(a.classification).toEqual(b.classification);
    expect(a.events).toEqual(b.events);
    expect(a.frames.length).toBe(b.frames.length);
    // Deep-equal the whole timeline: this is the property the async multiplayer
    // design rests on. If it ever breaks, two players see different races.
    expect(a.frames).toEqual(b.frames);
  });

  it("produces a different race for a different seed", () => {
    const a = race(grid(), 1);
    const b = race(grid(), 2);
    expect(a.frames).not.toEqual(b.frames);
  });
});

describe("simulateRace — the race actually happens", () => {
  const result = race(grid(), 2024);

  it("runs every car to the full distance", () => {
    expect(result.classification).toHaveLength(8);
    for (const row of result.classification) {
      expect(row.laps).toBe(LAPS);
    }
  });

  it("classifies 1st to 8th with non-negative gaps in order", () => {
    const positions = result.classification.map((c) => c.position);
    expect(positions).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(result.classification[0].gapToLeader).toBe(0);
    const gaps = result.classification.map((c) => c.gapToLeader);
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i]).toBeGreaterThanOrEqual(gaps[i - 1]);
    }
  });

  it("keeps every car's lap position inside 0→1 (the renderer depends on it)", () => {
    for (const frame of result.frames) {
      for (const c of frame.cars) {
        expect(c.lapPosition).toBeGreaterThanOrEqual(0);
        expect(c.lapPosition).toBeLessThan(1);
      }
    }
  });

  it("has cars pitting, and only at a pit-stop event", () => {
    const pits = result.events.filter((e) => e.type === "pit");
    expect(pits.length).toBeGreaterThan(0);
    const stops = result.classification.reduce((n, c) => n + c.pitStops, 0);
    expect(stops).toBe(pits.length);
  });

  it("never demotes a car after it has taken the flag", () => {
    // Regression. Finished cars used to be ranked by their frozen progress —
    // i.e. by however far past the line their final simulation step happened to
    // land — so as the rest of the field came home, the winner drifted BACK down
    // the timing tower. A car that has finished is ahead of anyone who hasn't,
    // and finishers are ordered by when they actually crossed.
    for (let seed = 0; seed < 8; seed++) {
      const r = race(grid(), seed * 41 + 7);
      const best = new Map<string, number>();
      for (const frame of r.frames) {
        for (const c of frame.cars) {
          if (!c.finished) continue;
          const seen = best.get(c.id);
          if (seen !== undefined) {
            // Once finished, a car's position must never get worse.
            expect(c.position).toBeLessThanOrEqual(seen);
          }
          best.set(c.id, Math.min(seen ?? c.position, c.position));
        }
      }
    }
  });

  it("gives the flag to whoever crossed the line first", () => {
    for (let seed = 0; seed < 8; seed++) {
      const r = race(grid(), seed * 53 + 3);
      const finishes = r.events
        .filter((e) => e.type === "finish")
        .map((e) => ({ id: e.carId, t: e.t }));
      // Finish events are emitted in crossing order…
      for (let i = 1; i < finishes.length; i++) {
        expect(finishes[i].t).toBeGreaterThanOrEqual(finishes[i - 1].t);
      }
      // …and that order IS the classification, among those who took the flag.
      // (A retirement is classified behind every finisher, and never gets one.)
      const finishers = r.classification
        .filter((c) => c.retired === null)
        .map((c) => c.id);
      expect(finishers).toEqual(finishes.map((f) => f.id));
    }
  });

  it("puts a pitting car in the pit lane, not on the racing line", () => {
    const r = race(grid(), 2024);
    let sawPitProgress = false;
    for (const frame of r.frames) {
      for (const c of frame.cars) {
        if (c.inPit) {
          expect(c.pitProgress).not.toBeNull();
          expect(c.pitProgress!).toBeGreaterThanOrEqual(0);
          expect(c.pitProgress!).toBeLessThanOrEqual(1);
          sawPitProgress = true;
        } else {
          expect(c.pitProgress).toBeNull();
        }
      }
    }
    expect(sawPitProgress).toBe(true);
  });

  it("has wheel-to-wheel racing — passes and defences both occur", () => {
    const passes = result.events.filter((e) => e.type === "overtake");
    expect(passes.length).toBeGreaterThan(0);
    // Every pass happened at a real named zone on this track.
    const zones = new Set(getTrack("zandvoort").zones.map((z) => z.name));
    for (const p of passes) {
      if (p.type === "overtake") expect(zones.has(p.zone)).toBe(true);
    }
  });
});

describe("simulateRace — the timing screen", () => {
  const r = race(grid(), 424242);

  it("times every lap, and every lap is a plausible lap", () => {
    const base = getTrack("zandvoort").baseLapTime;
    for (const f of r.frames) {
      for (const c of f.cars) {
        if (c.lastLapTime === null) continue;
        // Nothing quicker than a perfect lap, nothing slower than a lap with a
        // 14s pit stop buried in it.
        expect(c.lastLapTime).toBeGreaterThan(base * 0.85);
        expect(c.lastLapTime).toBeLessThan(base * 1.6);
        expect(c.bestLapTime!).toBeLessThanOrEqual(c.lastLapTime);
      }
    }
  });

  it("awards the fastest lap to whoever actually set it", () => {
    expect(r.fastestLap).not.toBeNull();
    const best = Math.min(
      ...r.classification
        .map((c) => c.bestLapTime)
        .filter((x): x is number => x !== null)
    );
    expect(r.fastestLap!.lapTime).toBeCloseTo(best, 6);
    const holder = r.classification.find((c) => c.id === r.fastestLap!.carId)!;
    expect(holder.bestLapTime).toBeCloseTo(best, 6);
  });

  it("does not set the fastest lap on lap 1", () => {
    // Cars used to be at full racing speed from a standstill, so lap 1 was the
    // quickest lap anyone drove and the purple was ALWAYS lap 1 — wrong, and
    // dull. A standing start costs you time; fuel burns off as the race runs.
    // The purple should land where those curves cross: in the race, not at it.
    for (let seed = 0; seed < 12; seed++) {
      const result = race(grid(), seed * 31 + 9);
      expect(result.fastestLap!.lap).toBeGreaterThan(1);
    }
  });

  it("gives the leader a zero gap, and everyone else a growing one", () => {
    for (const f of r.frames) {
      const byPos = [...f.cars].sort((a, b) => a.position - b.position);
      expect(byPos[0].gapToLeader).toBe(0);
      for (const c of byPos) expect(c.gapToLeader).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("simulateRace — things go wrong", () => {
  const RECKLESS = strategy({
    startCompound: "soft",
    pitCompound: "soft",
    pitAtWear: 0.95, // lives past the cliff
    attackWithin: 2.5, // always pushing
    conserveWhenLeadingBy: 8,
  });

  function retirementRate(plan: Strategy, seeds = 200): number {
    let out = 0;
    for (let s = 0; s < seeds; s++) {
      const field = grid();
      field[0] = { ...field[0], id: "hero", name: "hero", strategy: plan };
      const r = raceResultOnly(field, s * 7919 + 13, "silverstone");
      if (r.events.some((e) => e.type === "retirement" && e.carId === "hero")) {
        out++;
      }
    }
    return out / seeds;
  }

  it("makes an incident something you EARNED, not something that happened to you", () => {
    // THE test for this whole system. A race lost to pure luck teaches nothing
    // and the player stops playing; a race lost to running dead tyres teaches
    // everything. So a sensible plan must almost never end in the barrier, and a
    // reckless one must do it several times as often.
    const sensible = retirementRate(strategy());
    const reckless = retirementRate(RECKLESS);

    expect(sensible).toBeLessThan(0.08); // rare enough not to feel arbitrary
    expect(reckless).toBeGreaterThan(sensible * 2.5); // and clearly your own doing
  }, STATS_TIMEOUT);

  it("gives the tyre cliff teeth: past it, you can lose the race, not just seconds", () => {
    // Before incidents, running past the cliff only cost time. A dead tyre has
    // no grip under braking, which is exactly how a driver locks a wheel and
    // ends up in the gravel — so the cliff should now be able to END a race.
    let crashesAfterCliff = 0;
    for (let s = 0; s < 200; s++) {
      const field = grid();
      field[0] = { ...field[0], id: "hero", name: "hero", strategy: RECKLESS };
      const r = raceResultOnly(field, s * 31 + 5, "silverstone");
      const cliff = r.events.find((e) => e.type === "cliff" && e.carId === "hero");
      const crash = r.events.find(
        (e) => e.type === "retirement" && e.carId === "hero" && e.cause === "crash"
      );
      if (cliff && crash && crash.lap >= cliff.lap) crashesAfterCliff++;
    }
    expect(crashesAfterCliff).toBeGreaterThan(0);
  }, STATS_TIMEOUT);

  it("puts every incident at a real braking zone", () => {
    const zones = new Set(getTrack("silverstone").zones.map((z) => z.name));
    for (let s = 0; s < 30; s++) {
      const r = race(grid(), s * 17 + 3, "silverstone");
      for (const e of r.events) {
        if (e.type === "lockup") expect(zones.has(e.zone)).toBe(true);
        if (e.type === "retirement" && e.cause === "crash") {
          expect(zones.has(e.zone!)).toBe(true);
        }
        // A car doesn't crash into a corner because its gearbox broke.
        if (e.type === "retirement" && e.cause === "mechanical") {
          expect(e.zone).toBeNull();
        }
      }
    }
  });

  it("takes a retired car off the track and classifies her behind the finishers", () => {
    for (let s = 0; s < 60; s++) {
      const r = race(grid(), s * 41 + 11, "silverstone");
      const dnfs = r.classification.filter((c) => c.retired !== null);
      if (dnfs.length === 0) continue;

      // Classified behind everyone who took the flag.
      const lastFinisher = Math.max(
        ...r.classification.filter((c) => c.retired === null).map((c) => c.position)
      );
      for (const d of dnfs) expect(d.position).toBeGreaterThan(lastFinisher);

      // And she stops moving the moment she's out.
      for (const id of dnfs.map((d) => d.id)) {
        let sawRetired = false;
        let frozenAt: number | null = null;
        for (const f of r.frames) {
          const c = f.cars.find((x) => x.id === id)!;
          if (!c.retired) continue;
          sawRetired = true;
          const total = c.lap + c.lapPosition;
          if (frozenAt === null) frozenAt = total;
          else expect(total).toBeCloseTo(frozenAt, 6);
        }
        expect(sawRetired).toBe(true);
      }
      return; // one race with a DNF is enough
    }
  });

  it("still finishes the race when cars retire", () => {
    for (let s = 0; s < 40; s++) {
      const r = race(grid(), s * 13 + 7, "silverstone");
      // Everyone either took the flag or is out. Nobody is left circulating.
      for (const c of r.classification) {
        expect(c.retired !== null || c.laps === LAPS).toBe(true);
      }
    }
  });
});

describe("simulateRace — the pit lane is not the racing line", () => {
  it("never lets a car in the pits block a car on track", () => {
    // Josh spotted cars stopping dead on the start/finish line mid-race. A
    // pitting car's progress freezes at the line, but it was still in the
    // running order — so the blocking logic treated it as a stationary obstacle
    // ON TRACK and queued whole trains of cars up behind a rival who was
    // actually sitting in the pit box. Visible on screen, and quietly wrecking
    // every result.
    for (let seed = 0; seed < 10; seed++) {
      const r = race(grid(), seed * 71 + 5);
      for (let f = 1; f < r.frames.length; f++) {
        const prev = r.frames[f - 1];
        const cur = r.frames[f];
        if (!cur.cars.some((c) => c.inPit)) continue;
        for (let i = 0; i < cur.cars.length; i++) {
          const before = prev.cars[i];
          const after = cur.cars[i];
          // In the pits, out of the race, or already home: not on the racing line.
          if (after.inPit || after.finished || after.retired) continue;
          const moved =
            after.lap + after.lapPosition - (before.lap + before.lapPosition);
          // A car on track always makes progress. Zero movement means it is
          // stuck behind something that isn't there.
          expect(moved).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("simulateRace — leading must not be a penalty", () => {
  it("lets the car in front push to DEFEND, not just to chase", () => {
    // The leader has nobody ahead, so a mode rule that only pushes when chasing
    // left it permanently in neutral/conserve while the entire field behind
    // pushed — up to 0.9s a lap slower than everyone chasing it. The polesitter
    // got swallowed and finished LAST, and pole was worth less than random.
    const r = race(grid(), 13, "zandvoort");
    let leaderPush = 0;
    let leaderTicks = 0;
    for (const f of r.frames) {
      const leader = f.cars.find((c) => c.position === 1);
      if (!leader || leader.inPit || leader.finished) continue;
      leaderTicks++;
      if (leader.mode === "push") leaderPush++;
    }
    expect(leaderTicks).toBeGreaterThan(0);
    expect(leaderPush / leaderTicks).toBeGreaterThan(0.1);
  });

  it("makes pole worth MORE than a random grid slot", () => {
    // The headline sanity check on the whole race model. On a circuit where
    // passing is hard, starting first must be a real advantage — if this ever
    // drops back to ~12.5% (one-in-eight, i.e. chance), leading has silently
    // become a punishment again.
    let poleWins = 0;
    const runs = 40;
    for (let s = 0; s < runs; s++) {
      const seed = s * 7919 + 13;
      const track = getTrack("zandvoort");
      const order = gridFromQualifying(grid(), track, seed);
      const r = simulateRace({ track, laps: LAPS, entrants: order, seed });
      if (r.classification[0].id === order[0].id) poleWins++;
    }
    expect(poleWins / runs).toBeGreaterThan(0.3);
  }, STATS_TIMEOUT);
});

describe("simulateRace — stats and strategy decide races", () => {
  // Balance regressions. These pin the PROPERTIES that make this a game rather
  // than a dice roll, measured over many seeds. They are deliberately loose —
  // they should survive honest retuning and fail loudly on a change that makes
  // a maxed package a certainty, or makes strategy irrelevant.
  const SEEDS = 60;
  const BASELINE = 1 / 8; // 12.5%: an 8-car grid, if nothing mattered

  function winRate(make: (e: Entrant) => Entrant, trackId = "vegas"): number {
    let wins = 0;
    for (let s = 0; s < SEEDS; s++) {
      const field = grid();
      field[4] = make({ ...field[4], id: "hero", name: "hero", isPlayer: true });
      const seed = s * 7919 + 13;
      const track = getTrack(trackId);
      const order = gridFromQualifying(field, track, seed);
      const result = simulateRace({
        track,
        laps: LAPS,
        entrants: order,
        seed,
        captureFrames: false,
      });
      if (result.classification[0].id === "hero") wins++;
    }
    return wins / SEEDS;
  }

  it("rewards a faster driver, decisively", () => {
    const rate = winRate((e) => ({
      ...e,
      driver: driver({ pace: 100, racecraft: 100, consistency: 100 }),
    }));
    expect(rate).toBeGreaterThan(BASELINE * 2);
  }, STATS_TIMEOUT);

  it("rewards a better car, decisively", () => {
    const rate = winRate((e) => ({
      ...e,
      car: car({ power: 100, aero: 100, reliability: 90, pitCrew: 90 }),
    }));
    expect(rate).toBeGreaterThan(BASELINE * 2);
  }, STATS_TIMEOUT);

  it("makes a SMALL edge a nudge, not a win button", () => {
    // +15 pace on one stat must help — but a modest advantage must not win half
    // the field. If this ever climbs past ~50% the stat weights are too strong
    // and upgrades have become pay-to-win.
    const rate = winRate((e) => ({ ...e, driver: driver({ pace: 75 }) }));
    expect(rate).toBeGreaterThan(BASELINE);
    expect(rate).toBeLessThan(0.5);
  }, STATS_TIMEOUT);

  it("keeps the tyre economy alive — a stop has to be worth making", () => {
    // If degradation is ever tuned so gently that fresh rubber can't pay back a
    // pit stop, the sim rationally stops pitting and the whole strategy layer
    // dies quietly. That happened once. Assert cars actually box.
    let stops = 0;
    for (let s = 0; s < 20; s++) {
      const r = race(grid(), s * 31 + 5);
      stops += r.classification.reduce((n, c) => n + c.pitStops, 0) / 8;
    }
    expect(stops / 20).toBeGreaterThan(0.6); // ~1 stop per car in practice
  });

  it("never makes a pit stop that cannot pay for itself", () => {
    // A stop costs ~15s. Boxing on the last lap is always wrong, and a sim that
    // does it quantises the whole field into pit-stop-sized bands.
    for (let s = 0; s < 20; s++) {
      const r = race(grid(), s * 97 + 11);
      for (const e of r.events) {
        if (e.type === "pit") expect(e.lap).toBeLessThan(LAPS - 1);
      }
    }
  });

  it("punishes a reckless tyre plan", () => {
    // Same driver, same car — one boxes sensibly, one runs the softs into the
    // ground. Strategy is a skill, so the sensible plan must usually win out.
    let sensibleAhead = 0;
    for (let s = 0; s < SEEDS; s++) {
      const field = grid();
      field[0] = {
        ...field[0],
        id: "sensible",
        name: "sensible",
        strategy: strategy({ startCompound: "soft", pitAtWear: 0.55 }),
      };
      field[1] = {
        ...field[1],
        id: "reckless",
        name: "reckless",
        strategy: strategy({ startCompound: "soft", pitAtWear: 0.99 }),
      };
      const r = race(field, s * 13 + 3);
      const a = r.classification.find((c) => c.id === "sensible")!;
      const b = r.classification.find((c) => c.id === "reckless")!;
      if (a.position < b.position) sensibleAhead++;
    }
    expect(sensibleAhead / SEEDS).toBeGreaterThan(0.6);
  }, STATS_TIMEOUT);
});

describe("simulateQualifying", () => {
  it("is deterministic and ranks the field fastest-first", () => {
    const field = grid();
    const a = simulateQualifying(field, getTrack("vegas"), 42);
    const b = simulateQualifying(field, getTrack("vegas"), 42);
    expect(a).toEqual(b);
    for (let i = 1; i < a.length; i++) {
      expect(a[i].lapTime).toBeGreaterThanOrEqual(a[i - 1].lapTime);
      expect(a[i].gap).toBeGreaterThanOrEqual(0);
    }
    expect(a[0].gap).toBe(0);
  });

  it("puts a quicker driver on pole far more often than chance", () => {
    let poles = 0;
    for (let s = 0; s < 60; s++) {
      const field = grid();
      field[3] = { ...field[3], id: "hero", driver: driver({ pace: 100, consistency: 95 }) };
      const q = simulateQualifying(field, getTrack("vegas"), s * 17 + 1);
      if (q[0].id === "hero") poles++;
    }
    expect(poles / 60).toBeGreaterThan(1 / 8);
  });
});

describe("simulateRace — track character", () => {
  it("makes passing harder at Zandvoort than on the Las Vegas straights", () => {
    const countPasses = (trackId: string) => {
      let total = 0;
      for (let seed = 0; seed < 12; seed++) {
        const result = race(grid(), seed * 17 + 3, trackId);
        total += result.events.filter((e) => e.type === "overtake").length;
      }
      return total;
    };
    expect(countPasses("vegas")).toBeGreaterThan(countPasses("zandvoort"));
  });

  it("makes track choice strategic: Vegas is a passing track, Zandvoort is not", () => {
    // The circuits' real, robust difference — and the reason picking one is a
    // strategic act. Zandvoort has two zones (one a 0.55-difficulty banking);
    // Vegas has three, including a 1.5x slipstream straight. Vegas reliably
    // produces about three times the overtaking.
    //
    // NOTE: an earlier version of this test asserted that POLE converts more
    // often at Zandvoort. It doesn't, robustly — measured across pit strategies
    // that gap swings from -21pp to +36pp, i.e. it was noise, and the flattering
    // number came from one arbitrary plan. Overtaking count is the property that
    // actually holds. Measure the thing that's real, not the thing that sounds
    // good.
    const passesPerRace = (trackId: string) => {
      let total = 0;
      const runs = 30;
      for (let s = 0; s < runs; s++) {
        const r = race(grid(), s * 7919 + 13, trackId);
        total += r.events.filter((e) => e.type === "overtake").length;
      }
      return total / runs;
    };
    expect(passesPerRace("vegas")).toBeGreaterThan(passesPerRace("zandvoort") * 2);
  }, STATS_TIMEOUT);
});
