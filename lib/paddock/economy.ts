import type { Classification } from "@/lib/race-sim";

// The Paddock's economy. Every number here is a balance dial, and they live
// in code — not the database — so retuning the game is a deploy, never a
// data migration. (The DB stores what a player HAS; this file decides what
// things are worth.)

// Coins by finishing position, P1 first. Winning pays 10x last place: the
// point of the spread is that a better plan should feel it in the wallet,
// because the wallet is what buys the garage.
export const RACE_PAYOUT = [100, 70, 50, 35, 25, 20, 15, 10] as const;

// A retirement still pays a little — you raced, the car came home in a box,
// and a zero would make quitting a bad race and replaying strictly better
// than finishing it.
export const RETIRED_PAYOUT = 5;

// Paid races per rolling 24 hours (Josh's call, 2026-07-16: "cap users to 10
// races per 24 hours for now"). The cap limits COINS, not racing — race
// eleven still runs, locally and honestly unpaid. A sliding window needs no
// cron and has no midnight; it just counts the log.
export const DAILY_RACE_CAP = 10;

export function racePayout(
  me: Pick<Classification, "position" | "retired">
): number {
  if (me.retired !== null) return RETIRED_PAYOUT;
  return RACE_PAYOUT[me.position - 1] ?? RETIRED_PAYOUT;
}
