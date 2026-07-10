/**
 * loadtest/seed — provision (or purge) load-test data in LOCAL Supabase.
 *
 * Creates N confirmed users `loadtest+1@example.com` … `loadtest+N@example.com`
 * sharing one password, each with a valid team for the active round, plus
 * user_scores history so global_leaderboard does real aggregation work.
 *
 * SAFETY: refuses to run unless SUPABASE_URL is localhost/127.0.0.1/::1, or
 * exactly equals LOADTEST_ALLOW_URL (the designated staging project). Never
 * production — see loadtest/README.md.
 *
 * Run (local), after `supabase start` and `pnpm exec tsx scripts/seed.ts`:
 *   eval "$(pnpm exec supabase status -o env | sed 's/^/export /')" \
 *     && SUPABASE_URL=$API_URL SUPABASE_SERVICE_KEY=$SERVICE_ROLE_KEY \
 *        LOADTEST_PASSWORD=… pnpm exec tsx loadtest/seed.ts
 *
 * Teardown:  … pnpm exec tsx loadtest/seed.ts --purge
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, LOADTEST_PASSWORD,
 *      LOADTEST_USERS (default 500 — must be >= the scenario's peak_vus),
 *      LOADTEST_ALLOW_URL (optional staging allowlist).
 */
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../db/types";
import { BUDGET_CAP, SQUAD_SIZE } from "../lib/team-rules";

const WILDCARD_PRICE = 5;
const CONCURRENCY = 16;

const purge = process.argv.includes("--purge");
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;
const password = process.env.LOADTEST_PASSWORD;
const userCount = Number(process.env.LOADTEST_USERS ?? 500);

if (!url || !serviceKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_KEY.");
  process.exit(1);
}
if (!purge && !password) {
  console.error("Set LOADTEST_PASSWORD (the shared password for seeded users).");
  process.exit(1);
}

// --- Guard: localhost only, unless an explicit staging URL is allowlisted. ---
function assertSafeTarget(target: string): void {
  const allow = process.env.LOADTEST_ALLOW_URL;
  if (allow && target === allow) {
    console.warn(`⚠️  Targeting allowlisted staging: ${target}`);
    return;
  }
  const host = new URL(target).hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return;
  console.error(
    `\nREFUSING TO RUN.\n\n  SUPABASE_URL = ${target}\n\n` +
      `This script only targets a local Supabase stack. If this is the designated\n` +
      `staging project, set LOADTEST_ALLOW_URL to exactly that URL. Never point it\n` +
      `at production — see loadtest/README.md.\n`
  );
  process.exit(1);
}
assertSafeTarget(url);

const db = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = (i: number) => `loadtest+${i}@example.com`;
const isLoadtestEmail = (e: string | undefined) =>
  !!e && /^loadtest\+\d+@example\.com$/.test(e);

// Run `task` over `items` with bounded concurrency.
async function pool<T>(items: T[], task: (item: T) => Promise<void>) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await task(item);
    }
  });
  await Promise.all(workers);
}

// Every auth user whose email is namespaced to the load test.
async function listLoadtestUsers(): Promise<{ id: string; email: string }[]> {
  const found: { id: string; email: string }[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    if (data.users.length === 0) break;
    for (const u of data.users) {
      if (isLoadtestEmail(u.email)) found.push({ id: u.id, email: u.email! });
    }
    if (data.users.length < 1000) break;
  }
  return found;
}

async function doPurge() {
  const users = await listLoadtestUsers();
  if (users.length === 0) {
    console.log("Nothing to purge — no loadtest+*@example.com accounts.");
    return;
  }
  console.log(`Purging ${users.length} load-test account(s)…`);
  // public.users cascades from auth.users, and user_teams/user_scores cascade
  // from public.users — deleting the auth user removes everything.
  let done = 0;
  await pool(users, async (u) => {
    const { error } = await db.auth.admin.deleteUser(u.id);
    if (error) throw new Error(`${u.email}: ${error.message}`);
    if (++done % 100 === 0) console.log(`  …${done}/${users.length}`);
  });
  console.log(`Purged ${users.length} account(s) and their teams/scores.`);
}

type PricedDriver = { driverId: number; price: number };

