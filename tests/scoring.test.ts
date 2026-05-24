import { describe, expect, it } from "vitest";

import {
  fastestLapBonus,
  positionDelta,
  qualifyingPoints,
  raceScore,
  racePoints,
  scoreDriverWeekend,
  type DriverSession,
} from "../lib/scoring";

describe("qualifyingPoints", () => {
  it("matches the qualifying table", () => {
    expect(qualifyingPoints(1)).toBe(10);
    expect(qualifyingPoints(2)).toBe(8);
    expect(qualifyingPoints(3)).toBe(6);
    expect(qualifyingPoints(6)).toBe(3);
    expect(qualifyingPoints(7)).toBe(2);
    expect(qualifyingPoints(10)).toBe(2);
    expect(qualifyingPoints(11)).toBe(1);
    expect(qualifyingPoints(15)).toBe(1);
    expect(qualifyingPoints(16)).toBe(0);
    expect(qualifyingPoints(null)).toBe(0);
  });
});

describe("racePoints", () => {
  it("matches the race table and penalties", () => {
    expect(racePoints(1, "classified")).toBe(25);
    expect(racePoints(10, "classified")).toBe(1);
    expect(racePoints(11, "classified")).toBe(0);
    expect(racePoints(15, "classified")).toBe(0);
    expect(racePoints(16, "classified")).toBe(-2);
    expect(racePoints(null, "dnf")).toBe(-5);
    expect(racePoints(null, "dsq")).toBe(-10);
    expect(racePoints(null, "dns")).toBe(0);
  });
});

describe("fastestLapBonus", () => {
  it("only rewards a classified top-10 finish", () => {
    expect(fastestLapBonus(5, true, "classified")).toBe(5);
    expect(fastestLapBonus(10, true, "classified")).toBe(5);
    expect(fastestLapBonus(11, true, "classified")).toBe(0);
    expect(fastestLapBonus(5, false, "classified")).toBe(0);
    expect(fastestLapBonus(1, true, "dnf")).toBe(0);
  });
});

describe("positionDelta", () => {
  it("rewards gains and caps losses at -5", () => {
    expect(positionDelta(10, 5, "classified")).toBe(5);
    expect(positionDelta(8, 7, "classified")).toBe(1);
    expect(positionDelta(3, 3, "classified")).toBe(0);
    expect(positionDelta(5, 8, "classified")).toBe(-3);
    expect(positionDelta(1, 20, "classified")).toBe(-5); // capped
    expect(positionDelta(null, 5, "classified")).toBe(0);
    expect(positionDelta(3, null, "dnf")).toBe(0);
  });
});

describe("raceScore", () => {
  it("combines finishing points, fastest lap, and positions delta", () => {
    const win: DriverSession = {
      type: "race1", position: 1, gridPosition: 1, status: "classified", fastestLap: true,
    };
    expect(raceScore(win)).toBe(30); // 25 + 5 + 0
    const dnf: DriverSession = {
      type: "race2", position: null, gridPosition: 4, status: "dnf", fastestLap: false,
    };
    expect(raceScore(dnf)).toBe(-5);
  });
});

// Helpers for the worked example.
function quali(position: number): DriverSession {
  return { type: "qualifying", position, gridPosition: null, status: "classified", fastestLap: false };
}
function race(
  type: "race1" | "race2",
  position: number | null,
  gridPosition: number | null,
  opts: { fastestLap?: boolean; status?: DriverSession["status"] } = {}
): DriverSession {
  return {
    type,
    position,
    gridPosition,
    status: opts.status ?? "classified",
    fastestLap: opts.fastestLap ?? false,
  };
}

describe("scoreDriverWeekend — Montreal worked example (SCORING_SYSTEM.md)", () => {
  // Note: corrected so Felbermayr also gets the podium streak the rules imply.
  const felbermayr = scoreDriverWeekend({
    boost: true,
    sessions: [
      quali(1),
      race("race1", 1, 1, { fastestLap: true }),
      race("race2", 2, 3),
    ],
  });
  const palmowski = scoreDriverWeekend({
    sessions: [quali(2), race("race1", 3, 3), race("race2", 1, 2, { fastestLap: true })],
  });
  const gademan = scoreDriverWeekend({
    sessions: [quali(3), race("race1", 4, 4), race("race2", 3, 3)],
  });
  const ferreira = scoreDriverWeekend({
    sessions: [quali(6), race("race1", 7, 8), race("race2", null, null, { status: "dnf" })],
  });

  it("scores Felbermayr 67 base, 134 boosted (pole+win + podium streak)", () => {
    expect(felbermayr.poleAndWin).toBe(5);
    expect(felbermayr.podiumStreak).toBe(3);
    expect(felbermayr.base).toBe(67);
    expect(felbermayr.total).toBe(134);
  });

  it("scores Palmowski 57 (podium streak, no pole+win)", () => {
    expect(palmowski.poleAndWin).toBe(0);
    expect(palmowski.podiumStreak).toBe(3);
    expect(palmowski.total).toBe(57);
  });

  it("scores Gademan 33 (no streak — P4 in race 1 breaks it)", () => {
    expect(gademan.podiumStreak).toBe(0);
    expect(gademan.total).toBe(33);
  });

  it("scores Ferreira 5 (a DNF hurts)", () => {
    expect(ferreira.total).toBe(5);
  });

  it("sums to the round total of 229", () => {
    const round =
      felbermayr.total + palmowski.total + gademan.total + ferreira.total;
    expect(round).toBe(229);
  });
});

describe("scoreDriverWeekend — extras", () => {
  it("bridges a podium streak from the previous round", () => {
    const s = scoreDriverWeekend({
      incomingPodium: true,
      sessions: [quali(5), race("race1", 2, 4)],
    });
    expect(s.podiumStreak).toBe(3); // prev round's last race podium + this race1 podium
  });

  it("awards +3 per consecutive pair across three races", () => {
    const s = scoreDriverWeekend({
      sessions: [
        quali(1),
        race("race1", 1, 1),
        race("race2", 2, 1),
        { type: "race3", position: 3, gridPosition: 2, status: "classified", fastestLap: false },
      ],
    });
    expect(s.podiumStreak).toBe(6); // (r1,r2) + (r2,r3)
  });
});
