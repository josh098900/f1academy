"use server";

import { revalidatePath } from "next/cache";

import {
  getActiveRound,
  getRoundLineup,
  getTransferContext,
  getUserTeam,
} from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import {
  countTransfers,
  resolveWildcard,
  validateTeam,
} from "@/lib/team-rules";

export type SaveTeamResult = { ok: true } | { ok: false; error: string };

// Persists the user's pick for the active round. Re-validates everything
// server-side — never trust the client. RLS scopes the write to the user.
export async function saveTeam(input: {
  driverIds: number[];
  boostDriverId: number;
  wildcard?: boolean;
}): Promise<SaveTeamResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

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
    getTransferContext(supabase, user.id, round),
    getUserTeam(supabase, user.id, round.id),
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
      user_id: user.id,
      round_id: round.id,
      driver_ids: driverIds,
      boost_driver_id: boostDriverId,
      transfers_used: transfers,
      wildcard_used: resolved.wildcard,
    },
    { onConflict: "user_id,round_id" }
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/team");
  return { ok: true };
}
