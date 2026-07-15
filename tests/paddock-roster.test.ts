import { describe, expect, it } from "vitest";

import type { RatedDriver } from "../lib/paddock/ratings";
import {
  CONTRACT_BANDS,
  FREE_SEATS,
  rosterFor,
  usableDriverIds,
} from "../lib/paddock/roster";

// Nine drivers, fastest first by pace (ties impossible here — the total
// order itself is covered in paddock-field tests).
function driver(id: number, pace: number): RatedDriver {
  return {
    driverId: id,
    name: `Driver ${id}`,
    shortName: `D${id}`,
    stats: { pace, racecraft: 60, consistency: 70 },
  };
}
const GRID: RatedDriver[] = [
  driver(1, 75),
  driver(2, 74),
  driver(3, 73),
  driver(4, 71),
  driver(5, 70),
  driver(6, 69),
  driver(7, 68),
  driver(8, 67),
  driver(9, 66),
];

const NONE = new Set<number>();

describe("the roster gate", () => {
  it("gives every team the same four free seats — the slowest four", () => {
    const roster = rosterFor(GRID, NONE, 1);
    const free = roster.filter((e) => e.status === "free");
    expect(free.map((e) => e.driver.driverId)).toEqual([6, 7, 8, 9]);
    expect(free.every((e) => e.band === null)).toBe(true);
    // Input order must not matter — the ranking decides.
    const shuffled = rosterFor([...GRID].reverse(), NONE, 1);
    expect(
      shuffled.filter((e) => e.status === "free").map((e) => e.driver.driverId)
    ).toEqual([6, 7, 8, 9]);
  });

  it("bands the contract drivers with the elite gate narrowest at the top", () => {
    const roster = rosterFor(GRID, NONE, 99);
    // 5 paid seats over 3 bands: 2 challengers (slowest), 2 front runners,
    // 1 elite (the fastest driver in the game).
    expect(roster[0].band?.id).toBe("elite");
    expect(roster[1].band?.id).toBe("frontrunner");
    expect(roster[2].band?.id).toBe("frontrunner");
    expect(roster[3].band?.id).toBe("challenger");
    expect(roster[4].band?.id).toBe("challenger");
    // Prices climb with the bands.
    expect(CONTRACT_BANDS[2].price).toBeGreaterThan(CONTRACT_BANDS[1].price);
    expect(CONTRACT_BANDS[1].price).toBeGreaterThan(CONTRACT_BANDS[0].price);
  });

  it("opens bands by rank: the garage is the door, coins are the pen", () => {
    const atRank1 = rosterFor(GRID, NONE, 1);
    expect(
      atRank1.filter((e) => e.band !== null).every((e) => e.status === "locked")
    ).toBe(true);

    const atRank4 = rosterFor(GRID, NONE, 4);
    expect(atRank4[0].status).toBe("locked"); // elite needs rank 6
    expect(atRank4[1].status).toBe("open");
    expect(atRank4[4].status).toBe("open");

    const atRank6 = rosterFor(GRID, NONE, 6);
    expect(atRank6.filter((e) => e.band !== null).every((e) => e.status === "open")).toBe(
      true
    );
  });

  it("keeps a signature above every gate", () => {
    // Signed while rank was high... or however she got there: signed wins.
    const roster = rosterFor(GRID, new Set([1]), 1);
    expect(roster[0].status).toBe("signed");
  });

  it("computes the drivable set: free seats plus signatures", () => {
    expect([...usableDriverIds(GRID, NONE)].sort()).toEqual([6, 7, 8, 9]);
    const withContract = usableDriverIds(GRID, new Set([2]));
    expect(withContract.has(2)).toBe(true);
    expect(withContract.size).toBe(FREE_SEATS + 1);
  });
});
