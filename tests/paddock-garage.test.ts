import { describe, expect, it } from "vitest";

import {
  MAX_LEVEL,
  MAX_RANK,
  RANK_SIZE,
  TIERS,
  ZERO_LEVELS,
  carStatsFor,
  npcLevelsFor,
  rankFor,
  statFor,
  tierIndexOf,
  totalLevels,
  upgradeCost,
} from "../lib/paddock/garage";
import { Rng } from "../lib/race-sim";

describe("the garage model", () => {
  it("maps levels to tiers: five each, Bronze to Diamond, stock has none", () => {
    expect(tierIndexOf(0)).toBe(-1);
    expect(TIERS[tierIndexOf(1)].id).toBe("bronze");
    expect(TIERS[tierIndexOf(5)].id).toBe("bronze");
    expect(TIERS[tierIndexOf(6)].id).toBe("silver");
    expect(TIERS[tierIndexOf(15)].id).toBe("gold");
    expect(TIERS[tierIndexOf(21)].id).toBe("diamond");
    expect(TIERS[tierIndexOf(25)].id).toBe("diamond");
  });

  it("runs the stat curve from stock 60 to Diamond 95, monotonically", () => {
    expect(statFor(0)).toBe(60);
    expect(statFor(MAX_LEVEL)).toBe(95);
    for (let l = 1; l <= MAX_LEVEL; l++) {
      expect(statFor(l)).toBeGreaterThan(statFor(l - 1));
    }
    // A zero-level garage IS the stock car everyone started with.
    expect(carStatsFor(ZERO_LEVELS)).toEqual({
      power: 60,
      aero: 60,
      reliability: 60,
      pitCrew: 60,
    });
  });

  it("prices every level, climbing within a tier and JUMPING at tier doors", () => {
    let previous = 0;
    for (let from = 0; from < MAX_LEVEL; from++) {
      const cost = upgradeCost(from)!;
      expect(cost).toBeGreaterThan(0);
      const enteringNewTier = from % 5 === 0 && from > 0;
      if (enteringNewTier) {
        // The "new part" moment: crossing a tier door costs more than the
        // level before it — noticeably.
        expect(cost).toBeGreaterThan(previous * 1.2);
      }
      previous = cost;
    }
    // Nothing to buy past the top.
    expect(upgradeCost(MAX_LEVEL)).toBeNull();
    // And the first purchase is a day-one purchase (one decent race pays it).
    expect(upgradeCost(0)!).toBeLessThanOrEqual(100);
  });

  it("derives rank from the garage, one step per ten levels", () => {
    expect(rankFor(0)).toBe(1);
    expect(rankFor(RANK_SIZE - 1)).toBe(1);
    expect(rankFor(RANK_SIZE)).toBe(2);
    expect(rankFor(4 * MAX_LEVEL)).toBe(MAX_RANK);
    expect(
      rankFor(totalLevels({ power: 5, aero: 5, reliability: 5, pitCrew: 5 }))
    ).toBe(3);
  });

  it("builds NPC garages to the rank's ENTRY strength — the lag is the point", () => {
    // Rank 4 entry = 30 total levels; jitter is ±3. A player anywhere in
    // rank 4 owns 30–39, so a fresh promotee races equals and a big spender
    // sits comfortably ahead until promotion resets the tension.
    const rng = new Rng(42);
    for (let i = 0; i < 200; i++) {
      const npc = npcLevelsFor(4, rng);
      const total = totalLevels(npc);
      expect(total).toBeGreaterThanOrEqual(27);
      expect(total).toBeLessThanOrEqual(33);
      for (const v of Object.values(npc)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(MAX_LEVEL);
      }
    }
  });

  it("keeps rank 1 fields essentially stock — new players meet the old game", () => {
    const rng = new Rng(7);
    for (let i = 0; i < 100; i++) {
      // Entry 0, jitter clamped at 0 from below: at most a few token levels.
      expect(totalLevels(npcLevelsFor(1, rng))).toBeLessThanOrEqual(3);
    }
  });

  it("is deterministic: same rng stream, same garages", () => {
    const a = new Rng(123);
    const b = new Rng(123);
    for (let i = 0; i < 20; i++) {
      expect(npcLevelsFor(5, a)).toEqual(npcLevelsFor(5, b));
    }
  });
});
