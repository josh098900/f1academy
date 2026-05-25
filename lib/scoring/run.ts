// Round-scoring orchestration over the database — shared by the admin action
// and the scheduled cron. Caller supplies a service-role client (this writes to
// RLS-protected tables) after its own authorization check.

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/types";

import type { DriverSession, SessionType } from "./index";
import { scoreUserRound } from "./round";

export type DB = SupabaseClient<Database>;
type Json = Database["public"]["Tables"]["user_scores"]["Insert"]["breakdown"];

export type ScoreRoundResult =
  | { ok: true; scored: number }
  | { ok: false; error: string };

function isPodium(position: number | null, status: string): boolean {
  return status === "classified" && position !== null && position <= 3;
}

async function sessionsByDriver(
  db: DB,
  sessionIds: number[],
  typeOf: Map<number, string>
): Promise<Map<number, DriverSession[]>> {
  const map = new Map<number, DriverSession[]>();
  if (sessionIds.length === 0) return map;
  const { data } = await db
    .from("session_results")
    .select("session_id, driver_id, position, grid_position, status, fastest_lap")
    .in("session_id", sessionIds)
    .throwOnError();
  for (const r of data) {
    const type = typeOf.get(r.session_id) as SessionType | undefined;
    if (!type) continue;
    const arr = map.get(r.driver_id) ?? [];
    arr.push({
      type,
      position: r.position,
      gridPosition: r.grid_position,
      status: r.status as DriverSession["status"],
      fastestLap: r.fastest_lap,
    });
    map.set(r.driver_id, arr);
  }
  return map;
}

async function incomingPodium(
  db: DB,
  seasonId: number,
  roundNumber: number
): Promise<Map<number, boolean>> {
  const map = new Map<number, boolean>();
  const { data: prev } = await db
    .from("rounds")
    .select("id")
    .eq("season_id", seasonId)
    .eq("round_number", roundNumber - 1)
    .maybeSingle()
    .throwOnError();
  if (!prev) return map;

  const { data: sessions } = await db
    .from("sessions")
    .select("id, session_type")
    .eq("round_id", prev.id)
    .throwOnError();
  const lastRace = ["race3", "race2", "race1"]
    .map((t) => sessions.find((s) => s.session_type === t))
    .find(Boolean);
  if (!lastRace) return map;

  const { data: results } = await db
    .from("session_results")
    .select("driver_id, position, status")
    .eq("session_id", lastRace.id)
    .throwOnError();
  for (const r of results) map.set(r.driver_id, isPodium(r.position, r.status));
  return map;
}

// Recompute cumulative_points across all of each user's rounds, in order, so
// re-scoring an earlier round keeps later totals correct.
async function recomputeCumulative(
  db: DB,
  seasonId: number,
  userIds: string[]
): Promise<void> {
  if (userIds.length === 0) return;
  const { data: rounds } = await db
    .from("rounds")
    .select("id, round_number")
    .eq("season_id", seasonId)
    .throwOnError();
  const numberOf = new Map(rounds.map((r) => [r.id, r.round_number]));

  const { data: scores } = await db
    .from("user_scores")
    .select("id, user_id, round_id, round_points, cumulative_points")
    .in("user_id", userIds)
    .in("round_id", rounds.map((r) => r.id))
    .throwOnError();

  const byUser = new Map<string, typeof scores>();
  for (const s of scores) {
    const list = byUser.get(s.user_id) ?? [];
    list.push(s);
    byUser.set(s.user_id, list);
  }
  for (const list of byUser.values()) {
    list.sort(
      (a, b) => (numberOf.get(a.round_id) ?? 0) - (numberOf.get(b.round_id) ?? 0)
    );
    let running = 0;
    for (const s of list) {
      running += s.round_points;
      if (s.cumulative_points !== running) {
        await db
          .from("user_scores")
          .update({ cumulative_points: running })
          .eq("id", s.id);
      }
    }
  }
}

export async function runScoreRound(
  db: DB,
  roundId: number
): Promise<ScoreRoundResult> {
  const { data: round } = await db
    .from("rounds")
    .select("id, season_id, round_number")
    .eq("id", roundId)
    .maybeSingle()
    .throwOnError();
  if (!round) return { ok: false, error: "Round not found." };

  const { data: sessions } = await db
    .from("sessions")
    .select("id, session_type")
    .eq("round_id", roundId)
    .throwOnError();
  const sessionIds = sessions.map((s) => s.id);
  const typeOf = new Map(sessions.map((s) => [s.id, s.session_type]));

  const [byDriver, incoming, { data: teams }] = await Promise.all([
    sessionsByDriver(db, sessionIds, typeOf),
    incomingPodium(db, round.season_id, round.round_number),
    db
      .from("user_teams")
      .select("user_id, driver_ids, boost_driver_id, transfers_used, wildcard_used")
      .eq("round_id", roundId)
      .throwOnError(),
  ]);

  const markComplete = async () => {
    await db.from("rounds").update({ status: "complete" }).eq("id", roundId);
    if (sessionIds.length) {
      await db.from("sessions").update({ status: "complete" }).in("id", sessionIds);
    }
  };

  if (teams.length === 0) {
    await markComplete();
    return { ok: true, scored: 0 };
  }

  const rows = teams.map((t) => {
    const s = scoreUserRound({
      driverIds: t.driver_ids,
      boostDriverId: t.boost_driver_id,
      transfersUsed: t.transfers_used,
      wildcard: t.wildcard_used,
      sessionsByDriver: byDriver,
      incomingPodiumByDriver: incoming,
    });
    return {
      user_id: t.user_id,
      round_id: roundId,
      round_points: s.roundPoints,
      boost_points_added: s.boostPointsAdded,
      transfer_penalty: s.transferPenalty,
      cumulative_points: s.roundPoints, // placeholder — recomputed below
      breakdown: s.breakdown as Json,
    };
  });

  const { error } = await db
    .from("user_scores")
    .upsert(rows, { onConflict: "user_id,round_id" });
  if (error) return { ok: false, error: error.message };

  await recomputeCumulative(
    db,
    round.season_id,
    teams.map((t) => t.user_id)
  );
  await markComplete();
  return { ok: true, scored: rows.length };
}
