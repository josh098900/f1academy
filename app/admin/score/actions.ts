"use server";

import { revalidatePath } from "next/cache";

import { getAdmin } from "@/lib/admin";
import { type ScoreRoundResult, runScoreRound } from "@/lib/scoring/run";
import { createAdminClient } from "@/lib/supabase/admin";

export type { ScoreRoundResult };

export async function scoreRound(roundId: number): Promise<ScoreRoundResult> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, error: "Admin only." };

  const result = await runScoreRound(createAdminClient(), roundId);
  if (result.ok) revalidatePath("/admin/score");
  return result;
}
