"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { getAdmin } from "@/lib/admin";
import { GAME_DATA_TAG } from "@/lib/cached-queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { deriveGrid, type RaceType } from "@/lib/wiki/grid";
import { resultsForRound } from "@/lib/wiki/results";

const WIKI_API = "https://en.wikipedia.org/w/api.php";

export type SaveResultsResult = { ok: true } | { ok: false; error: string };

type ResultInput = {
  driverId: number;
  position: number | null;
  gridPosition: number | null;
  status: "classified" | "dnf" | "dsq" | "dns";
  fastestLap: boolean;
};

export async function saveSessionResults(input: {
  sessionId: number;
  results: ResultInput[];
}): Promise<SaveResultsResult> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, error: "Admin only." };

  const db = createAdminClient();
  const rows = input.results.map((r) => ({
    session_id: input.sessionId,
    driver_id: r.driverId,
    // Position only meaningful when classified.
    position: r.status === "classified" ? r.position : null,
    grid_position: r.gridPosition,
    status: r.status,
    fastest_lap: r.status === "classified" ? r.fastestLap : false,
    data_source: "manual_admin" as const,
  }));

  const { error } = await db
    .from("session_results")
    .upsert(rows, { onConflict: "session_id,driver_id" });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/results");
  revalidateTag(GAME_DATA_TAG, "max"); // results feed form sparklines + driver profiles
  return { ok: true };
}

export type ImportedResult = ResultInput;
export type ImportResult =
  | { ok: true; results: ImportedResult[]; unmatched: string[] }
  | { ok: false; error: string };

// Fetch a race's results from Wikipedia and derive its grid from the (already
// entered) qualifying. Returns rows for the admin to review in the form, not a
// direct write. Source: Wikipedia (CC BY-SA). Never f1academy.com.
export async function importRaceSession(
  roundId: number,
  sessionType: string
): Promise<ImportResult> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, error: "Admin only." };
  if (sessionType === "qualifying") {
    return { ok: false, error: "Qualifying is entered manually." };
  }
  const db = createAdminClient();

  const { data: round } = await db
    .from("rounds")
    .select("id, season_id, round_number")
    .eq("id", roundId)
    .maybeSingle();
  if (!round) return { ok: false, error: "Round not found." };

  const { data: season } = await db
    .from("seasons")
    .select("year")
    .eq("id", round.season_id)
    .maybeSingle();
  if (!season) return { ok: false, error: "Season not found." };

  const { data: sessions } = await db
    .from("sessions")
    .select("id, session_type")
    .eq("round_id", roundId);
  const threeRace = (sessions ?? []).some((s) => s.session_type === "race3");
  const qualiSession = (sessions ?? []).find(
    (s) => s.session_type === "qualifying"
  );
  if (!qualiSession) return { ok: false, error: "No qualifying session." };

  const { data: qualiResults } = await db
    .from("session_results")
    .select("driver_id, position")
    .eq("session_id", qualiSession.id);
  const qualiMap = new Map<number, number>();
  for (const r of qualiResults ?? []) {
    if (r.position !== null) qualiMap.set(r.driver_id, r.position);
  }
  if (qualiMap.size === 0) {
    return {
      ok: false,
      error: "Enter and save qualifying first — it's needed to derive the grid.",
    };
  }

  // Pull the championship matrix from Wikipedia.
  const page = `${season.year}_F1_Academy_season`;
  const url =
    `${WIKI_API}?action=parse&page=${encodeURIComponent(page)}` +
    `&prop=wikitext&format=json&formatversion=2`;
  let wikitext: string | undefined;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AcademyFantasy/0.1 (github.com/josh098900)" },
    });
    if (!res.ok) return { ok: false, error: `Wikipedia API ${res.status}` };
    const json = (await res.json()) as { parse?: { wikitext?: string } };
    wikitext = json.parse?.wikitext;
  } catch {
    return { ok: false, error: "Couldn't reach Wikipedia." };
  }
  if (!wikitext) return { ok: false, error: "Wikipedia page not found." };

  const idx = wikitext.indexOf("Drivers' championship");
  const section = idx === -1 ? wikitext : wikitext.slice(idx);
  const parsed = resultsForRound(section, round.round_number);
  if (parsed.length === 0) {
    return { ok: false, error: "No results for this round on Wikipedia yet." };
  }

  const { data: drivers } = await db.from("drivers").select("id, full_name");
  const idByName = new Map(
    (drivers ?? []).map((d) => [d.full_name.toLowerCase(), d.id])
  );

  const grid = deriveGrid(qualiMap, sessionType as RaceType, threeRace);
  const results: ImportedResult[] = [];
  const unmatched: string[] = [];
  for (const p of parsed) {
    const race = p.races[sessionType as RaceType];
    if (!race) continue;
    const driverId = idByName.get(p.driver.toLowerCase());
    if (!driverId) {
      unmatched.push(p.driver);
      continue;
    }
    results.push({
      driverId,
      position: race.position,
      gridPosition: grid.get(driverId) ?? null,
      status: race.status,
      fastestLap: race.fastestLap,
    });
  }
  return { ok: true, results, unmatched };
}
