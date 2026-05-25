import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/types";
import { type DriverSession, scoreDriverWeekend } from "@/lib/scoring";

type DB = SupabaseClient<Database>;

// Total fantasy points (no boost) per driver across completed rounds before
// `beforeRound` — the Coach's form signal. Reads public tables.
export async function getDriverPoints(
  db: DB,
  seasonId: number,
  beforeRound: number
): Promise<Map<number, number>> {
  const points = new Map<number, number>();

  const { data: rounds } = await db
    .from("rounds")
    .select("id, round_number")
    .eq("season_id", seasonId)
    .lt("round_number", beforeRound)
    .eq("status", "complete")
    .throwOnError();

  for (const round of rounds) {
    const { data: sessions } = await db
      .from("sessions")
      .select("id, session_type")
      .eq("round_id", round.id)
      .throwOnError();
    const typeOf = new Map(sessions.map((s) => [s.id, s.session_type]));

    const { data: results } = await db
      .from("session_results")
      .select("session_id, driver_id, position, grid_position, status, fastest_lap")
      .in(
        "session_id",
        sessions.map((s) => s.id)
      )
      .throwOnError();

    const byDriver = new Map<number, DriverSession[]>();
    for (const r of results) {
      const type = typeOf.get(r.session_id);
      if (!type) continue;
      const arr = byDriver.get(r.driver_id) ?? [];
      arr.push({
        type: type as DriverSession["type"],
        position: r.position,
        gridPosition: r.grid_position,
        status: r.status as DriverSession["status"],
        fastestLap: r.fastest_lap,
      });
      byDriver.set(r.driver_id, arr);
    }
    for (const [driverId, sess] of byDriver) {
      points.set(
        driverId,
        (points.get(driverId) ?? 0) + scoreDriverWeekend({ sessions: sess }).base
      );
    }
  }

  return points;
}
