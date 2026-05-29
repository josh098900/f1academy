import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/types";
import { type DriverSession, scoreDriverWeekend } from "@/lib/scoring";

type DB = SupabaseClient<Database>;

// Total fantasy points (no boost) per driver across completed rounds before
// `beforeRound` — the Coach's form signal. Reads public tables.
//
// Three queries regardless of round count (was 2R+1 in a loop). Sessions and
// session_results are pulled in batch and grouped in memory, which both reads
// cleaner and shaves real time in lhr1 since each saved round-trip is ~30ms.
export async function getDriverPoints(
  db: DB,
  seasonId: number,
  beforeRound: number
): Promise<Map<number, number>> {
  const points = new Map<number, number>();

  // 1. Completed prior rounds for this season.
  const { data: rounds } = await db
    .from("rounds")
    .select("id")
    .eq("season_id", seasonId)
    .lt("round_number", beforeRound)
    .eq("status", "complete")
    .throwOnError();
  if (rounds.length === 0) return points;

  // 2. All sessions across those rounds, in one query.
  const roundIds = rounds.map((r) => r.id);
  const { data: sessions } = await db
    .from("sessions")
    .select("id, round_id, session_type")
    .in("round_id", roundIds)
    .throwOnError();
  if (sessions.length === 0) return points;

  const sessionMeta = new Map(
    sessions.map((s) => [s.id, { roundId: s.round_id, type: s.session_type }])
  );

  // 3. All session_results across those sessions, in one query.
  const { data: results } = await db
    .from("session_results")
    .select("session_id, driver_id, position, grid_position, status, fastest_lap")
    .in("session_id", sessions.map((s) => s.id))
    .throwOnError();

  // Group by (round, driver) so each driver-weekend is scored once with the
  // right session set rather than mixing results across rounds.
  const byRoundDriver = new Map<string, DriverSession[]>();
  for (const r of results) {
    const meta = sessionMeta.get(r.session_id);
    if (!meta) continue;
    const key = `${meta.roundId}:${r.driver_id}`;
    const arr = byRoundDriver.get(key) ?? [];
    arr.push({
      type: meta.type as DriverSession["type"],
      position: r.position,
      gridPosition: r.grid_position,
      status: r.status as DriverSession["status"],
      fastestLap: r.fastest_lap,
    });
    byRoundDriver.set(key, arr);
  }

  for (const [key, sess] of byRoundDriver) {
    const driverId = Number(key.split(":")[1]);
    points.set(
      driverId,
      (points.get(driverId) ?? 0) + scoreDriverWeekend({ sessions: sess }).base
    );
  }

  return points;
}
