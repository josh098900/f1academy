import { describe, expect, it } from "vitest";

import { deriveGrid, raceFormat } from "../lib/wiki/grid";

// quali: driver 1 = P1, ... driver 10 = P10
const quali = new Map<number, number>(
  Array.from({ length: 10 }, (_, i) => [i + 1, i + 1])
);

describe("raceFormat", () => {
  it("maps race slots by weekend length", () => {
    expect(raceFormat("race1", false)).toBe("reverse-grid");
    expect(raceFormat("race2", false)).toBe("feature");
    expect(raceFormat("race1", true)).toBe("opening");
    expect(raceFormat("race2", true)).toBe("reverse-grid");
    expect(raceFormat("race3", true)).toBe("feature");
  });
});

describe("deriveGrid", () => {
  it("feature race grid is the qualifying order", () => {
    const g = deriveGrid(quali, "race2", false);
    expect(g.get(1)).toBe(1);
    expect(g.get(10)).toBe(10);
  });

  it("reverse-grid race inverts the top 8, leaves P9+ alone", () => {
    const g = deriveGrid(quali, "race1", false);
    expect(g.get(1)).toBe(8); // P1 quali -> grid 8
    expect(g.get(8)).toBe(1); // P8 quali -> pole
    expect(g.get(4)).toBe(5);
    expect(g.get(9)).toBe(9); // outside top 8 unchanged
    expect(g.get(10)).toBe(10);
  });

  it("three-race weekend: race2 is the reverse-grid race", () => {
    const g = deriveGrid(quali, "race2", true);
    expect(g.get(1)).toBe(8);
    expect(g.get(8)).toBe(1);
  });
});