// The active round is the earliest upcoming one — the same rule getActiveRound
// and the enforce_team_rules trigger use. Teams may only be saved for it.
async function getActiveRound(seasonId: number) {
  const { data } = await db
    .from("rounds")
    .select("id, round_number, lock_time")
    .eq("season_id", seasonId)
    .eq("status", "upcoming")
    .order("round_number", { ascending: true })
    .limit(1)
    .single()
    .throwOnError();
  return data;
}

// The trigger rejects any team containing a driver with no price for the round,
// so the active round MUST be priced before load-test teams exist. Reference
// data only prices past rounds, so carry the most recent priced round forward.
async function ensurePrices(
  seasonId: number,
  round: { id: number; round_number: number }
): Promise<PricedDriver[]> {
  const { data: existing } = await db
    .from("driver_prices")
    .select("driver_id, price_millions")
    .eq("round_id", round.id)
    .throwOnError();
  if (existing.length > 0) {
    return existing.map((p) => ({
      driverId: p.driver_id,
      price: Number(p.price_millions),
    }));
  }

  const { data: entries } = await db
    .from("season_entries")
    .select("driver_id, is_wildcard, rounds")
    .eq("season_id", seasonId)
    .throwOnError();
  const eligible = entries.filter(
    (e) => !e.is_wildcard || (e.rounds ?? []).includes(round.round_number)
  );

  // Most recent priced round before this one — realistic spread, not flat.
  const { data: priorRounds } = await db
    .from("rounds")
    .select("id, round_number")
    .eq("season_id", seasonId)
    .lt("round_number", round.round_number)
    .order("round_number", { ascending: false })
    .throwOnError();

  const priorPrice = new Map<number, number>();
  for (const prior of priorRounds) {
    const { data: prices } = await db
      .from("driver_prices")
      .select("driver_id, price_millions")
      .eq("round_id", prior.id)
      .throwOnError();
    if (prices.length > 0) {
      for (const p of prices) priorPrice.set(p.driver_id, Number(p.price_millions));
      break;
    }
  }

  const rows = eligible.map((e) => ({
    round_id: round.id,
    driver_id: e.driver_id,
    price_millions: priorPrice.get(e.driver_id) ?? WILDCARD_PRICE,
  }));
  await db.from("driver_prices").upsert(rows, { onConflict: "round_id,driver_id" }).throwOnError();
  console.log(`Priced round ${round.round_number}: ${rows.length} drivers (carried forward).`);
  return rows.map((r) => ({ driverId: r.driver_id, price: r.price_millions }));
}

// A deterministic, varied, BUDGET-VALID squad for user index `i`. Rotating the
// starting offset spreads picks across the grid so the load isn't 500 identical
// rows; the swap loop guarantees the £40M cap regardless of where it lands.
function pickTeam(pool: PricedDriver[], i: number): PricedDriver[] {
  const byPriceAsc = [...pool].sort((a, b) => a.price - b.price || a.driverId - b.driverId);
  const n = pool.length;
  const chosen: PricedDriver[] = [];
  for (let j = 0; chosen.length < SQUAD_SIZE && j < n * 2; j++) {
    const cand = pool[(i * 3 + j * 7) % n];
    if (!chosen.some((c) => c.driverId === cand.driverId)) chosen.push(cand);
  }
  const spend = () => chosen.reduce((sum, d) => sum + d.price, 0);
  // Swap the priciest for the cheapest unused until we're inside the cap.
  for (let guard = 0; spend() > BUDGET_CAP && guard < n; guard++) {
    chosen.sort((a, b) => b.price - a.price);
    const swap = byPriceAsc.find((c) => !chosen.some((x) => x.driverId === c.driverId));
    if (!swap) break;
    chosen[0] = swap;
  }
  if (chosen.length !== SQUAD_SIZE || spend() > BUDGET_CAP) {
    throw new Error(`Could not build a valid team for user ${i} (spend £${spend()}M)`);
  }
  return chosen;
}

