import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/types";
import { type DriverForm, type DriverStats, deriveDriverStats } from "@/lib/race-sim";

type DB = SupabaseClient<Database>;

export type RatedDriver = {
  driverId: number;
  name: string;
  shortName: string;
  stats: DriverStats;
};

// Read every completed session this season and rate each driver from what she
// actually did — see lib/race-sim/derive.ts for why ratings are derived rather
// than invented. Batched: three queries regardless of how many rounds have run.
export async function getDriverRatings(
  supabase: DB,
  seasonId: number
): Promise<RatedDriver[]> {
  const { data: rounds } = await supabase
    .from("rounds")
    .select("id")
    .eq("season_id", seasonId)
    .eq("status", "complete")
    .throwOnError();

  const { data: entries } = await supabase
    .from("season_entries")
    .select("driver_id, driver:drivers(id, full_name, short_name)")
    .eq("season_id", seasonId)
    .throwOnError();

  const drivers = entries
    .filter((e) => e.driver)
    .map((e) => ({
      driverId: e.driver!.id,
      name: e.driver!.full_name,
      shortName: e.driver!.short_name,
    }));
  const fieldSize = Math.max(2, drivers.length);

  const forms = new Map<number, DriverForm>(
    drivers.map((d) => [d.driverId, { qualifying: [], races: [], fieldSize }])
  );

  if (rounds.length > 0) {
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, session_type")
      .in("round_id", rounds.map((r) => r.id))
      .throwOnError();

    if (sessions.length > 0) {
      const typeOf = new Map(sessions.map((s) => [s.id, s.session_type]));
      const { data: results } = await supabase
        .from("session_results")
        .select("session_id, driver_id, position, grid_position, status")
        .in("session_id", sessions.map((s) => s.id))
        .throwOnError();

      for (const r of results) {
        const form = forms.get(r.driver_id);
        const type = typeOf.get(r.session_id);
        if (!form || !type) continue;
        if (type === "qualifying") {
          if (r.position !== null) form.qualifying.push(r.position);
        } else {
          form.races.push({
            gridPosition: r.grid_position,
            position: r.position,
            classified: r.status === "classified",
          });
        }
      }
    }
  }

  return drivers.map((d) => ({
    ...d,
    stats: deriveDriverStats(forms.get(d.driverId)!),
  }));
}
