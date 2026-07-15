"use server";

import { revalidatePath } from "next/cache";

import {
  type Component,
  type UpgradePurchase,
  buyUpgrade,
} from "@/lib/paddock/buy";
import {
  type PaddockRaceSettlement,
  settleQuickRace,
} from "@/lib/paddock/settle";
import { type DriverSignature, signDriver } from "@/lib/paddock/sign";
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

// Buying a car upgrade. Unlike a race there is nothing to spoil, so this one
// revalidates immediately — the balance and levels should change everywhere
// the moment the till rings.
export async function buyPaddockUpgrade(
  component: Component
): Promise<UpgradePurchase> {
  const result = await buyUpgrade(component);
  if (result.ok) {
    revalidatePath("/paddock");
    revalidatePath("/paddock/garage");
  }
  return result;
}

// Signing a driver — a contract, not a race, so nothing to spoil: refresh
// everywhere the moment the ink dries.
export async function signPaddockDriver(
  driverId: number
): Promise<DriverSignature> {
  const result = await signDriver(driverId);
  if (result.ok) {
    revalidatePath("/paddock");
    revalidatePath("/paddock/drivers");
  }
  return result;
}
