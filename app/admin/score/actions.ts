"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { getAdmin } from "@/lib/admin";
import { GAME_DATA_TAG } from "@/lib/cached-queries";
import { runScoreRound, type ScoreRoundResult } from "@/lib/scoring/run";
import { createAdminClient } from "@/lib/supabase/admin";

export type { ScoreRoundResult } from "@/lib/scoring/run";

export async function scoreRound(roundId: number): Promise<ScoreRoundResult> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, error: "Admin only." };

  try {
    const result = await runScoreRound(createAdminClient(), roundId);
    if (result.ok) {
      revalidatePath("/admin/score");
      // Scoring completes the round, which moves the active round forward —
      // every cached shared read (round, lineup, form) must refresh.
      revalidateTag(GAME_DATA_TAG, "max");
    }
    return result;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Scoring failed.",
    };
  }
}

