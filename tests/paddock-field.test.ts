import { describe, expect, it } from "vitest";

import { RACE_PAYOUT, RETIRED_PAYOUT, racePayout } from "../lib/paddock/economy";
import { rankDrivers, runQuickRace } from "../lib/paddock/field";
import type { RatedDriver } from "../lib/paddock/ratings";
import type { Strategy } from "../lib/race-sim";

// A field with a deliberate PACE TIE (Bruce and Felbermayr, both 73): the
// ranking must be a total order, or the browser and the server — which
// receive this list in whatever order their queries returned it — would deal
// NPC plans differently and race two different races from one seed.
const DRIVERS: RatedDriver[] = [
  { driverId: 1, name: "Alisha Palmowski", shortName: "A. Palmowski", stats: { pace: 75, racecraft: 71, consistency: 85 } },
  { driverId: 2, name: "Ella Bruce", shortName: "E. Bruce", stats: { pace: 73, racecraft: 42, consistency: 85 } },
  { driverId: 3, name: "Emma Felbermayr", shortName: "E. Felbermayr", stats: { pace: 73, racecraft: 60, consistency: 85 } },
  { driverId: 4, name: "Nina Gademan", shortName: "N. Gademan", stats: { pace: 71, racecraft: 66, consistency: 79 } },
  { driverId: 5, name: "Poppy Westcott", shortName: "P. Westcott", stats: { pace: 70, racecraft: 39, consistency: 85 } },
  { driverId: 6, name: "Lola Billard", shortName: "L. Billard", stats: { pace: 69, racecraft: 31, consistency: 85 } },
  { driverId: 7, name: "Chiara Bättig", shortName: "C. Bättig", stats: { pace: 68, racecraft: 53, consistency: 74 } },
  { driverId: 8, name: "Maya Paatz", shortName: "M. Paatz", stats: { pace: 67, racecraft: 48, consistency: 85 } },
  { driverId: 9, name: "Alba Hurup Larsen", shortName: "A. Hurup Larsen", stats: { pace: 66, racecraft: 38, consistency: 85 } },
];

const PLAN: Strategy = {
  startCompound: "medium",
  pitCompound: "hard",
  pitAtWear: 0.65,
  boxUnderSafetyCar: true,
  attackWithin: 1.0,
  conserveWhenLeadingBy: 3.0,
};

describe("paddock economy", () => {
  it("pays by finishing position, winner 10x last", () => {
    expect(racePayout({ position: 1, retired: null })).toBe(RACE_PAYOUT[0]);
    expect(racePayout({ position: 8, retired: null })).toBe(RACE_PAYOUT[7]);
    expect(RACE_PAYOUT[0]).toBe(RACE_PAYOUT[7] * 10);
  });

  it("pays a retirement a consolation, whatever the classified position", () => {
    expect(racePayout({ position: 3, retired: "crash" })).toBe(RETIRED_PAYOUT);
    expect(racePayout({ position: 8, retired: "mechanical" })).toBe(
      RETIRED_PAYOUT
    );
  });
});

describe("runQuickRace — one race, wherever it runs", () => {
  it("ranks with a total order, so a pace tie cannot reorder the field", () => {
    const shuffled = [...DRIVERS].reverse();
    expect(rankDrivers(shuffled).map((d) => d.driverId)).toEqual(
      rankDrivers(DRIVERS).map((d) => d.driverId)
    );
    // The tie itself: equal pace resolves by driver id, deterministically.
    const ranked = rankDrivers(DRIVERS);
    expect(ranked[1].driverId).toBe(2);
    expect(ranked[2].driverId).toBe(3);
  });

  it("produces the identical race regardless of driver-list order", () => {
    // This is the client/server contract: the browser and the server action
    // receive the drivers from different queries in different orders, and
    // both must replay the same race from the same seed.
    const a = runQuickRace(DRIVERS, 3, PLAN, 987654321)!;
    const b = runQuickRace([...DRIVERS].reverse(), 3, PLAN, 987654321)!;
    expect(a.result.events).toEqual(b.result.events);
    expect(a.result.classification).toEqual(b.result.classification);
    expect(a.quali).toEqual(b.quali);
    expect(a.gridPosition).toBe(b.gridPosition);
  });

  it("banks the same race the broadcast shows — frames are the only difference", () => {
    const banked = runQuickRace(DRIVERS, 1, PLAN, 13579, {
      captureFrames: false,
    })!;
    const watched = runQuickRace(DRIVERS, 1, PLAN, 13579)!;
    expect(banked.result.frames).toHaveLength(0);
    expect(watched.result.frames.length).toBeGreaterThan(0);
    expect(banked.result.classification).toEqual(
      watched.result.classification
    );
    expect(banked.result.events).toEqual(watched.result.events);
    expect(banked.report).toEqual(watched.report);
  });

  it("refuses a driver who isn't on the grid, and a grid that's too small", () => {
    expect(runQuickRace(DRIVERS, 999, PLAN, 1)).toBeNull();
    expect(runQuickRace(DRIVERS.slice(0, 5), 1, PLAN, 1)).toBeNull();
  });

  it("scales the field to the garage you bring — nobody stomps stock NPCs", () => {
    const stock = runQuickRace(DRIVERS, 1, PLAN, 555)!;
    const upgraded = runQuickRace(DRIVERS, 1, PLAN, 555, {
      // Full Silver everything: 40 total levels = rank 5.
      carLevels: { power: 10, aero: 10, reliability: 10, pitCrew: 10 },
    })!;
    expect(stock.rank).toBe(1);
    expect(upgraded.rank).toBe(5);

    const myStock = stock.entrants.find((e) => e.isPlayer)!;
    const myUpgraded = upgraded.entrants.find((e) => e.isPlayer)!;
    expect(myStock.car.power).toBe(60);
    expect(myUpgraded.car.power).toBeCloseTo(74);

    // The rivals came to the fight: every rank-5 NPC car clearly outguns its
    // rank-1 (stock) self — machinery only, driver ratings untouched.
    for (const e of upgraded.entrants.filter((x) => !x.isPlayer)) {
      const total =
        e.car.power + e.car.aero + e.car.reliability + e.car.pitCrew;
      expect(total).toBeGreaterThan(4 * 60 + 40);
      const twin = stock.entrants.find((s) => s.id === e.id)!;
      expect(twin.driver).toEqual(e.driver); // reality-derived, never scaled
    }
  });
});
