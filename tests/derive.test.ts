import { describe, expect, it } from "vitest";

import { NEUTRAL, deriveDriverStats, type DriverForm } from "../lib/race-sim";

function form(overrides: Partial<DriverForm> = {}): DriverForm {
  return { qualifying: [], races: [], fieldSize: 18, ...overrides };
}

describe("deriveDriverStats — ratings are read from reality, never invented", () => {
  it("treats a driver with no results as an unknown, not a bad driver", () => {
    const s = deriveDriverStats(form());
    expect(s.pace).toBe(NEUTRAL);
    expect(s.racecraft).toBe(NEUTRAL);
    expect(s.consistency).toBe(NEUTRAL);
  });

  it("rates a pole-sitter far quicker than a backmarker", () => {
    const quick = deriveDriverStats(form({ qualifying: [1, 1, 2] }));
    const slow = deriveDriverStats(form({ qualifying: [16, 17, 18] }));
    expect(quick.pace).toBeGreaterThan(slow.pace + 30);
    expect(quick.pace).toBeLessThanOrEqual(98);
    expect(slow.pace).toBeGreaterThanOrEqual(30);
  });

  it("rewards places gained and punishes places lost", () => {
    const climber = deriveDriverStats(
      form({
        races: [
          { gridPosition: 8, position: 4, classified: true },
          { gridPosition: 10, position: 6, classified: true },
        ],
      })
    );
    const sinker = deriveDriverStats(
      form({
        races: [
          { gridPosition: 4, position: 8, classified: true },
          { gridPosition: 6, position: 10, classified: true },
        ],
      })
    );
    expect(climber.racecraft).toBeGreaterThan(NEUTRAL);
    expect(sinker.racecraft).toBeLessThan(NEUTRAL);
  });

  it("does not double-punish a DNF: it costs consistency, not racecraft", () => {
    const races = [
      { gridPosition: 5, position: 3, classified: true },
      { gridPosition: 5, position: null, classified: false }, // retired
    ];
    const s = deriveDriverStats(form({ races }));
    const cleanRun = deriveDriverStats(
      form({ races: [{ gridPosition: 5, position: 3, classified: true }] })
    );
    // Same racecraft (the retirement is ignored there)…
    expect(s.racecraft).toBe(cleanRun.racecraft);
    // …but she is measurably less reliable.
    expect(s.consistency).toBeLessThan(cleanRun.consistency);
  });

  it("keeps every rating inside the usable band", () => {
    const extremes = [
      form({ qualifying: [1], races: [{ gridPosition: 18, position: 1, classified: true }] }),
      form({ qualifying: [18], races: [{ gridPosition: 1, position: 18, classified: false }] }),
    ];
    for (const f of extremes) {
      const s = deriveDriverStats(f);
      for (const v of [s.pace, s.racecraft, s.consistency]) {
        expect(v).toBeGreaterThanOrEqual(30);
        expect(v).toBeLessThanOrEqual(98);
      }
    }
  });
});
