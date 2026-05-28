"use server";

import { revalidatePath } from "next/cache";

import {
  getOrGenerateInsight,
  type InsightResult,
} from "@/lib/coach/insights";
import { getDriverPoints } from "@/lib/coach/standings";
import {
  type ActiveRound,
  type LineupDriver,
  getActiveRound,
  getDriverProfile,
  getRoundLineup,
} from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

// Toggle the player's per-user Coach preference. Updates via the user client so
// RLS (own-row only) enforces ownership; revalidates the (app) layout so every
// Coach surface picks up the new state on the next render.
export async function setCoachEnabled(enabled: boolean): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("users")
    .update({ coach_enabled: enabled })
    .eq("id", user.id)
    .throwOnError();

  revalidatePath("/", "layout");
}

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

type Breakdown = {
  drivers: { driverId: number; total: number; boosted: boolean }[];
};

// The user's most recent scored round, with their team's per-driver points.
export async function getLatestRecap(): Promise<InsightResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  const { data: scores } = await supabase
    .from("user_scores")
    .select(
      "round_id, round_points, cumulative_points, breakdown, round:rounds(round_number, circuit_name)"
    )
    .eq("user_id", user.id)
    .throwOnError();

  const latest = (scores ?? [])
    .filter((s) => s.round)
    .sort((a, b) => (b.round!.round_number ?? 0) - (a.round!.round_number ?? 0))[0];
  if (!latest) return { ok: false, error: "No scored rounds yet." };

  const breakdown = (latest.breakdown as Breakdown | null) ?? { drivers: [] };
  const driverIds = breakdown.drivers.map((d) => d.driverId);
  const { data: drivers } = await supabase
    .from("drivers")
    .select("id, short_name")
    .in("id", driverIds.length ? driverIds : [-1]);
  const nameOf = new Map((drivers ?? []).map((d) => [d.id, d.short_name]));

  const lines = breakdown.drivers
    .map(
      (d) =>
        `${nameOf.get(d.driverId) ?? "Driver"}: ${d.total} pts${d.boosted ? " (boosted 2x)" : ""}`
    )
    .join("\n");

  return getOrGenerateInsight(
    { userId: user.id, roundId: latest.round_id, kind: "post_race", targetId: null },
    () => ({
      system:
        "You are the Coach for a free-to-play F1 Academy fantasy game (entertainment only). F1 Academy is all-female — use she/her for drivers. Write a short, personal, encouraging post-race recap grounded ONLY in the numbers given. 3-4 sentences, no hype.",
      prompt: `Round ${latest.round!.round_number} at ${latest.round!.circuit_name}. The player scored ${latest.round_points} points this round (season total ${latest.cumulative_points}).

Their team's points this round:
${lines}

Recap where their points came from — call out the standouts and any that disappointed (especially the boost pick) — and end with a brief forward look.`,
    })
  );
}

// A short scouting take on one driver, grounded in her season form. Global
// (not per-user), keyed to the active round + driver so it caches per round.
export async function getDriverTake(driverId: number): Promise<InsightResult> {
  const supabase = await createClient();
  const round = await getActiveRound(supabase);
  if (!round) return { ok: false, error: "No upcoming round." };

  const profile = await getDriverProfile(supabase, driverId);
  if (!profile) return { ok: false, error: "Driver not found." };

  const form = profile.history.length
    ? profile.history
        .map((h) => `R${h.roundNumber} ${h.circuitName}: ${h.points} pts`)
        .join("\n")
    : "No completed rounds yet this season.";

  return getOrGenerateInsight(
    { userId: null, roundId: round.id, kind: "driver_take", targetId: driverId },
    () => ({
      system:
        "You are the Coach for a free-to-play F1 Academy fantasy game (entertainment only). F1 Academy is all-female — use she/her. Give a concise scouting take on ONE driver, grounded ONLY in the data provided: no invented results, no hype, no guarantees. 2–3 short sentences.",
      prompt: `Driver: ${profile.fullName} (${profile.team ?? "team TBC"}${profile.f1Partner ? `, ${profile.f1Partner}-backed` : ""}).
${profile.price !== null ? `Fantasy price this round: £${profile.price.toFixed(1)}M.` : "Not priced this round."}
Season points so far: ${profile.seasonPoints}.

Per-round form:
${form}

Upcoming: Round ${round.round_number}, ${round.circuit_name} (${round.country}). Give a brief read on her form and whether she looks like value at this price — weigh it up, don't dictate a pick.`,
    })
  );
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