async function doSeed() {
  const { data: season } = await db
    .from("seasons")
    .select("id, year")
    .eq("is_current", true)
    .single()
    .throwOnError();

  const round = await getActiveRound(season.id);
  const locked = round.lock_time && new Date(round.lock_time) <= new Date();
  if (locked) {
    console.error(
      `Active round ${round.round_number} is already locked (${round.lock_time}).\n` +
        `Team saves would be rejected by the enforce_team_rules trigger. Push the\n` +
        `lock_time into the future before load testing.`
    );
    process.exit(1);
  }

  const priced = await ensurePrices(season.id, round);
  if (priced.length < SQUAD_SIZE) {
    throw new Error(`Round ${round.round_number} has only ${priced.length} priced drivers.`);
  }

  // 1. Users — idempotent: only create the ones that don't exist yet.
  const existing = new Map((await listLoadtestUsers()).map((u) => [u.email, u.id]));
  const wanted = Array.from({ length: userCount }, (_, k) => k + 1); // 1-based: ${VU_ID}
  const missing = wanted.filter((i) => !existing.has(email(i)));
  console.log(
    `Users: ${existing.size} existing, creating ${missing.length} → ${userCount} total.`
  );

  let created = 0;
  await pool(missing, async (i) => {
    const { data, error } = await db.auth.admin.createUser({
      email: email(i),
      password,
      email_confirm: true, // confirmed → password grant works immediately
      user_metadata: { full_name: `Loadtest ${i}` }, // handle_new_user → display_name
    });
    if (error) throw new Error(`${email(i)}: ${error.message}`);
    existing.set(email(i), data.user.id);
    if (++created % 100 === 0) console.log(`  …created ${created}/${missing.length}`);
  });

  const ids = wanted.map((i) => ({ index: i, userId: existing.get(email(i))! }));

  // 2. Teams for the active round. The service role bypasses enforce_team_rules
  // (it only guards the `authenticated` role), but we build valid squads anyway
  // — the load test's own save step runs as a player and WILL hit the trigger.
  const teams = ids.map(({ index, userId }) => {
    const squad = pickTeam(priced, index);
    return {
      user_id: userId,
      round_id: round.id,
      driver_ids: squad.map((d) => d.driverId),
      boost_driver_id: squad[0].driverId,
      transfers_used: 0,
      wildcard_used: false,
    };
  });
  for (let i = 0; i < teams.length; i += 500) {
    await db
      .from("user_teams")
      .upsert(teams.slice(i, i + 500), { onConflict: "user_id,round_id" })
      .throwOnError();
  }
  console.log(`Teams: ${teams.length} saved for round ${round.round_number}.`);

  // 3. Scores for completed rounds — global_leaderboard ranks over these, so an
  // empty table would make the celebration run measure an empty aggregation.
  const { data: done } = await db
    .from("rounds")
    .select("id, round_number")
    .eq("season_id", season.id)
    .eq("status", "complete")
    .order("round_number", { ascending: true })
    .throwOnError();

  if (done.length > 0) {
    const scores: Database["public"]["Tables"]["user_scores"]["Insert"][] = [];
    for (const { index, userId } of ids) {
      let cumulative = 0;
      for (const r of done) {
        // Deterministic spread (~20–120) so ranking has real ordering to do.
        const points = 20 + ((index * 7 + r.round_number * 31) % 101);
        cumulative += points;
        scores.push({
          user_id: userId,
          round_id: r.id,
          round_points: points,
          cumulative_points: cumulative,
          transfer_penalty: 0,
        });
      }
    }
    for (let i = 0; i < scores.length; i += 500) {
      await db
        .from("user_scores")
        .upsert(scores.slice(i, i + 500), { onConflict: "user_id,round_id" })
        .throwOnError();
    }
    console.log(`Scores: ${scores.length} rows across ${done.length} completed round(s).`);
  } else {
    console.log("Scores: no completed rounds — leaderboard will be empty.");
  }

  // 4. Print the values the scenarios need. driver_ids/round_id are literals in
  // the YAML (gridload interpolates strings, not JSON integers), so they must
  // match the seeded database.
  const sample = pickTeam(priced, 1);
  const spend = sample.reduce((s, d) => s + d.price, 0);
  console.log(
    [
      "",
      "── Scenario values (loadtest/*.yaml must match) ──────────────",
      `  active round_id   : ${round.id}   (round ${round.round_number}, locks ${round.lock_time ?? "TBC"})`,
      `  valid driver_ids  : [${sample.map((d) => d.driverId).join(", ")}]`,
      `  boost_driver_id   : ${sample[0].driverId}`,
      `  squad cost        : £${spend.toFixed(1)}M / £${BUDGET_CAP}M`,
      `  accounts          : loadtest+1..${userCount}@example.com`,
      "──────────────────────────────────────────────────────────────",
    ].join("\n")
  );
}

async function main() {
  console.log(`${purge ? "Purging" : "Seeding"} load-test data → ${url}\n`);
  if (purge) await doPurge();
  else await doSeed();
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
