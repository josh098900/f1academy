import {
  type CarStats,
  type Entrant,
  type QualifyingResult,
  type RaceReport,
  type RaceResult,
  Rng,
  type Strategy,
  type Tuning,
  buildRaceReport,
  getTrack,
  simulateQualifying,
  simulateRace,
} from "@/lib/race-sim";

import type { RatedDriver } from "./ratings";

// The Quick Race, as a pure function — THE function, singular, because it now
// runs in two places that must agree to the byte: the browser (which shows
// the broadcast) and the server action (which mints the seed, re-simulates,
// and banks the coins). If the two ever built the field differently, the race
// the player watched and the race they were paid for would be different
// races. So everything that shapes the grid lives here and nowhere else.

export const PADDOCK_TRACK_ID = "silverstone"; // the only circuit with a racing line so far
export const PADDOCK_LAPS = 15;
export const PADDOCK_FIELD = 8;

// Identical machinery for everyone, so the race is decided by the driver you
// picked and the plan you wrote. The garage is where this stops being true.
export const STOCK_CAR: CarStats = {
  power: 60,
  aero: 60,
  reliability: 60,
  pitCrew: 60,
};

// Believable opposition: a spread of plans, so the field doesn't all pit on
// the same lap and the race has some shape to it.
function npcStrategy(rng: Rng): Strategy {
  const roll = rng.next();
  if (roll < 0.3) {
    // The opportunist: aggressive tyres, jumps at a cheap stop.
    return {
      startCompound: "soft",
      pitCompound: "medium",
      pitAtWear: 0.58,
      boxUnderSafetyCar: true,
      attackWithin: 1.3,
      conserveWhenLeadingBy: 2.5,
    };
  }
  if (roll < 0.75) {
    return {
      startCompound: "medium",
      pitCompound: "hard",
      pitAtWear: 0.66,
      boxUnderSafetyCar: true,
      attackWithin: 0.9,
      conserveWhenLeadingBy: 3.0,
    };
  }
  // The track-position team: hards, run long, and a caution doesn't tempt
  // them out of the plan.
  return {
    startCompound: "hard",
    pitCompound: "medium",
    pitAtWear: 0.8,
    boxUnderSafetyCar: false,
    attackWithin: 0.7,
    conserveWhenLeadingBy: 3.5,
  };
}

// Quickest first — and a TOTAL order, ties broken on driver id. This matters
// more than it looks: NPC plans are dealt out in ranking order, and the
// browser and the server receive the driver list in whatever order their
// queries returned it. Two drivers on equal pace sorted "stably" would sort
// differently on each side, deal different plans, and produce two different
// races from the same seed.
export function rankDrivers(drivers: RatedDriver[]): RatedDriver[] {
  return [...drivers].sort(
    (a, b) => b.stats.pace - a.stats.pace || a.driverId - b.driverId
  );
}

export type QuickRaceRun = {
  entrants: Entrant[]; // grid order, pole first
  quali: QualifyingResult[];
  result: RaceResult;
  report: RaceReport;
  playerId: string;
  gridPosition: number; // the player's, 1-based
};

export function runQuickRace(
  drivers: RatedDriver[],
  playerDriverId: number,
  playerStrategy: Strategy,
  seed: number,
  opts: { captureFrames?: boolean; tuning?: Partial<Tuning> } = {}
): QuickRaceRun | null {
  const ranked = rankDrivers(drivers);
  const me = ranked.find((d) => d.driverId === playerDriverId);
  if (!me || ranked.length < PADDOCK_FIELD) return null;

  const playerId = String(playerDriverId);
  const rng = new Rng(seed ^ 0x5f3759df);
  const rivals = ranked
    .filter((d) => d.driverId !== playerDriverId)
    .slice(0, PADDOCK_FIELD - 1);

  const entrants: Entrant[] = [
    {
      id: playerId,
      name: me.shortName,
      driver: me.stats,
      car: STOCK_CAR,
      strategy: playerStrategy,
      isPlayer: true,
    },
    ...rivals.map((d) => ({
      id: String(d.driverId),
      name: d.shortName,
      driver: d.stats,
      car: STOCK_CAR,
      strategy: npcStrategy(rng),
      isPlayer: false,
    })),
  ];

  const track = getTrack(PADDOCK_TRACK_ID);
  // Qualify once, and keep the sheet: it IS the grid, and it's also the
  // screen the player sees. (gridFromQualifying would re-run the shootout
  // and throw the lap times away.)
  const quali = simulateQualifying(entrants, track, seed);
  const byId = new Map(entrants.map((e) => [e.id, e]));
  const grid = quali.map((q) => byId.get(q.id)!);

  const result = simulateRace({
    track,
    laps: PADDOCK_LAPS,
    entrants: grid,
    seed,
    captureFrames: opts.captureFrames,
    tuning: opts.tuning,
  });
  const report = buildRaceReport({
    result,
    playerId,
    gridOrder: grid.map((e) => e.id),
  });

  return {
    entrants: grid,
    quali,
    result,
    report,
    playerId,
    gridPosition: grid.findIndex((e) => e.id === playerId) + 1,
  };
}
