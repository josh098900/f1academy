import { describe, expect, it } from "vitest";

import {
  type CarStats,
  type DriverStats,
  type Entrant,
  type Strategy,
  buildRaceReport,
  getTrack,
  gridFromQualifying,
  simulateRace,
} from "../lib/race-sim";

const LAPS = 15;
const CAR: CarStats = { power: 60, aero: 60, reliability: 60, pitCrew: 60 };
const DRIVER: DriverStats = { pace: 60, racecraft: 60, consistency: 60 };
const PLAN: Strategy = {
  startCompound: "medium",
  pitCompound: "hard",
  pitAtWear: 0.65,
  attackWithin: 1.0,
  conserveWhenLeadingBy: 3.0,
};

function field(playerStrategy: Partial<Strategy> = {}): Entrant[] {
  return Array.from({ length: 8 }, (_, i) => ({
    id: String(i + 1),
    name: `Driver ${i + 1}`,
    driver: { ...DRIVER },
    car: { ...CAR },
    strategy: i === 0 ? { ...PLAN, ...playerStrategy } : { ...PLAN },
    isPlayer: i === 0,
  }));
}

function report(entrants: Entrant[], seed = 4242) {
  const track = getTrack("silverstone");
  const grid = gridFromQualifying(entrants, track, seed);
  const result = simulateRace({ track, laps: LAPS, entrants: grid, seed });
  return {
    result,
    report: buildRaceReport({
      result,
      playerId: "1",
      gridOrder: grid.map((e) => e.id),
    }),
  };
}

describe("buildRaceReport — tells you WHY, so you play again", () => {
  it("reports a real finishing position and grid slot", () => {
    const { report: r } = report(field());
    expect(r.position).toBeGreaterThanOrEqual(1);
    expect(r.position).toBeLessThanOrEqual(8);
    expect(r.gridPosition).toBeGreaterThanOrEqual(1);
    expect(r.gridPosition).toBeLessThanOrEqual(8);
    expect(r.placesGained).toBe(r.gridPosition - r.position);
    expect(r.notes.length).toBeGreaterThan(0);
  });

  it("says WINNER only when the player actually won", () => {
    const { report: r } = report(field());
    expect(r.won).toBe(r.position === 1);
    if (r.won) {
      expect(r.headline).toMatch(/winner/i);
    } else {
      expect(r.headline).toContain(`P${r.position}`);
      // A loser is always told who beat them, and by how much.
      expect(r.notes.join(" ")).toMatch(/won it/i);
    }
  });

  it("calls out tyres that went off — the mistake players most need told", () => {
    // Start on softs and refuse to box until they are destroyed.
    const { result, report: r } = report(
      field({ startCompound: "soft", pitAtWear: 0.95 })
    );
    const cliffed = result.events.some(
      (e) => e.type === "cliff" && e.carId === "1"
    );
    expect(cliffed).toBe(true);
    expect(r.notes.join(" ")).toMatch(/tyres went off on lap \d+/i);
  });

  it("notices when the player never boxed at all", () => {
    // Hards, and a threshold the tyre can never reach in 15 laps.
    const { report: r } = report(
      field({ startCompound: "hard", pitAtWear: 0.99 })
    );
    expect(r.notes.join(" ")).toMatch(/never boxed/i);
  });

  it("compares the player's stop to the winner's", () => {
    // Box absurdly early; someone else will run long.
    const { report: r } = report(
      field({ startCompound: "soft", pitAtWear: 0.42 })
    );
    if (!r.won) {
      expect(r.notes.join(" ")).toMatch(/boxed on lap \d+/i);
    }
  });

  it("is honest about places gained and lost", () => {
    const { report: r } = report(field());
    const text = r.notes.join(" ");
    if (r.placesGained > 0) expect(text).toMatch(/gained \d+ place/i);
    else if (r.placesGained < 0) expect(text).toMatch(/lost \d+ place/i);
    else expect(text).toMatch(/held it/i);
  });

  it("returns an empty report rather than throwing for an unknown driver", () => {
    const track = getTrack("silverstone");
    const grid = gridFromQualifying(field(), track, 1);
    const result = simulateRace({ track, laps: LAPS, entrants: grid, seed: 1 });
    const r = buildRaceReport({ result, playerId: "nobody", gridOrder: [] });
    expect(r.position).toBe(0);
    expect(r.notes).toEqual([]);
  });
});
