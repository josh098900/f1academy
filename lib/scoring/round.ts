// Round-level scoring for one user — pure, on top of scoreDriverWeekend.
// The scoreRound action supplies the per-driver session data; this stays
// testable and deterministic.

import { transferPenalty } from "../team-rules";
import { type DriverSession, scoreDriverWeekend } from "./index";

export type DriverBreakdown = {
  driverId: number;
  base: number;
  total: number;
  boosted: boolean;
};

export type UserRoundScore = {
  roundPoints: number; // after the transfer penalty
  boostPointsAdded: number; // extra points from the boost (the doubling)
  transferPenalty: number;
  breakdown: { drivers: DriverBreakdown[]; transferPenalty: number };
};

export function scoreUserRound(input: {
  driverIds: number[];
  boostDriverId: number;
  transfersUsed: number;
  wildcard: boolean;
  sessionsByDriver: Map<number, DriverSession[]>;
  incomingPodiumByDriver?: Map<number, boolean>;
}): UserRoundScore {
  let driversTotal = 0;
  let boostPointsAdded = 0;

  const drivers: DriverBreakdown[] = input.driverIds.map((id) => {
    const boosted = id === input.boostDriverId;
    const ws = scoreDriverWeekend({
      sessions: input.sessionsByDriver.get(id) ?? [],
      boost: boosted,
      incomingPodium: input.incomingPodiumByDriver?.get(id) ?? false,
    });
    driversTotal += ws.total;
    if (boosted) boostPointsAdded = ws.total - ws.base;
    return { driverId: id, base: ws.base, total: ws.total, boosted };
  });

  const penalty = transferPenalty(input.transfersUsed, input.wildcard);
  return {
    roundPoints: driversTotal - penalty,
    boostPointsAdded,
    transferPenalty: penalty,
    breakdown: { drivers, transferPenalty: penalty },
  };
}
