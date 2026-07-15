import "server-only";

import { getCurrentUser } from "@/lib/auth";
import {
  type CarLevels,
  MAX_LEVEL,
  upgradeCost,
} from "@/lib/paddock/garage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Buying a level, server-side. Same trust model as race settlement: the
// client asks, the server prices the upgrade from the CURRENT level (the
// cost table lives in code), and the write is a single compare-and-swap in
// the database — the row must still show the level we priced, and the coins
// must cover it, or nothing happens. Two rapid clicks buy one level, once.

export type Component = keyof CarLevels;

const COLUMN: Record<Component, "power" | "aero" | "reliability" | "pit_crew"> =
  {
    power: "power",
    aero: "aero",
    reliability: "reliability",
    pitCrew: "pit_crew",
  };

export type UpgradePurchase =
  | { ok: true; coins: number; carLevels: CarLevels }
  | { ok: false; error: string };

export async function buyUpgrade(
  component: Component
): Promise<UpgradePurchase> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!(component in COLUMN)) {
    return { ok: false, error: "That part doesn't exist." };
  }

  const supabase = await createClient();
  const { data: team } = await supabase
    .from("paddock_teams")
    .select("coins, car_power, car_aero, car_reliability, car_pit_crew")
    .maybeSingle();
  if (!team) {
    return { ok: false, error: "Race first — the garage runs on winnings." };
  }

  const fromLevel = {
    power: team.car_power,
    aero: team.car_aero,
    reliability: team.car_reliability,
    pitCrew: team.car_pit_crew,
  }[component];

  if (fromLevel >= MAX_LEVEL) {
    return { ok: false, error: "That part is already full Diamond." };
  }
  const cost = upgradeCost(fromLevel);
  if (cost === null) {
    return { ok: false, error: "That part is already full Diamond." };
  }
  if (team.coins < cost) {
    return {
      ok: false,
      error: `That costs ${cost} coins — you have ${team.coins}.`,
    };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("buy_paddock_upgrade", {
    p_user_id: user.id,
    p_component: COLUMN[component],
    p_from_level: fromLevel,
    p_cost: cost,
  });
  const row = data?.[0];
  if (error || !row) {
    // Zero rows = the row moved between our read and the swap (another tab,
    // a race payout) — nothing was charged; the fresh state sorts it out.
    return { ok: false, error: "The garage moved under you — try again." };
  }

  return {
    ok: true,
    coins: row.coins,
    carLevels: {
      power: row.car_power,
      aero: row.car_aero,
      reliability: row.car_reliability,
      pitCrew: row.car_pit_crew,
    },
  };
}
