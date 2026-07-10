import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/types";
import {
  getActiveRound,
  getRoundLineup,
  getTransferContext,
  getUserTeam,
} from "@/lib/queries";
import {
  countTransfers,
  resolveWildcard,
  validateTeam,
} from "@/lib/team-rules";

type DB = SupabaseClient<Database>;

export type SaveTeamResult = { ok: true } | { ok: false; error: string };

export type SaveTeamInput = {
  driverIds: number[];
  boostDriverId: number;
  wildcard?: boolean;
};

// Core team-save logic, shared by the saveTeam Server Action (cookie auth) and
// the Bearer-auth load-test route (app/api/loadtest/save-team). The caller owns
// authentication and any cache revalidation; this re-validates everything
// server-side and lets RLS + the enforce_team_rules trigger backstop the write.
// `userId` is the authenticated caller — every write is scoped to it.
export async function saveTeamFor(
  supabase: DB,
  userId: string,
  input: SaveTeamInput
): Promise<SaveTeamResult> {
  const round = await getActiveRound(supabase);
  if (!round) return { ok: false, error: "No round is open for selection." };
  if (round.lock_time && new Date(round.lock_time) <= new Date()) {
    return { ok: false, error: "Selection has locked for this round." };
  }

  const lineup = await getRoundLineup(supabase, round);
  const priceOf = (id: number) =>
    lineup.find((d) => d.driverId === id)?.price;

  const { driverIds, boostDriverId, wildcard = false } = input;
  const check = validateTeam(driverIds, boostDriverId, priceOf);
  if (!check.valid) return { ok: false, error: check.errors[0] };

  const [ctx, existing] = await Promise.all([
    getTransferContext(supabase, userId, round),
    getUserTeam(supabase, userId, round.id),
  ]);

  // Wildcard is once per season and sticky once saved on a round — the client
  // can't restore it by resaving with wildcard=false.
  const resolved = resolveWildcard({
    requested: wildcard,
    existingThisRound: existing?.wildcardUsed ?? false,
    usedInPriorRound: ctx.wildcardUsedInPriorRound,
  });
  if (resolved.error) return { ok: false, error: resolved.error };

  const transfers = countTransfers(ctx.baseline, driverIds);

  const { error } = await supabase.from("user_teams").upsert(
    {
      user_id: userId,
      round_id: round.id,
      driver_ids: driverIds,
      boost_driver_id: boostDriverId,
      transfers_used: transfers,
      wildcard_used: resolved.wildcard,
    },
    { onConflict: "user_id,round_id" }
  );
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
