import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/types";

// System (activity) posts for the league feed — round scored, member joined,
// etc. These are is_system posts with no author; the RLS insert policy forbids
// authenticated clients from creating them, so they go in via the SERVICE-ROLE
// client only (createAdminClient). Keeping the feed seeded with game activity
// is the biggest retention lever, so callers fire these on real game events.

type Admin = SupabaseClient<Database>;

export async function postSystemMessage(
  admin: Admin,
  leagueId: number,
  kind: string,
  body: string
): Promise<void> {
  await admin.from("league_posts").insert({
    league_id: leagueId,
    author_id: null,
    is_system: true,
    system_kind: kind,
    body,
  });
}

// Announce a freshly-scored round into EVERY league of that season, so each
// league's feed gets fresh activity on race weekends. Best-effort: failures
// here must never break scoring, so callers should not await this in a way that
// propagates its error into the score result.
export async function announceRoundScored(
  admin: Admin,
  round: { seasonId: number; roundNumber: number; circuitName: string | null }
): Promise<void> {
  const { data: leagues } = await admin
    .from("leagues")
    .select("id")
    .eq("season_id", round.seasonId);
  if (!leagues || leagues.length === 0) return;

  const where = round.circuitName ? ` — ${round.circuitName}` : "";
  const body = `🏁 Round ${round.roundNumber}${where} scored. The new standings are in — see who moved.`;
  await admin.from("league_posts").insert(
    leagues.map((l) => ({
      league_id: l.id,
      author_id: null,
      is_system: true,
      system_kind: "round_scored",
      body,
    }))
  );
}

export async function announceMemberJoined(
  admin: Admin,
  leagueId: number,
  displayName: string
): Promise<void> {
  await postSystemMessage(
    admin,
    leagueId,
    "member_joined",
    `👋 ${displayName} joined the league.`
  );
}
