// Derive race grid positions from qualifying, per the documented F1 Academy
// format (stated on the Wikipedia season page):
//   - feature race grid       = qualifying order (fastest laps)
//   - reverse-grid race grid  = top 8 from quali inverted (P8 -> pole), rest in
//                               qualifying order
//   - opening race grid       = second-fastest-lap order — NOT derivable from a
//                               single quali order, so approximated as quali
//                               order (only affects 3-race weekends' race 1)
//
// Grid feeds the positions-gained scoring bonus. See lib/scoring.

export const REVERSE_GRID_COUNT = 8;

export type RaceType = "race1" | "race2" | "race3";
export type RaceFormat = "opening" | "reverse-grid" | "feature";

// Which format each race slot is, depending on the weekend length.
export function raceFormat(raceType: RaceType, threeRace: boolean): RaceFormat {
  if (threeRace) {
    if (raceType === "race1") return "opening";
    if (raceType === "race2") return "reverse-grid";
    return "feature";
  }
  return raceType === "race1" ? "reverse-grid" : "feature";
}

// quali: driverId -> qualifying position (1-based). Returns driverId -> grid.
export function deriveGrid(
  quali: Map<number, number>,
  raceType: RaceType,
  threeRace: boolean
): Map<number, number> {
  const format = raceFormat(raceType, threeRace);
  const grid = new Map<number, number>();
  for (const [driverId, qpos] of quali) {
    if (format === "reverse-grid" && qpos <= REVERSE_GRID_COUNT) {
      grid.set(driverId, REVERSE_GRID_COUNT + 1 - qpos); // P8->1, P1->8
    } else {
      grid.set(driverId, qpos); // feature, opening (approx), or P9+ in reverse
    }
  }
  return grid;
}
