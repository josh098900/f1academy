/**
 * add-wildcard — register a mid-season wildcard driver for a single round.
 *
 * F1 Academy runs a rotating wildcard seat (Hitech has run it all season), so
 * new drivers appear round by round and the wiki-sync seed won't know about
 * them until after they've raced. This script does the three inserts the
 * picker needs, idempotently (safe to re-run):
 *   1. drivers            — identity row (name spelling MUST match Wikipedia
 *                            exactly, umlauts included, or the Monday results
 *                            sync won't match her)
 *   2. season_entries     — wildcard entry scoped to the given round
 *   3. driver_prices      — the round price (the picker skips unpriced drivers)
 *
 * Reads production credentials from .env.local (NEXT_PUBLIC_SUPABASE_URL +
 * SUPABASE_SECRET_KEY). Run BEFORE entering qualifying results so the driver
 * exists when you type in the quali order.
 *
 *   pnpm exec tsx scripts/add-wildcard.ts \
 *     --name "Chiara Bättig" --country CH --car 6 \
 *     --team Hitech --round 3 --price 8.0
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "../db/types";

function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let val = m[2].trim();
      if (/^(["']).*\1$/.test(val)) val = val.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = val;
    }
  } catch {
    // rely on exported env
  }
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(`--${flag}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const fullName = arg("name");
  const country = arg("country");
  const car = Number(arg("car"));
  const teamName = arg("team");
  const roundNumber = Number(arg("round"));
  const price = Number(arg("price"));

  if (!fullName || !country || !teamName || !Number.isFinite(car) || !Number.isInteger(roundNumber) || !Number.isFinite(price)) {
    console.error(
      'Usage: pnpm exec tsx scripts/add-wildcard.ts --name "Full Name" --country CH --car 6 --team Hitech --round 3 --price 8.0'
    );
    process.exit(1);
  }

  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.");
    process.exit(1);
  }
  const db = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Resolve season, round, team up front — fail loudly if anything's off.
  const { data: season, error: seasonErr } = await db
    .from("seasons").select("id, year").eq("is_current", true).maybeSingle();
  if (seasonErr || !season) throw seasonErr ?? new Error("No current season");

  const { data: round, error: roundErr } = await db
    .from("rounds").select("id, round_number, lock_time")
    .eq("season_id", season.id).eq("round_number", roundNumber).maybeSingle();
  if (roundErr || !round) throw roundErr ?? new Error(`No round ${roundNumber}`);

  const { data: team, error: teamErr } = await db
    .from("teams").select("id, name").ilike("name", teamName).maybeSingle();
  if (teamErr || !team) throw teamErr ?? new Error(`No team matching "${teamName}"`);

  const first = fullName.trim().split(/\s+/)[0];
  const shortName = `${first[0]}. ${fullName.trim().slice(first.length).trim()}`;
  const avatar = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(fullName)}&backgroundColor=141414`;

  // 1. Driver — reuse if the exact name already exists (idempotent re-run).
  const { data: existing } = await db
    .from("drivers").select("id").eq("full_name", fullName).maybeSingle();
  let driverId: number;
  if (existing) {
    driverId = existing.id;
    console.log(`driver exists (#${driverId}) — reusing`);
  } else {
    const { data: created, error } = await db
      .from("drivers")
      .insert({
        full_name: fullName,
        short_name: shortName,
        country_code: country.toUpperCase(),
        avatar_url: avatar,
      })
      .select("id").single();
    if (error) throw error;
    driverId = created.id;
    console.log(`driver created: ${fullName} (${shortName}) → id ${driverId}`);
  }

  // 2. Season entry — wildcard scoped to this round. If she returns for a
  // later round, re-running with that round number appends it.
  const { data: entry } = await db
    .from("season_entries").select("id, rounds")
    .eq("season_id", season.id).eq("driver_id", driverId).maybeSingle();
  if (entry) {
    const rounds = Array.from(new Set([...(entry.rounds ?? []), roundNumber])).sort((a, b) => a - b);
    const { error } = await db
      .from("season_entries").update({ rounds }).eq("id", entry.id);
    if (error) throw error;
    console.log(`entry exists — rounds now [${rounds.join(", ")}]`);
  } else {
    const { error } = await db.from("season_entries").insert({
      season_id: season.id,
      driver_id: driverId,
      team_id: team.id,
      car_number: car,
      is_wildcard: true,
      rounds: [roundNumber],
      f1_partner_team: null,
    });
    if (error) throw error;
    console.log(`entry created: ${team.name}, car #${car}, wildcard, rounds [${roundNumber}]`);
  }

  // 3. Price for this round (upsert so a re-run can correct it).
  const { error: priceErr } = await db.from("driver_prices").upsert(
    { round_id: round.id, driver_id: driverId, price_millions: price },
    { onConflict: "round_id,driver_id" }
  );
  if (priceErr) throw priceErr;
  console.log(`price set: £${price.toFixed(1)}M for R${roundNumber}`);

  console.log(
    `\nDone. ${fullName} is pickable for R${roundNumber} (locks ${round.lock_time}).` +
      `\nNext: enter qualifying via /admin/results, post the News announcement, send the email.`
  );
}

main().catch((err) => {
  console.error("add-wildcard failed:", err.message ?? err);
  process.exit(1);
});
