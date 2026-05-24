/**
 * seed — load db/seed/<year>.json (produced by wiki-sync) into the database.
 *
 * Uses the service-role key (bypasses RLS, like the scoring engine). Idempotent:
 * re-running updates existing rows rather than duplicating, so it's safe to run
 * again after wiki-sync picks up roster/calendar changes.
 *
 * Connection comes from env: SUPABASE_URL, SUPABASE_SERVICE_KEY
 *
 * Run (local):
 *   eval "$(pnpm exec supabase status -o env | sed 's/^/export /')" \
 *     && SUPABASE_URL=$API_URL SUPABASE_SERVICE_KEY=$SERVICE_ROLE_KEY \
 *        pnpm exec tsx scripts/seed.ts
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "../db/types";

const YEAR = Number(process.argv[2]) || 2026;
const TODAY = new Date().toISOString().slice(0, 10);

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_KEY.");
  process.exit(1);
}
const db = createClient<Database>(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type SeedEntry = {
  team: string;
  teamCountry: string | null;
  carNumber: number | null;
  driver: string;
  driverCountry: string | null;
  f1Partner: string | null;
  rounds: string;
  isWildcard: boolean;
};
type SeedRound = {
  roundNumber: number;
  country: string | null;
  circuit: string;
  location: string | null;
  dates: string[];
  threeRace: boolean;
};
type Seed = {
  season: number;
  teams: { name: string; country: string | null }[];
  entries: SeedEntry[];
  rounds: SeedRound[];
};

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function shortName(full: string): string {
  const [first, ...rest] = full.trim().split(/\s+/);
  return rest.length ? `${first[0]}. ${rest.join(" ")}` : full;
}

// Stylised, deterministic avatar seeded by name (DiceBear Notionists on our
// surface colour). See DESIGN_SYSTEM.md — we don't host driver photos in v1.
function avatarUrl(name: string): string {
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(name)}&backgroundColor=141414`;
}

// "1–2" -> [1,2]; "1,3" -> [1,3]; "1" -> [1]; "TBC" -> [].
function parseRounds(raw: string): number[] {
  const out = new Set<number>();
  for (const part of raw.split(",")) {
    const range = part.match(/^(\d+)[–-](\d+)$/);
    if (range) {
      for (let n = +range[1]; n <= +range[2]; n++) out.add(n);
    } else if (/^\d+$/.test(part)) {
      out.add(+part);
    }
  }
  return [...out].sort((a, b) => a - b);
}

// "14 March" + year -> "2026-03-14".
function parseDate(s: string, year: number): string | null {
  const m = s.trim().match(/^(\d{1,2})\s+([A-Za-z]+)$/);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `${year}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function roundStatus(start: string | null, end: string | null): string {
  if (!start || !end) return "upcoming";
  if (end < TODAY) return "complete";
  if (start <= TODAY) return "live";
  return "upcoming";
}

async function main() {
  const file = path.join(process.cwd(), "db", "seed", `${YEAR}.json`);
  const seed = JSON.parse(await readFile(file, "utf8")) as Seed;
  console.log(`Seeding ${YEAR} from ${file} → ${url}\n`);

  // Season (exactly one current; unset others first).
  await db.from("seasons").update({ is_current: false }).neq("year", YEAR).throwOnError();
  const { data: season } = await db
    .from("seasons")
    .upsert({ year: YEAR, is_current: true }, { onConflict: "year" })
    .select("id")
    .single()
    .throwOnError();
  const seasonId = season.id;

  // Teams — lookup-or-insert by name.
  const teamId = new Map<string, number>();
  for (const t of seed.teams) {
    const { data: existing } = await db
      .from("teams")
      .select("id")
      .eq("name", t.name)
      .maybeSingle()
      .throwOnError();
    if (existing) {
      teamId.set(t.name, existing.id);
    } else {
      const { data: row } = await db
        .from("teams")
        .insert({ name: t.name, country_code: t.country })
        .select("id")
        .single()
        .throwOnError();
      teamId.set(t.name, row.id);
    }
  }

  // Drivers — lookup-or-insert by full_name.
  const driverId = new Map<string, number>();
  for (const e of seed.entries) {
    if (driverId.has(e.driver)) continue;
    const { data: existing } = await db
      .from("drivers")
      .select("id")
      .eq("full_name", e.driver)
      .maybeSingle()
      .throwOnError();
    const fields = {
      short_name: shortName(e.driver),
      country_code: e.driverCountry,
      avatar_url: avatarUrl(e.driver),
    };
    if (existing) {
      driverId.set(e.driver, existing.id);
      await db.from("drivers").update(fields).eq("id", existing.id).throwOnError();
    } else {
      const { data: row } = await db
        .from("drivers")
        .insert({ full_name: e.driver, ...fields })
        .select("id")
        .single()
        .throwOnError();
      driverId.set(e.driver, row.id);
    }
  }

  // Season entries — upsert on (season_id, driver_id).
  for (const e of seed.entries) {
    await db
      .from("season_entries")
      .upsert(
        {
          season_id: seasonId,
          driver_id: driverId.get(e.driver)!,
          team_id: teamId.get(e.team)!,
          car_number: e.carNumber,
          f1_partner_team: e.f1Partner,
          is_wildcard: e.isWildcard,
          rounds: parseRounds(e.rounds),
        },
        { onConflict: "season_id,driver_id" }
      )
      .throwOnError();
  }

  // Rounds + sessions.
  const roundId = new Map<number, number>();
  for (const r of seed.rounds) {
    const dates = r.dates
      .map((d) => parseDate(d, YEAR))
      .filter((d): d is string => !!d)
      .sort();
    const start = dates[0] ?? null;
    const end = dates[dates.length - 1] ?? null;
    const status = roundStatus(start, end);

    const { data: round } = await db
      .from("rounds")
      .upsert(
        {
          season_id: seasonId,
          round_number: r.roundNumber,
          country: r.country,
          circuit_name: r.circuit,
          date_start: start,
          date_end: end,
          status,
        },
        { onConflict: "season_id,round_number" }
      )
      .select("id")
      .single()
      .throwOnError();
    roundId.set(r.roundNumber, round.id);

    const types = r.threeRace
      ? ["qualifying", "race1", "race2", "race3"]
      : ["qualifying", "race1", "race2"];
    for (const session_type of types) {
      await db
        .from("sessions")
        .upsert(
          {
            round_id: round.id,
            session_type,
            status: status === "complete" ? "complete" : "upcoming",
          },
          { onConflict: "round_id,session_type" }
        )
        .throwOnError();
    }
  }

  // Round lock times (optional, provisional) — db/seed/lock-times-<year>.json.
  try {
    const lockFile = path.join(process.cwd(), "db", "seed", `lock-times-${YEAR}.json`);
    const { lockTimes } = JSON.parse(await readFile(lockFile, "utf8")) as {
      lockTimes: Record<string, string>;
    };
    let set = 0;
    for (const [rn, iso] of Object.entries(lockTimes)) {
      const rid = roundId.get(Number(rn));
      if (!rid) continue;
      await db.from("rounds").update({ lock_time: iso }).eq("id", rid).throwOnError();
      set++;
    }
    console.log(`Set ${set} round lock time(s).`);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      console.log("No lock-times file — skipping.");
    } else {
      throw e;
    }
  }

  // Driver prices (optional, provisional) — db/seed/prices-<year>.json.
  try {
    const priceFile = path.join(process.cwd(), "db", "seed", `prices-${YEAR}.json`);
    const priceData = JSON.parse(await readFile(priceFile, "utf8")) as {
      round: number;
      prices: Record<string, number>;
    };
    const rid = roundId.get(priceData.round);
    if (!rid) throw new Error(`prices reference round ${priceData.round}, not seeded`);
    let priced = 0;
    for (const [name, price] of Object.entries(priceData.prices)) {
      const did = driverId.get(name);
      if (!did) {
        console.warn(`  price for unknown driver "${name}" — skipped`);
        continue;
      }
      await db
        .from("driver_prices")
        .upsert(
          { round_id: rid, driver_id: did, price_millions: price },
          { onConflict: "round_id,driver_id" }
        )
        .throwOnError();
      priced++;
    }
    console.log(`Seeded ${priced} provisional prices for round ${priceData.round}.`);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      console.log("No prices file — skipping prices.");
    } else {
      throw e;
    }
  }

  // Summary
  const counts: Record<string, number> = {};
  for (const tbl of [
    "seasons", "teams", "drivers", "season_entries", "rounds", "sessions", "driver_prices",
  ] as const) {
    const { count } = await db.from(tbl).select("*", { count: "exact", head: true });
    counts[tbl] = count ?? 0;
  }
  console.log("Row counts:", counts);
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
