import type { CompoundId, PaceMode } from "./types";

// The tyre model is the strategic heart of the race, and the one piece of maths
// that is deliberately NOT linear.
//
// Below the cliff, a tyre loses time slowly and predictably. Past it, it falls
// off a shelf — several seconds a lap, immediately. That single non-linearity is
// what turns "when do I box?" from arithmetic into tension: a soft tyre is worth
// half a second a lap right up until the lap it costs you the race.

export type Compound = {
  id: CompoundId;
  label: string;
  // Seconds relative to the medium on a fresh tyre. Negative = faster.
  freshDelta: number;
  // Wear accrued per lap in neutral pace, before the track's wear factor.
  // Reciprocal-ish: 0.13 ⇒ ~7.7 laps to a fully worn tyre.
  wearPerLap: number;
  // Time lost (seconds) at full wear from the gentle, pre-cliff slope.
  linearDeg: number;
  // Wear fraction at which the tyre falls off the shelf.
  cliff: number;
};

// The degradation numbers here are the GAME'S ECONOMY, not decoration.
//
// A pit stop costs ~16s. For stopping to be a real decision rather than a
// mistake, a worn tyre must be losing enough per lap that fresh rubber pays that
// back over the laps that remain: with ~8 laps left, that means a used tyre has
// to be ~2s+ a lap slower than a new one. An earlier version degraded so gently
// (a worn tyre lost only ~0.2s/lap over a fresh one) that no stop could ever pay
// for itself — the sim correctly refused to pit, the race became a procession,
// and the entire tyre/strategy layer was dead on arrival. Degradation and pit
// loss have to be balanced against each other or there is no game here.
export const COMPOUNDS: Record<CompoundId, Compound> = {
  soft: {
    id: "soft",
    label: "Soft",
    freshDelta: -0.9, // properly quick when new
    wearPerLap: 0.13, // ~8 laps
    linearDeg: 5.0,
    cliff: 0.7, // goes off early — the gamble
  },
  medium: {
    id: "medium",
    label: "Medium",
    freshDelta: 0,
    wearPerLap: 0.085, // ~12 laps
    linearDeg: 4.0,
    cliff: 0.8,
  },
  hard: {
    id: "hard",
    label: "Hard",
    freshDelta: 0.8,
    wearPerLap: 0.058, // ~17 laps — can go the distance
    linearDeg: 3.0,
    cliff: 0.88,
  },
};

// How hard the driver is pushing changes both pace and how fast the tyre dies.
// This is the trade the strategy rules are really playing with.
export const MODES: Record<PaceMode, { lapDelta: number; wearMult: number }> = {
  push: { lapDelta: -0.4, wearMult: 1.35 },
  neutral: { lapDelta: 0, wearMult: 1.0 },
  conserve: { lapDelta: 0.5, wearMult: 0.75 },
};

// Seconds this tyre is adding to the lap right now, given its wear.
// Gentle slope up to the cliff, then a shelf.
const CLIFF_SLOPE = 20; // seconds per unit of wear beyond the cliff — brutal

export function tyreLapDelta(compound: Compound, wear: number): number {
  const w = Math.max(0, Math.min(1, wear));
  const linear = w * compound.linearDeg;
  const overCliff = Math.max(0, w - compound.cliff);
  return compound.freshDelta + linear + overCliff * CLIFF_SLOPE;
}

// Wear added over a fraction of a lap.
export function wearIncrement(
  compound: Compound,
  mode: PaceMode,
  trackWearFactor: number,
  lapFraction: number
): number {
  return (
    compound.wearPerLap * MODES[mode].wearMult * trackWearFactor * lapFraction
  );
}

// Has this tyre gone over the shelf?
export function isOverCliff(compound: Compound, wear: number): boolean {
  return wear > compound.cliff;
}
