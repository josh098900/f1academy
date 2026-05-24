// Pure team-selection rules — see docs/files/SCORING_SYSTEM.md and PRODUCT_SPEC.md.
// No dependencies, so the UI, the server action, and tests all share one source
// of truth.

export const BUDGET_CAP = 40;
export const SQUAD_SIZE = 4;
export const FREE_TRANSFERS = 1;
export const TRANSFER_PENALTY = 10;

export type TeamValidation = {
  valid: boolean;
  spent: number;
  errors: string[];
};

// Validate a selection against budget, squad size, and boost rules.
// `priceOf` returns undefined for a driver not available this round.
export function validateTeam(
  driverIds: number[],
  boostDriverId: number | null,
  priceOf: (id: number) => number | undefined,
  cap: number = BUDGET_CAP,
  squad: number = SQUAD_SIZE
): TeamValidation {
  const errors: string[] = [];

  let spent = 0;
  let allPriced = true;
  for (const id of driverIds) {
    const price = priceOf(id);
    if (price === undefined) allPriced = false;
    else spent += price;
  }
  spent = Math.round(spent * 10) / 10; // prices are 1dp; avoid float drift

  if (driverIds.length !== squad) {
    errors.push(`Pick exactly ${squad} drivers.`);
  }
  if (new Set(driverIds).size !== driverIds.length) {
    errors.push("You picked the same driver twice.");
  }
  if (!allPriced) {
    errors.push("A selected driver isn't available this round.");
  }
  if (spent > cap) {
    errors.push(`Over budget by £${(spent - cap).toFixed(1)}M.`);
  }
  if (boostDriverId === null) {
    errors.push("Choose a boost.");
  } else if (!driverIds.includes(boostDriverId)) {
    errors.push("Your boost must be one of your drivers.");
  }

  return { valid: errors.length === 0, spent, errors };
}

// Number of driver changes from a baseline squad (e.g. last round's team).
// No baseline (first round, or a wildcard reset) → 0 transfers.
export function countTransfers(
  previous: number[] | null | undefined,
  current: number[]
): number {
  if (!previous || previous.length === 0) return 0;
  const prev = new Set(previous);
  return current.reduce((n, id) => (prev.has(id) ? n : n + 1), 0);
}

// Points penalty for transfers: one free per round, -10 each beyond.
// A wildcard waives the penalty entirely.
export function transferPenalty(transfers: number, wildcard: boolean): number {
  if (wildcard) return 0;
  return Math.max(0, transfers - FREE_TRANSFERS) * TRANSFER_PENALTY;
}

// The wildcard is once per season and STICKY once consumed on a round:
//  - if already used on this round, it stays used (can't be undone by resaving);
//  - it can't be (re)activated if it was spent in another round.
// Server-side source of truth — the client must not be able to restore the chip.
export function resolveWildcard(opts: {
  requested: boolean;
  existingThisRound: boolean;
  usedInPriorRound: boolean;
}): { wildcard: boolean; error?: string } {
  if (opts.existingThisRound) return { wildcard: true };
  if (opts.requested) {
    if (opts.usedInPriorRound) {
      return {
        wildcard: false,
        error: "You've already used your wildcard this season.",
      };
    }
    return { wildcard: true };
  }
  return { wildcard: false };
}
