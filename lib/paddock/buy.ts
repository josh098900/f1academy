import "server-only";

import { getCurrentUser } from "@/lib/auth";
import {
  type CarLevels,
  MAX_LEVEL,
  MAX_STAFF_LEVEL,
  type StaffLevels,
  staffCost,
  upgradeCost,
} from "@/lib/paddock/garage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Buying a level — car part or staff hire, same till. The client asks, the
// server prices the upgrade from the CURRENT level (both cost tables live in
// code), and the write is a single compare-and-swap in the database — the
// row must still show the level we priced, and the coins must cover it, or
// nothing happens. Two rapid clicks buy one level, once.

export type Component = keyof CarLevels | keyof StaffLevels;

const COLUMN: Record<Component, string> = {
  power: "power",
  aero: "aero",
  reliability: "reliability",
  pitCrew: "pit_crew",
  raceEngineer: "race_engineer",
  simulator: "simulator",
  dataAnalyst: "data_analyst",
};

const STAFF_KEYS: ReadonlySet<Component> = new Set([
  "raceEngineer",
  "simulator",
  "dataAnalyst",
]);

export type UpgradePurchase =
  | {
      ok: true;
      coins: number;
      carLevels: CarLevels;
      staffLevels: StaffLevels;
    }
  | { ok: false; error: string };

export async function buyUpgrade(
  component: Component
): Promise<UpgradePurchase> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!(component in COLUMN)) {
    return { ok: false, error: "That part doesn't exist." };
  }
  const isStaff = STAFF_KEYS.has(component);

  const supabase = await createClient();
  const { data: team } = await supabase
    .from("paddock_teams")
    .select(
      "coins, car_power, car_aero, car_reliability, car_pit_crew, eng_race_engineer, eng_simulator, eng_data_analyst"
    )
    .maybeSingle();
  if (!team) {
    return { ok: false, error: "Race first — the garage runs on winnings." };
  }

  const fromLevel = {
    power: team.car_power,
    aero: team.car_aero,
    reliability: team.car_reliability,
    pitCrew: team.car_pit_crew,
    raceEngineer: team.eng_race_engineer,
    simulator: team.eng_simulator,
    dataAnalyst: team.eng_data_analyst,
  }[component];

  const maxLevel = isStaff ? MAX_STAFF_LEVEL : MAX_LEVEL;
  const cost = isStaff ? staffCost(fromLevel) : upgradeCost(fromLevel);
  if (fromLevel >= maxLevel || cost === null) {
    return {
      ok: false,
      error: isStaff
        ? "That department is fully staffed."
        : "That part is already full Diamond.",
    };
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
    staffLevels: {
      raceEngineer: row.eng_race_engineer,
      simulator: row.eng_simulator,
      dataAnalyst: row.eng_data_analyst,
    },
  };
}
