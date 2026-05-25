"use server";

import {
  getOrGenerateInsight,
  type InsightResult,
} from "@/lib/coach/insights";
import { getDriverPoints } from "@/lib/coach/standings";
import {
  type ActiveRound,
  type LineupDriver,
  getActiveRound,
  getRoundLineup,
} from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

function buildPreRacePrompt(
  round: ActiveRound,
  lineup: LineupDriver[],
  points: Map<number, number>
): { system: string; prompt: string } {
  const drivers = lineup
    .map(
      (d) =>
        `${d.lastName} (${d.team}${d.f1Partner ? `, ${d.f1Partner}-backed` : ""}) — £${d.price.toFixed(1)}M, ${points.get(d.driverId) ?? 0} pts so far`
    )
    .join("\n");

  const system =
    "You are the Coach for a free-to-play F1 Academy fantasy game — entertainment only, no real money. F1 Academy is an all-female series: always refer to drivers as she/her. Give concise, grounded pre-race analysis based ONLY on the data provided: no invented facts, no hype, no guarantees. Keep it to 3–4 short sentences.";

  const prompt = `Upcoming round: Round ${round.round_number}, ${round.circuit_name} (${round.country}). Players pick 4 drivers under a £40M cap.

Drivers (price · season points so far):
${drivers}

Give a brief pre-race read: highlight 2–3 drivers worth considering this round — a mix of in-form premium picks and good-value cheaper options — with a one-line reason each, grounded in their price and form. Suggest options to weigh up; don't dictate a single team.`;

  return { system, prompt };
}

export async function getPreRaceInsight(): Promise<InsightResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  const round = await getActiveRound(supabase);
  if (!round) return { ok: false, error: "No upcoming round." };

  const [lineup, points] = await Promise.all([
    getRoundLineup(supabase, round),
    getDriverPoints(supabase, round.season_id, round.round_number),
  ]);

  return getOrGenerateInsight(
    { userId: null, roundId: round.id, kind: "pre_race", targetId: null },
    () => buildPreRacePrompt(round, lineup, points)
  );
}
