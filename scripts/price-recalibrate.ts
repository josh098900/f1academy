/**
 * price-recalibrate — recompute driver prices from real form, per
 * docs/files/SCORING_SYSTEM.md. Runs between rounds (after results are in).
 *
 * Method: score each driver's completed rounds (no boost) to get points, take
 * their average points-per-round, and map the field onto £4–15M. Wildcards for
 * the target round get the flat £5M default. With no prior-season data yet, we
 * weight purely on this season's form (the doc's 30% last-season term is 0).
 *
 * Run (writes the target round's prices; --dry to preview):
 *   SUPABASE_URL=.. SUPABASE_SERVICE_KEY=.. pnpm exec tsx scripts/price-recalibrate.ts [round] [--dry]
 */
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../db/types";
import { type DriverSession, scoreDriverWeekend } from "../lib/scoring";

const FLOOR = 4;
const CAP = 15;
const WILDCARD_PRICE = 5;

const dry = process.argv.includes("--dry");
const roundArg = process.argv.find((a) => /^\d+$/.test(a));

const db = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

function roundHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

async function main() {
  const { data: season } = await db
    .from("seasons")
    .select("id, year")
    .eq("is_current", true)
    .single()
    .throwOnError();

  const { data: rounds } = await db
    .from("rounds")
    .select("id, round_number, status")
    .eq("season_id", season.id)
    .order("round_number")
    .throwOnError();

  // Target = the named round, else the first upcoming one.
  const targetNumber = roundArg
    ? Number(roundArg)
    : (rounds.find((r) => r.status === "upcoming") ?? rounds[rounds.length - 1])
        .round_number;
  const target = rounds.find((r) => r.round_number === targetNumber);
  if (!target) throw new Error(`Round ${targetNumber} not found`);

  const completed = rounds.filter(
    (r) => r.round_number < targetNumber && r.status === "complete"
  );
  console.log(
    `Recalibrating R${targetNumber} prices from ${completed.length} completed round(s)…`
  );

  // Per driver: list of weekend points across completed rounds.
  const points = new Map<number, number[]>();
  for (const round of completed) {
    const { data: sessions } = await db
      .from("sessions")
      .select("id, session_type")
      .eq("round_id", round.id)
      .throwOnError();
    const typeOf = new Map(sessions.map((s) => [s.id, s.session_type]));
    const { data: results } = await db
      .from("session_results")
      .select("session_id, driver_id, position, grid_position, status, fastest_lap")
      .in("session_id", sessions.map((s) => s.id))
      .throwOnError();

    const byDriver = new Map<number, DriverSession[]>();
    for (const r of results) {
      const type = typeOf.get(r.session_id);
      if (!type) continue;
      const arr = byDriver.get(r.driver_id) ?? [];
      arr.push({
        type: type as DriverSession["type"],
        position: r.position,
        gridPosition: r.grid_position,
        status: r.status as DriverSession["status"],
        fastestLap: r.fastest_lap,
      });
      byDriver.set(r.driver_id, arr);
    }
    for (const [driverId, sess] of byDriver) {
      const score = scoreDriverWeekend({ sessions: sess }).base;
      (points.get(driverId) ?? points.set(driverId, []).get(driverId)!).push(score);
    }
  }

  // Target round's entrants (full-season + wildcards contracted for it).
  const { data: entries } = await db
    .from("season_entries")
    .select("driver_id, is_wildcard, rounds, driver:drivers(short_name)")
    .eq("season_id", season.id)
    .throwOnError();
  const entrants = entries.filter(
    (e) => !e.is_wildcard || (e.rounds ?? []).includes(targetNumber)
  );

  // Average PPR per driver; min–max map the field onto [FLOOR+0.5, CAP-0.5].
  const ppr = new Map<number, number>();
  for (const e of entrants) {
    const list = points.get(e.driver_id) ?? [];
    ppr.set(e.driver_id, list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
  }
  const values = [...ppr.values()];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const rows = entrants.map((e) => {
    const price = e.is_wildcard
      ? WILDCARD_PRICE
      : Math.min(
          CAP,
          Math.max(
            FLOOR,
            roundHalf(4.5 + ((ppr.get(e.driver_id)! - min) / span) * 10)
          )
        );
    return {
      round_id: target.id,
      driver_id: e.driver_id,
      price_millions: price,
      short_name: e.driver?.short_name ?? String(e.driver_id),
      ppr: ppr.get(e.driver_id) ?? 0,
    };
  });
  rows.sort((a, b) => b.price_millions - a.price_millions);

  console.log("\nDriver                 PPR     Price");
  for (const r of rows) {
    console.log(
      `  ${r.short_name.padEnd(20)} ${r.ppr.toFixed(1).padStart(5)}   £${r.price_millions.toFixed(1)}M`
    );
  }

  if (dry) {
    console.log("\n--dry: not written.");
    return;
  }
  const { error } = await db.from("driver_prices").upsert(
    rows.map((r) => ({
      round_id: r.round_id,
      driver_id: r.driver_id,
      price_millions: r.price_millions,
    })),
    { onConflict: "round_id,driver_id" }
  );
  if (error) throw error;
  console.log(`\nWrote ${rows.length} prices for R${targetNumber}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
