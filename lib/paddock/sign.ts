import "server-only";

import { getCurrentUser } from "@/lib/auth";
import {
  ZERO_LEVELS,
  ZERO_STAFF,
  rankFor,
  staffTotal,
  totalLevels,
} from "@/lib/paddock/garage";
import { getDriverRatings } from "@/lib/paddock/ratings";
import { rosterFor } from "@/lib/paddock/roster";
import { getCurrentSeason } from "@/lib/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Signing a driver, server-side. The client asks; the server rebuilds the
// roster from its own data — her band, its price, the player's rank — and
// the write is one atomic transaction (coins off, contract in) through a
// service-role-only function. The primary key turns a double-click into a
// rolled-back no-op.

export type DriverSignature =
  | { ok: true; coins: number; driverId: number }
  | { ok: false; error: string };

export async function signDriver(driverId: number): Promise<DriverSignature> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  const supabase = await createClient();
  const season = await getCurrentSeason(supabase);
  if (!season) return { ok: false, error: "No season is running." };

  const [drivers, teamRes, contractsRes] = await Promise.all([
    getDriverRatings(supabase, season.id),
    supabase
      .from("paddock_teams")
      .select(
        "coins, car_power, car_aero, car_reliability, car_pit_crew, eng_race_engineer, eng_simulator, eng_data_analyst"
      )
      .maybeSingle(),
    supabase.from("paddock_contracts").select("driver_id"),
  ]);
  const team = teamRes.data;
  const coins = team?.coins ?? 0;
  const rank = rankFor(
    totalLevels(
      team
        ? {
            power: team.car_power,
            aero: team.car_aero,
            reliability: team.car_reliability,
            pitCrew: team.car_pit_crew,
          }
        : ZERO_LEVELS
    ) +
      staffTotal(
        team
          ? {
              raceEngineer: team.eng_race_engineer,
              simulator: team.eng_simulator,
              dataAnalyst: team.eng_data_analyst,
            }
          : ZERO_STAFF
      )
  );
  const signedIds = new Set(
    (contractsRes.data ?? []).map((c) => c.driver_id)
  );

  const entry = rosterFor(drivers, signedIds, rank).find(
    (e) => e.driver.driverId === driverId
  );
  if (!entry) return { ok: false, error: "She isn't on this season's grid." };
  if (entry.status === "free") {
    return { ok: false, error: `${entry.driver.name} is a free seat — just pick her.` };
  }
  if (entry.status === "signed") {
    return { ok: false, error: `${entry.driver.name} is already on your books.` };
  }
  if (entry.status === "locked") {
    return {
      ok: false,
      error: `${entry.band!.label} contracts open at rank ${entry.band!.rankNeeded}.`,
    };
  }
  if (coins < entry.band!.price) {
    return {
      ok: false,
      error: `Signing ${entry.driver.name} costs ${entry.band!.price} — you have ${coins}.`,
    };
  }
  if (!team) {
    return { ok: false, error: "Race first — contracts run on winnings." };
  }

  const admin = createAdminClient();
  const { data: balance, error } = await admin.rpc("sign_paddock_driver", {
    p_user_id: user.id,
    p_driver_id: driverId,
    p_cost: entry.band!.price,
  });
  if (error || balance === null) {
    return {
      ok: false,
      error: error?.message.includes("INSUFFICIENT_COINS")
        ? "The balance moved — you can't cover that contract right now."
        : "The paperwork slipped — try again.",
    };
  }

  return { ok: true, coins: balance, driverId };
}
