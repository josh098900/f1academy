"use server";

import { revalidatePath } from "next/cache";

import { getActiveRound, getRoundLineup } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

const CAP = 40;
const SQUAD = 4;

export type SaveTeamResult = { ok: true } | { ok: false; error: string };

// Persists the user's pick for the active round. Re-validates everything
// server-side — never trust the client. RLS scopes the write to the user.
export async function saveTeam(input: {
  driverIds: number[];
  boostDriverId: number;
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

  const { driverIds, boostDriverId } = input;
  if (driverIds.length !== SQUAD) {
    return { ok: false, error: `Pick exactly ${SQUAD} drivers.` };
  }
  if (new Set(driverIds).size !== SQUAD) {
    return { ok: false, error: "You picked the same driver twice." };
  }
  if (!driverIds.includes(boostDriverId)) {
    return { ok: false, error: "Your boost must be one of your drivers." };
  }

  // Validate against the round's real lineup + prices.
  const lineup = await getRoundLineup(supabase, round);
  const byId = new Map(lineup.map((d) => [d.driverId, d]));
  let spent = 0;
  for (const id of driverIds) {
    const driver = byId.get(id);
    if (!driver) {
      return { ok: false, error: "A selected driver isn't available this round." };
    }
    spent += driver.price;
  }
  spent = Math.round(spent * 10) / 10; // prices are 1dp; avoid float drift
  if (spent > CAP) {
    return { ok: false, error: `Over budget by £${(spent - CAP).toFixed(1)}M.` };
  }

  const { error } = await supabase.from("user_teams").upsert(
    {
      user_id: user.id,
      round_id: round.id,
      driver_ids: driverIds,
      boost_driver_id: boostDriverId,
    },
    { onConflict: "user_id,round_id" }
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/team");
  return { ok: true };
}
