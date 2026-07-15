import type { CarStats } from "@/lib/race-sim";
import type { Rng } from "@/lib/race-sim";

// The garage: what levels are worth, what they cost, and who you race.
//
// Everything here is BALANCE-AS-DATA, deliberately in code and not the
// database — the DB stores where each player is (four small integers), this
// file decides what that means, so retuning the economy is a deploy.
//
// The shape of progression (Josh's design): each component climbs 25 levels
// through five tiers — Bronze, Silver, Gold, Platinum, Diamond — with a price
// step at every tier door. Your RANK is derived from the car you've built,
// and the NPC field is built to your rank WITH LAG: right after a purchase
// you are clearly ahead and it feels like money well spent; as you close on
// the next rank the field tightens; promotion resets the tension. Rank
// derived from purchases (not results) cannot strand anyone — the classic
// death spiral of results-ranking is losing → earning less → losing forever.

export type CarLevels = {
  power: number;
  aero: number;
  reliability: number;
  pitCrew: number;
};

export const ZERO_LEVELS: CarLevels = {
  power: 0,
  aero: 0,
  reliability: 0,
  pitCrew: 0,
};

export const MAX_LEVEL = 25;
export const TIER_SIZE = 5;

export const TIERS = [
  { id: "bronze", label: "Bronze", colour: "#cd7f32" },
  { id: "silver", label: "Silver", colour: "#c0c0c0" },
  { id: "gold", label: "Gold", colour: "#ffd700" },
  { id: "platinum", label: "Platinum", colour: "#e5e4e2" },
  { id: "diamond", label: "Diamond", colour: "#b9f2ff" },
] as const;

// Level 0 is the stock part — no tier, no shine.
export function tierIndexOf(level: number): number {
  if (level <= 0) return -1;
  return Math.min(TIERS.length - 1, Math.ceil(level / TIER_SIZE) - 1);
}

// The stat curve. Stock is 60 (the car everyone started the season with);
// each level is worth 1.4 stat points, so a full Diamond component reads 95.
// The sim's carWeight does the rest — measured, a maxed package beats an
// average one decisively but not certainly, which is exactly the promise an
// upgrade should keep.
const BASE_STAT = 60;
const STAT_PER_LEVEL = 1.4;

export function statFor(level: number): number {
  const l = Math.max(0, Math.min(MAX_LEVEL, level));
  return BASE_STAT + l * STAT_PER_LEVEL;
}

export function carStatsFor(levels: CarLevels): CarStats {
  return {
    power: statFor(levels.power),
    aero: statFor(levels.aero),
    reliability: statFor(levels.reliability),
    pitCrew: statFor(levels.pitCrew),
  };
}

// What the NEXT level costs, from the level you're on. Prices climb within a
// tier and JUMP at each tier door — that jump is the "new part" moment, and
// the test insists on it: every door must cost clearly more (>1.2x) than the
// level before it. (The first draft's Silver door was 90 -> 100, an 11% step
// that made the tier boundary just another Tuesday.)
// Sanity of the curve at ~300 coins/day (the 10-race cap, mid-field form):
// first Bronze level lands on day one, a full Bronze car in under a week,
// mid-rank in two or three weeks, full Diamond EVERYTHING (~38k) is a
// season project nobody finishes by accident. Winning pays 100 a race, so
// the sharp pay for their garages faster — as it should be.
const TIER_BASE_COST = [60, 115, 215, 400, 745];
const LEVEL_COST_RAMP = 0.12;

export function upgradeCost(currentLevel: number): number | null {
  if (currentLevel >= MAX_LEVEL) return null; // nothing left to buy
  const next = currentLevel + 1;
  const tier = tierIndexOf(next);
  const posInTier = (next - 1) % TIER_SIZE;
  const raw = TIER_BASE_COST[tier] * (1 + LEVEL_COST_RAMP * posInTier);
  return Math.round(raw / 5) * 5; // prices in fives read like prices
}

export function totalLevels(levels: CarLevels): number {
  return levels.power + levels.aero + levels.reliability + levels.pitCrew;
}

// Rank: one step per RANK_SIZE total levels. 0–9 is Rank 1 in the stock car;
// a fully Diamond garage (100 levels) is Rank 11.
export const RANK_SIZE = 10;
export const MAX_RANK = 1 + (4 * MAX_LEVEL) / RANK_SIZE;

export function rankFor(total: number): number {
  return Math.min(MAX_RANK, 1 + Math.floor(Math.max(0, total) / RANK_SIZE));
}

// The field you race: NPC cars built to your rank's ENTRY strength, ±3
// levels of jitter so the garages differ down the grid. The lag is the
// point — a fresh purchase puts you ahead of a field built to the rank
// floor, and the edge erodes as you buy toward promotion.
//
// NPC DRIVERS are never touched: their ratings are real people's derived
// numbers, and difficulty must live in machinery (the team-principal
// doctrine). Draw count is fixed (4 per call) so the rng stream stays
// aligned whatever the values.
export function npcLevelsFor(rank: number, rng: Rng): CarLevels {
  const entry = (Math.max(1, rank) - 1) * RANK_SIZE;
  const jitter = Math.floor(rng.range(-3, 4));
  const target = Math.max(0, Math.min(4 * MAX_LEVEL, entry + jitter));

  // Split the target across the four components, roughly evenly, with a
  // little personality per garage.
  const quarter = target / 4;
  const parts: number[] = [];
  let remaining = target;
  for (let i = 0; i < 3; i++) {
    const wobble = Math.floor(rng.range(-2, 3));
    const share = Math.max(
      0,
      Math.min(MAX_LEVEL, Math.min(remaining, Math.round(quarter) + wobble))
    );
    parts.push(share);
    remaining -= share;
  }
  parts.push(Math.max(0, Math.min(MAX_LEVEL, remaining)));

  return {
    power: parts[0],
    aero: parts[1],
    reliability: parts[2],
    pitCrew: parts[3],
  };
}
