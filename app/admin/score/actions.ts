"use server";

import { revalidatePath } from "next/cache";

import type { Database } from "@/db/types";
import { getAdmin } from "@/lib/admin";
import type { DriverSession, SessionType } from "@/lib/scoring";
import { scoreUserRound } from "@/lib/scoring/round";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminDB = ReturnType<typeof createAdminClient>;
type Json = Database["public"]["Tables"]["user_scores"]["Insert"]["breakdown"];

export type ScoreRoundResult =
  | { ok: true; scored: number }
  | { ok: false; error: string };

function isPodium(position: number | null, status: string): boolean {
  return status === "classified" && position !== null && position <= 3;
}

// Map a round's session_results into per-driver weekend sessions.
async function sessionsByDriver(
  db: AdminDB,
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

// Podium-streak bridge: did each driver podium in the previous round's last race?
async function incomingPodium(
  db: AdminDB,
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
  for (const r of results) {
    map.set(r.driver_id, isPodium(r.position, r.status));
  }
  return map;
}

async function priorCumulative(
  db: AdminDB,
  seasonId: number,
  roundNumber: number,
  userIds: string[]
): Promise<Map<string, number>> {
  const sum = new Map<string, number>();
  if (userIds.length === 0) return sum;
  const { data: priorRounds } = await db
    .from("rounds")
    .select("id")
    .eq("season_id", seasonId)
    .lt("round_number", roundNumber)
    .throwOnError();
  if (priorRounds.length === 0) return sum;

  const { data } = await db
    .from("user_scores")
    .select("user_id, round_points")
    .in(
      "round_id",
      priorRounds.map((r) => r.id)
    )
    .in("user_id", userIds)
    .throwOnError();
  for (const s of data) {
    sum.set(s.user_id, (sum.get(s.user_id) ?? 0) + s.round_points);
  }
  return sum;
}

// Score every saved team for a round and write user_scores. Idempotent —
// re-running recomputes from the same inputs. Marks the round complete.
export async function scoreRound(roundId: number): Promise<ScoreRoundResult> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, error: "Admin only." };
  const db = createAdminClient();

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
      await db
        .from("sessions")
        .update({ status: "complete" })
        .in("id", sessionIds);
    }
  };

  if (teams.length === 0) {
    await markComplete();
    revalidatePath("/admin/score");
    return { ok: true, scored: 0 };
  }

  const prior = await priorCumulative(
    db,
    round.season_id,
    round.round_number,
    teams.map((t) => t.user_id)
  );

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
      cumulative_points: (prior.get(t.user_id) ?? 0) + s.roundPoints,
      breakdown: s.breakdown as Json,
    };
  });

  const { error } = await db
    .from("user_scores")
    .upsert(rows, { onConflict: "user_id,round_id" });
  if (error) return { ok: false, error: error.message };

  await markComplete();
  revalidatePath("/admin/score");
  return { ok: true, scored: rows.length };
}
