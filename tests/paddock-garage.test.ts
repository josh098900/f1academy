import { describe, expect, it } from "vitest";

import {
  MAX_LEVEL,
  MAX_RANK,
  MAX_STAFF_LEVEL,
  RANK_SIZE,
  TIERS,
  ZERO_LEVELS,
  ZERO_STAFF,
  applyStaff,
  carStatsFor,
  npcLevelsFor,
  rankFor,
  staffBonus,
  staffCost,
  staffTotal,
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
    // A maxed CAR alone is rank 11; the last three ranks are staff country.
    expect(rankFor(4 * MAX_LEVEL)).toBe(11);
    expect(rankFor(4 * MAX_LEVEL + 3 * MAX_STAFF_LEVEL)).toBe(MAX_RANK);
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

describe("the staff", () => {
  const BASE = { pace: 68, racecraft: 53, consistency: 74 };

  it("maps each department to its stat, one point per level, legibly", () => {
    const bonus = staffBonus({ raceEngineer: 3, simulator: 7, dataAnalyst: 1 });
    expect(bonus).toEqual({ pace: 7, racecraft: 1, consistency: 3 });
  });

  it("boosts WHOEVER is in the car, on top of her real rating — capped at 100", () => {
    const boosted = applyStaff(BASE, {
      raceEngineer: 10,
      simulator: 10,
      dataAnalyst: 10,
    });
    expect(boosted).toEqual({ pace: 78, racecraft: 63, consistency: 84 });
    // Her base is untouched — the bonus is the team's, not hers.
    expect(BASE.pace).toBe(68);
    // And nobody staff-trains past the ceiling.
    expect(
      applyStaff(
        { pace: 95, racecraft: 95, consistency: 95 },
        { raceEngineer: 10, simulator: 10, dataAnalyst: 10 }
      )
    ).toEqual({ pace: 100, racecraft: 100, consistency: 100 });
  });

  it("prices seniority on a climbing curve, and fully-staffed buys nothing", () => {
    let previous = 0;
    for (let l = 0; l < MAX_STAFF_LEVEL; l++) {
      const cost = staffCost(l)!;
      expect(cost).toBeGreaterThan(previous);
      previous = cost;
    }
    expect(staffCost(0)!).toBeGreaterThanOrEqual(100); // after the first parts, not before
    expect(staffCost(MAX_STAFF_LEVEL)).toBeNull();
  });

  it("counts staff toward rank — the matchmaker sees every level", () => {
    expect(staffTotal(ZERO_STAFF)).toBe(0);
    const car = { power: 5, aero: 5, reliability: 5, pitCrew: 0 };
    const staff = { raceEngineer: 3, simulator: 2, dataAnalyst: 0 };
    // 15 car + 5 staff = 20 → rank 3, same as 20 car levels would be.
    expect(rankFor(totalLevels(car) + staffTotal(staff))).toBe(3);
    expect(MAX_RANK).toBe(
      1 + (4 * MAX_LEVEL + 3 * MAX_STAFF_LEVEL) / RANK_SIZE
    );
  });
});
