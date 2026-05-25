import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { generate } from "./gemini";

export type InsightKind = "pre_race" | "post_race" | "driver_take";

// userId null = a global insight (pre-race read, driver take) shared by everyone.
export type InsightRequest = {
  userId: string | null;
  roundId: number;
  kind: InsightKind;
  targetId: number | null;
};

export type InsightResult =
  | { ok: true; content: string; cached: boolean }
  | { ok: false; error: string };

const RATE_LIMIT = 5; // generations per user per window
const RATE_WINDOW_MS = 10 * 60 * 1000;

// Returns a cached insight, or generates one (via Gemini), caches it, and
// returns it. Insert uses the service role (coach_insights is service-write).
export async function getOrGenerateInsight(
  req: InsightRequest,
  build: () => { system?: string; prompt: string }
): Promise<InsightResult> {
  const db = createAdminClient();

  // Cache lookup (keyed by round + kind + target + scope).
  let query = db
    .from("coach_insights")
    .select("content")
    .eq("round_id", req.roundId)
    .eq("kind", req.kind);
  query = req.userId === null ? query.is("user_id", null) : query.eq("user_id", req.userId);
  query = req.targetId === null ? query.is("target_id", null) : query.eq("target_id", req.targetId);
  const { data: existing } = await query.limit(1).maybeSingle();
  if (existing) return { ok: true, content: existing.content, cached: true };

  // Rate-limit generations per user (global insights are capped by caching).
  if (req.userId) {
    const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
    const { count } = await db
      .from("coach_insights")
      .select("*", { count: "exact", head: true })
      .eq("user_id", req.userId)
      .gte("created_at", since);
    if ((count ?? 0) >= RATE_LIMIT) {
      return { ok: false, error: "Coach is catching its breath — try again in a few minutes." };
    }
  }

  let generated;
  try {
    const { system, prompt } = build();
    generated = await generate(prompt, system);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Coach is unavailable right now.",
    };
  }
  if (!generated.text) {
    return { ok: false, error: "Coach didn't have anything to say — try again." };
  }

  await db.from("coach_insights").insert({
    user_id: req.userId,
    round_id: req.roundId,
    kind: req.kind,
    target_id: req.targetId,
    content: generated.text,
    model: generated.model,
    tokens_used: generated.tokens,
  });

  return { ok: true, content: generated.text, cached: false };
}
