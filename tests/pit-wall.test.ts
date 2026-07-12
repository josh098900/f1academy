import { describe, expect, it } from "vitest";

import { stintPlan, wearPerLap } from "../components/paddock/PitWall";
import {
  COMPOUNDS,
  type Strategy,
  getTrack,
  gridFromQualifying,
  simulateRace,
} from "../lib/race-sim";

const LAPS = 15;
const TRACK = "silverstone";

function plan(over: Partial<Strategy> = {}): Strategy {
  return {
    startCompound: "medium",
    pitCompound: "hard",
    pitAtWear: 0.65,
    attackWithin: 1.0,
    conserveWhenLeadingBy: 3.0,
    ...over,
  };
}

describe("stintPlan — the pit wall must not lie to the player", () => {
  it("predicts the box lap within a lap of what the sim actually does", () => {
    // The stint strip is the whole point of the screen: it shows you the race
    // you just ordered. If its predicted box lap disagreed with the sim, the
    // screen would be lying, and the player's decisions would be made on
    // fiction.
    for (const startCompound of ["soft", "medium", "hard"] as const) {
      for (const pitAtWear of [0.5, 0.65, 0.75]) {
        const s = plan({ startCompound, pitAtWear });
        const predicted = stintPlan(s, TRACK, LAPS).boxLap;
        if (predicted === null) continue;

        const entrants = Array.from({ length: 8 }, (_, i) => ({
          id: String(i + 1),
          name: `d${i + 1}`,
          driver: { pace: 60, racecraft: 60, consistency: 60 },
          car: { power: 60, aero: 60, reliability: 60, pitCrew: 60 },
          strategy: s,
          isPlayer: i === 0,
        }));
        const track = getTrack(TRACK);
        const grid = gridFromQualifying(entrants, track, 99);
        const r = simulateRace({ track, laps: LAPS, entrants: grid, seed: 99 });
        const actual = r.events.find((e) => e.type === "pit" && e.carId === "1");
        expect(actual).toBeDefined();
        if (actual?.type === "pit") {
          expect(Math.abs(actual.lap - predicted)).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("warns exactly when the plan runs past the cliff", () => {
    // Soft cliffs at 70% wear. Boxing at 60% is safe; boxing at 90% is not.
    const safe = plan({ startCompound: "soft", pitAtWear: 0.6 });
    const doomed = plan({ startCompound: "soft", pitAtWear: 0.9 });

    const s1 = stintPlan(safe, TRACK, LAPS);
    const s2 = stintPlan(doomed, TRACK, LAPS);

    expect(s1.boxLap!).toBeLessThanOrEqual(s1.cliffLap!);
    expect(s2.boxLap!).toBeGreaterThan(s2.cliffLap!);
  });

  it("reports no stop when the tyre is never worn enough to trigger one", () => {
    const noStop = plan({ startCompound: "hard", pitAtWear: 0.95 });
    expect(stintPlan(noStop, TRACK, LAPS).boxLap).toBeNull();
  });

  it("wears the soft faster than the hard on the same circuit", () => {
    expect(wearPerLap("soft", TRACK)).toBeGreaterThan(wearPerLap("hard", TRACK));
    expect(COMPOUNDS.soft.cliff).toBeLessThan(COMPOUNDS.hard.cliff);
  });
});
