"use server";

import { revalidatePath } from "next/cache";

import {
  type PaddockRaceSettlement,
  settleQuickRace,
} from "@/lib/paddock/settle";
import type { Strategy } from "@/lib/race-sim";

// Start-and-settle for a quick race. The server mints the seed, runs the
// race, and banks the payout before the browser has drawn a single frame —
// see lib/paddock/settle.ts for the trust model. The browser then replays
// the identical race from the returned seed.
export async function runPaddockRace(input: {
  driverId: number;
  strategy: Strategy;
}): Promise<PaddockRaceSettlement> {
  const result = await settleQuickRace(input.driverId, input.strategy);
  if (result.ok) revalidatePath("/paddock");
  return result;
}
