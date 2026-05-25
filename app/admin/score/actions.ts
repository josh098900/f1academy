"use server";

import { revalidatePath } from "next/cache";

import { getAdmin } from "@/lib/admin";
import { runScoreRound, type ScoreRoundResult } from "@/lib/scoring/run";
import { createAdminClient } from "@/lib/supabase/admin";

export type { ScoreRoundResult } from "@/lib/scoring/run";

export async function scoreRound(roundId: number): Promise<ScoreRoundResult> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, error: "Admin only." };

  try {
    const result = await runScoreRound(createAdminClient(), roundId);
    if (result.ok) revalidatePath("/admin/score");
    return result;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Scoring failed.",
    };
  }
}

