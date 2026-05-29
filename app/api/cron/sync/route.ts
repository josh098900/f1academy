import { NextResponse } from "next/server";

import { runScoreRound } from "@/lib/scoring/run";
import { createAdminClient } from "@/lib/supabase/admin";
import { deriveGrid, type RaceType } from "@/lib/wiki/grid";
import { resultsForRound } from "@/lib/wiki/results";

export const dynamic = "force-dynamic";

const WIKI_API = "https://en.wikipedia.org/w/api.php";

// Scheduled sync: pull race results from Wikipedia for rounds that have them,
// fill any race sessions with no results yet (never clobbering manual entries),
// derive grids from saved qualifying, and re-score. Gated by CRON_SECRET so
// only the scheduler can trigger it.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const { data: season } = await db
    .from("seasons")
    .select("id, year")
    .eq("is_current", true)
    .maybeSingle()
    .throwOnError();
  if (!season) {
    return NextResponse.json({ error: "No current season" }, { status: 500 });
  }

  const page = `${season.year}_F1_Academy_season`;
  let wikitext: string | undefined;
  try {
    const res = await fetch(
      `${WIKI_API}?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&format=json&formatversion=2`,
      { headers: { "User-Agent": "AcademyFantasy/0.1 (github.com/josh098900)" } }
    );
    if (res.ok) {
      const json = (await res.json()) as { parse?: { wikitext?: string } };
      wikitext = json.parse?.wikitext;
    }
  } catch {
    // fall through
  }
  if (!wikitext) {
    return NextResponse.json({ error: "Wikipedia unavailable" }, { status: 502 });
  }
  const idx = wikitext.indexOf("Drivers' championship");
  const section = idx === -1 ? wikitext : wikitext.slice(idx);

  const { data: drivers } = await db
    .from("drivers")
    .select("id, full_name")
    .throwOnError();
  const idByName = new Map(
    (drivers ?? []).map((d) => [d.full_name.toLowerCase(), d.id])
  );

  // All rounds — the per-session "skip if results exist" check below prevents
  // reprocessing, and rounds Wikipedia has no data for are skipped anyway. This
  // also backfills rounds already marked complete that are missing results.
  const { data: rounds } = await db
    .from("rounds")
    .select("id, round_number")
    .eq("season_id", season.id)
    .order("round_number")
    .throwOnError();

  const synced: { round: number; applied: number; scored: number }[] = [];
  for (const round of rounds ?? []) {
    const parsed = resultsForRound(section, round.round_number);
    if (parsed.length === 0) continue; // not on Wikipedia yet

    const { data: sessions } = await db
      .from("sessions")
      .select("id, session_type")
      .eq("round_id", round.id)
      .throwOnError();
    const threeRace = (sessions ?? []).some((s) => s.session_type === "race3");
    const qualiSession = (sessions ?? []).find(
      (s) => s.session_type === "qualifying"
    );

    const qualiMap = new Map<number, number>();
    if (qualiSession) {
      const { data: qr } = await db
        .from("session_results")
        .select("driver_id, position")
        .eq("session_id", qualiSession.id)
        .throwOnError();
      for (const r of qr ?? []) {
        if (r.position !== null) qualiMap.set(r.driver_id, r.position);
      }
    }

    let applied = 0;
    for (const s of sessions ?? []) {
      if (s.session_type === "qualifying") continue;
      const { count } = await db
        .from("session_results")
        .select("*", { count: "exact", head: true })
        .eq("session_id", s.id)
        .throwOnError();
      if ((count ?? 0) > 0) continue; // don't overwrite existing results

      const grid = deriveGrid(qualiMap, s.session_type as RaceType, threeRace);
      const rows = [];
      for (const p of parsed) {
        const race = p.races[s.session_type as RaceType];
        if (!race) continue;
        const driverId = idByName.get(p.driver.toLowerCase());
        if (!driverId) continue;
        rows.push({
          session_id: s.id,
          driver_id: driverId,
          position: race.position,
          grid_position: grid.get(driverId) ?? null,
          status: race.status,
          fastest_lap: race.fastestLap,
          data_source: "wikipedia" as const,
        });
      }
      if (rows.length) {
        await db
          .from("session_results")
          .upsert(rows, { onConflict: "session_id,driver_id" })
          .throwOnError();
        applied += rows.length;
      }
    }

    let scored = 0;
    if (applied > 0) {
      const result = await runScoreRound(db, round.id);
      if (result.ok) scored = result.scored;
    }
    if (applied > 0) synced.push({ round: round.round_number, applied, scored });
  }

  return NextResponse.json({ ok: true, synced });
}
