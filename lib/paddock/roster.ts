import { rankDrivers } from "./field";
import type { RatedDriver } from "./ratings";

// The roster gate (Josh's design): the four lowest-rated drivers are free —
// everyone starts in the same seats — and the rest unlock in bands. Rank
// opens a band (the garage you've built is the door), coins sign the
// contract, and a signature is permanent.
//
// The free four are the bottom four BY CURRENT DERIVED RATING, so reality
// can reshuffle them after a real race weekend: a rookie who outqualifies
// someone climbs out of the free seats. That's the game breathing with the
// real season — a contract, once signed, never lapses either way.
//
// This module is pure and runs on both sides: the roster screen renders it,
// and settlement enforces it. One source of truth, like the race itself.

export const FREE_SEATS = 4;

export const CONTRACT_BANDS = [
  { id: "challenger", label: "Challenger", price: 400, rankNeeded: 2 },
  { id: "frontrunner", label: "Front runner", price: 900, rankNeeded: 4 },
  { id: "elite", label: "Elite", price: 1800, rankNeeded: 6 },
] as const;

export type ContractBand = (typeof CONTRACT_BANDS)[number];

export type RosterEntry = {
  driver: RatedDriver;
  band: ContractBand | null; // null = a free seat
  // free    — one of the bottom four, drive her now
  // signed  — under contract, drive her now
  // open    — rank suffices; costs band.price to sign
  // locked  — the garage isn't there yet
  status: "free" | "signed" | "open" | "locked";
};

// Fastest first, same total order as the grid — the roster IS the ranking.
export function rosterFor(
  drivers: RatedDriver[],
  signedIds: ReadonlySet<number>,
  rank: number
): RosterEntry[] {
  const ranked = rankDrivers(drivers);
  const paid = Math.max(0, ranked.length - FREE_SEATS);

  // Split the paid seats into three bands, slowest band first and the elite
  // band the smallest — the top of the grid should be the narrow gate.
  const challengers = Math.ceil(paid / 3);
  const frontrunners = Math.ceil((paid - challengers) / 2);

  return ranked.map((driver, i) => {
    // i counts from the fastest; free seats are the LAST four.
    const paidIndex = i; // 0..paid-1 are contract drivers
    let band: ContractBand | null = null;
    if (paidIndex < paid) {
      const fromSlowest = paid - 1 - paidIndex;
      band =
        fromSlowest < challengers
          ? CONTRACT_BANDS[0]
          : fromSlowest < challengers + frontrunners
            ? CONTRACT_BANDS[1]
            : CONTRACT_BANDS[2];
    }

    const status: RosterEntry["status"] =
      band === null
        ? "free"
        : signedIds.has(driver.driverId)
          ? "signed"
          : rank >= band.rankNeeded
            ? "open"
            : "locked";

    return { driver, band, status };
  });
}

// Who this player may put in the car: the free seats plus every signature.
export function usableDriverIds(
  drivers: RatedDriver[],
  signedIds: ReadonlySet<number>
): Set<number> {
  const usable = new Set<number>(signedIds);
  const ranked = rankDrivers(drivers);
  for (const d of ranked.slice(Math.max(0, ranked.length - FREE_SEATS))) {
    usable.add(d.driverId);
  }
  return usable;
}
