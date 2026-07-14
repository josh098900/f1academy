import "server-only";

import { randomInt } from "node:crypto";

import type { Json } from "@/db/types";
import { getCurrentUser } from "@/lib/auth";
import { racePayout } from "@/lib/paddock/economy";
import {
  PADDOCK_LAPS,
  PADDOCK_TRACK_ID,
  runQuickRace,
} from "@/lib/paddock/field";
import { getDriverRatings } from "@/lib/paddock/ratings";
import { COMPOUNDS, type Strategy } from "@/lib/race-sim";
import { getCurrentSeason } from "@/lib/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Settling a quick race, server-side. The trust model in one paragraph:
// the CLIENT never reports a result. It asks to race; the server mints the
// seed (so a client can't shop for a winning one), runs the same pure
// simulation the browser will replay, computes the payout from its own
// classification, and banks it atomically via a service-role-only DB
// function. What returns to the browser is the seed — the race itself, in
// four bytes — plus the money. Forging a payout means forging mulberry32.
//
// If the season's results change between this settlement and the browser's
// replay (a Monday sync landing mid-race), the replay could differ from the
// banked race. Rare, cosmetic, and the banked result is the truth.

export type PaddockRaceSettlement =
  | {
      ok: true;
      seed: number;
      coinsEarned: number;
      balance: number;
    }
  | { ok: false; error: string };

// The pit wall's slider ranges, mirrored. The UI can only produce these, so
// anything outside them didn't come from the UI.
function validStrategy(s: Strategy): boolean {
  return (
    s.startCompound in COMPOUNDS &&
    s.pitCompound in COMPOUNDS &&
    typeof s.boxUnderSafetyCar === "boolean" &&
    s.pitAtWear >= 0.4 &&
    s.pitAtWear <= 0.95 &&
    s.attackWithin >= 0.2 &&
    s.attackWithin <= 2.5 &&
    s.conserveWhenLeadingBy >= 1.0 &&
    s.conserveWhenLeadingBy <= 8.0
  );
}

export async function settleQuickRace(
  driverId: number,
  strategy: Strategy
): Promise<PaddockRaceSettlement> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!validStrategy(strategy)) {
    return { ok: false, error: "That plan isn't one the pit wall can issue." };
  }

  const supabase = await createClient();
  const season = await getCurrentSeason(supabase);
  if (!season) return { ok: false, error: "No season is running." };
  const drivers = await getDriverRatings(supabase, season.id);

  // The seed is the server's, never the client's — otherwise a player could
  // simulate locally until they find a race they win, and submit only that.
  const seed = randomInt(0, 2 ** 32);

  const run = runQuickRace(drivers, driverId, strategy, seed, {
    captureFrames: false, // nobody watches this copy; the browser replays it
  });
  if (!run) return { ok: false, error: "That driver isn't on the grid." };

  const me = run.result.classification.find((c) => c.id === run.playerId)!;
  const coins = racePayout(me);

  const admin = createAdminClient();
  const { data: balance, error } = await admin.rpc("settle_paddock_race", {
    p_user_id: user.id,
    p_seed: seed,
    p_track_id: PADDOCK_TRACK_ID,
    p_laps: PADDOCK_LAPS,
    p_driver_id: driverId,
    p_strategy: strategy as unknown as Json,
    p_finish_position: me.position,
    p_grid_position: run.gridPosition,
    p_coins: coins,
    ...(me.retired !== null ? { p_retired: me.retired } : {}),
  });
  if (error) {
    return { ok: false, error: "The result couldn't be banked. Try again." };
  }

  return { ok: true, seed, coinsEarned: coins, balance: balance ?? coins };
}
