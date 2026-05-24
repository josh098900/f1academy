import { describe, expect, it } from "vitest";

import {
  countTransfers,
  resolveWildcard,
  transferPenalty,
  validateTeam,
} from "../lib/team-rules";

// Simple price book for tests.
const PRICES: Record<number, number> = {
  1: 12.5,
  2: 11.0,
  3: 10.0,
  4: 8.0,
  5: 6.5,
  6: 5.0,
};
const priceOf = (id: number) => PRICES[id];

describe("validateTeam", () => {
  it("accepts a legal team within budget with boost in team", () => {
    const r = validateTeam([3, 4, 5, 6], 3, priceOf); // 10+8+6.5+5 = 29.5
    expect(r.valid).toBe(true);
    expect(r.spent).toBe(29.5);
    expect(r.errors).toEqual([]);
  });

  it("rejects fewer or more than four drivers", () => {
    expect(validateTeam([3, 4, 5], 3, priceOf).valid).toBe(false);
    expect(validateTeam([1, 2, 3, 4, 5], 1, priceOf).valid).toBe(false);
  });

  it("rejects going over the £40M cap", () => {
    const r = validateTeam([1, 2, 3, 4], 1, priceOf); // 12.5+11+10+8 = 41.5
    expect(r.valid).toBe(false);
    expect(r.spent).toBe(41.5);
    expect(r.errors.some((e) => e.includes("Over budget"))).toBe(true);
  });

  it("accepts spending exactly the cap", () => {
    // 12.5 + 11 + 10 + 6.5 = 40.0
    const r = validateTeam([1, 2, 3, 5], 1, priceOf);
    expect(r.spent).toBe(40);
    expect(r.valid).toBe(true);
  });

  it("rejects duplicate drivers", () => {
    expect(validateTeam([3, 3, 4, 5], 3, priceOf).valid).toBe(false);
  });

  it("rejects a boost not in the team, or no boost", () => {
    expect(validateTeam([3, 4, 5, 6], 1, priceOf).valid).toBe(false);
    expect(validateTeam([3, 4, 5, 6], null, priceOf).valid).toBe(false);
  });

  it("rejects an unavailable (unpriced) driver", () => {
    const r = validateTeam([3, 4, 5, 99], 3, priceOf);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("isn't available"))).toBe(true);
  });
});

describe("countTransfers", () => {
  it("is zero with no baseline (first round / wildcard reset)", () => {
    expect(countTransfers(null, [1, 2, 3, 4])).toBe(0);
    expect(countTransfers([], [1, 2, 3, 4])).toBe(0);
  });

  it("counts changed drivers regardless of order", () => {
    expect(countTransfers([1, 2, 3, 4], [4, 3, 2, 1])).toBe(0);
    expect(countTransfers([1, 2, 3, 4], [1, 2, 3, 5])).toBe(1);
    expect(countTransfers([1, 2, 3, 4], [1, 2, 6, 5])).toBe(2);
    expect(countTransfers([1, 2, 3, 4], [5, 6, 1, 2])).toBe(2);
  });
});

describe("transferPenalty", () => {
  it("gives one free transfer, then -10 each", () => {
    expect(transferPenalty(0, false)).toBe(0);
    expect(transferPenalty(1, false)).toBe(0);
    expect(transferPenalty(2, false)).toBe(10);
    expect(transferPenalty(4, false)).toBe(30);
  });

  it("waives all penalty under a wildcard", () => {
    expect(transferPenalty(4, true)).toBe(0);
  });
});

describe("resolveWildcard", () => {
  it("is sticky: an existing wildcard on this round stays on (can't be undone)", () => {
    const res = resolveWildcard({
      requested: false,
      existingThisRound: true,
      usedInPriorRound: false,
    });
    expect(res).toEqual({ wildcard: true });
  });

  it("permits activation when never used", () => {
    const res = resolveWildcard({
      requested: true,
      existingThisRound: false,
      usedInPriorRound: false,
    });
    expect(res).toEqual({ wildcard: true });
  });

  it("blocks activation when already spent in a prior round", () => {
    const res = resolveWildcard({
      requested: true,
      existingThisRound: false,
      usedInPriorRound: true,
    });
    expect(res.wildcard).toBe(false);
    expect(res.error).toBe("You've already used your wildcard this season.");
  });

  it("stays off when not requested and not yet used", () => {
    const res = resolveWildcard({
      requested: false,
      existingThisRound: false,
      usedInPriorRound: false,
    });
    expect(res).toEqual({ wildcard: false });
  });
});
