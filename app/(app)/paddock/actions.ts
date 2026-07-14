"use server";

import {
  type PaddockRaceSettlement,
  settleQuickRace,
} from "@/lib/paddock/settle";
import type { Strategy } from "@/lib/race-sim";

// Start-and-settle for a quick race. The server mints the seed, runs the
// race, and banks the payout before the browser has drawn a single frame —
// see lib/paddock/settle.ts for the trust model. The browser then replays
// the identical race from the returned seed.
//
// Deliberately NO revalidatePath here: the settlement happens at lights out,
// but revalidating would update the page's coin balance and race history
// while the player is still watching qualifying — announcing the finishing
// position of a race they haven't seen yet. The client refreshes the page
// data when the chequered flag drops on the replay instead.
export async function runPaddockRace(input: {
  driverId: number;
  strategy: Strategy;
}): Promise<PaddockRaceSettlement> {
  return settleQuickRace(input.driverId, input.strategy);
}
