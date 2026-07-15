import "server-only";

import { randomInt } from "node:crypto";

import type { Json } from "@/db/types";
import { getCurrentUser } from "@/lib/auth";
import { DAILY_RACE_CAP, racePayout } from "@/lib/paddock/economy";
import {
  PADDOCK_LAPS,
  PADDOCK_TRACK_ID,
  runQuickRace,
} from "@/lib/paddock/field";
import {
  type CarLevels,
  type StaffLevels,
  ZERO_LEVELS,
  ZERO_STAFF,
} from "@/lib/paddock/garage";
import { usableDriverIds } from "@/lib/paddock/roster";
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
      // The garage and staff the server raced with — the client replays
      // with EXACTLY these, so a purchase in another tab can't desync the
      // broadcast from the banked result.
      carLevels: CarLevels;
      staffLevels: StaffLevels;
      racesToday: number; // including this one
    }
  | { ok: false; error: string; capped?: boolean };

// Paid races in the rolling 24h window — the cap's counter. Shared by the
// settlement (which enforces it) and the page (which displays it), and RLS
// scopes the count to the calling user.
export async function racesInLast24h(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("paddock_races")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  return count ?? 0;
}

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

  // The cap, checked server-side, where it can't be talked out of.
  const recentRaces = await racesInLast24h(supabase);
  if (recentRaces >= DAILY_RACE_CAP) {
    return {
      ok: false,
      capped: true,
      error: `That's your ${DAILY_RACE_CAP} paid races for today — the pit lane reopens as they age past 24 hours.`,
    };
  }

  const season = await getCurrentSeason(supabase);
  if (!season) return { ok: false, error: "No season is running." };

  // The garage and staff this player actually owns — never trusted from
  // the client.
  const { data: team } = await supabase
    .from("paddock_teams")
    .select(
      "car_power, car_aero, car_reliability, car_pit_crew, eng_race_engineer, eng_simulator, eng_data_analyst"
    )
    .maybeSingle();
  const carLevels: CarLevels = team
    ? {
        power: team.car_power,
        aero: team.car_aero,
        reliability: team.car_reliability,
        pitCrew: team.car_pit_crew,
      }
    : ZERO_LEVELS;
  const staffLevels: StaffLevels = team
    ? {
        raceEngineer: team.eng_race_engineer,
        simulator: team.eng_simulator,
        dataAnalyst: team.eng_data_analyst,
      }
    : ZERO_STAFF;

  const drivers = await getDriverRatings(supabase, season.id);

  // The roster gate: free seats and signatures only. The client's picker
  // enforces this too, but the server is the one that pays out.
  const { data: contracts } = await supabase
    .from("paddock_contracts")
    .select("driver_id");
  const usable = usableDriverIds(
    drivers,
    new Set((contracts ?? []).map((c) => c.driver_id))
  );
  if (!usable.has(driverId)) {
    return {
      ok: false,
      error: "She's not on your books — contracts are signed in the roster.",
    };
  }

  // The seed is the server's, never the client's — otherwise a player could
  // simulate locally until they find a race they win, and submit only that.
  const seed = randomInt(0, 2 ** 32);

  const run = runQuickRace(drivers, driverId, strategy, seed, {
    captureFrames: false, // nobody watches this copy; the browser replays it
    carLevels,
    staffLevels,
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

  return {
    ok: true,
    seed,
    coinsEarned: coins,
    balance: balance ?? coins,
    carLevels,
    staffLevels,
    racesToday: recentRaces + 1,
  };
}
