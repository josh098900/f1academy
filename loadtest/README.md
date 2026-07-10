# loadtest/ — Academy Fantasy load-test scenarios

Scenario configs and seed data for **gridload**, a general-purpose HTTP
load-testing CLI written in Go that lives in its **own separate repo** and is
installed as a binary. The engine is generic; this folder holds only the
Academy-Fantasy-specific pieces — the traffic audit, the seed script, and the
journey scenarios — because they're tightly coupled to *this* app's endpoints,
schema, and RLS. No gridload code lives here; the two repos never depend on each
other. The binary simply sends HTTP requests at the locally running app.

## ⚠️ Safety rules (non-negotiable)

1. **Never point a load test at production** — not the production Supabase
   project, not the Vercel deployment. Targets are the **local stack**
   (`supabase start` + a local `pnpm start`) or a dedicated **staging** project
   only. Production load burns quota, trips abuse detection, and costs money.
   There is no "just a quick check" exception.
2. **No secrets in scenario files.** Credentials and keys are referenced with
   `${VAR_NAME}` env interpolation, never inlined.
3. **Load-test accounts are namespaced** `loadtest+*@example.com` so they can be
   identified and purged. `seed.ts --purge` removes them.

The seed script additionally refuses to run against any Supabase URL that isn't
localhost/127.0.0.1 (or an explicitly allowlisted staging URL).

## What's here

| File | Purpose | Status |
|---|---|---|
| `TRAFFIC-MAP.md` | Audited request map: what deadline hour hits, Next vs Supabase-direct, bottleneck predictions, verified results | ✅ done |
| `seed.ts` | Provisions N `loadtest+*` users with valid teams + score history in **local** Supabase; `--purge` teardown | ✅ done |
| `smoke.yaml` | 1 VU, 1 pass through the journey — validates scenario correctness before real load | ✅ passing |
| `deadline-hour.yaml` | The flagship: spike profile, real endpoints, realistic think-times | ✅ runs (gridload ≥ v0.3.0) |
| `results/` | gridload `--output` artifacts. Gitignored — large and machine-specific | — |

**Read `TRAFFIC-MAP.md` first** — it explains why the save hot path is a Next
Server Action (not a REST call), how the scenarios stand in for it, and what has
actually been measured.

## Two things that will bite you

1. **The scenarios contain literal `round_id` and `driver_ids`.** gridload
   interpolates strings, not JSON integers, so these can't be `${VARS}`. They
   must match the seeded database — `seed.ts` prints the correct values at the
   end of every run. Re-seed after `supabase db reset` and check them.
2. **`supabase/config.toml` raises the auth `sign_in_sign_ups` limit.** The
   spike fires ~380 logins from one IP in 30s; the stock limit is 30 per 5
   minutes. Without the raise the run measures Supabase's rate limiter. A pile
   of `429`s on the `login` step is the tell.

## Running a test end to end

```bash
# 1. local stack + schema + reference data (drivers, rounds, prices)
pnpm exec supabase start                    # API gateway on :54321
pnpm exec supabase db reset                 # applies every migration to a blank db
eval "$(pnpm exec supabase status -o env | sed 's/^/export /')"
SUPABASE_URL=$API_URL SUPABASE_SERVICE_KEY=$SERVICE_ROLE_KEY \
  pnpm exec tsx scripts/seed.ts             # seasons, drivers, rounds, sessions

# 2. load-test data: 500 players, teams for the active round, score history
SUPABASE_URL=$API_URL SUPABASE_SERVICE_KEY=$SERVICE_ROLE_KEY \
  LOADTEST_PASSWORD=… pnpm exec tsx loadtest/seed.ts
#    ^ prints the round_id / driver_ids the scenarios must use

# 3. env for gridload
export SUPABASE_ANON_KEY=$PUBLISHABLE_KEY   # legacy $ANON_KEY works too
export LOADTEST_PASSWORD=…

# 4. validate the journey is correct (1 user, 1 pass) — ALWAYS before load
gridload run loadtest/smoke.yaml

# 5. the real thing
gridload run loadtest/deadline-hour.yaml \
  --output loadtest/results/$(date +%F-%H%M).jsonl

# 6. read it back, or diff two runs
gridload report loadtest/results/<run>.jsonl --html report.html
gridload report after.jsonl --compare before.jsonl

# teardown
SUPABASE_URL=$API_URL SUPABASE_SERVICE_KEY=$SERVICE_ROLE_KEY \
  pnpm exec tsx loadtest/seed.ts --purge
```

The Next.js app only needs to be running (`pnpm build && pnpm start`, **never
`pnpm dev`** — dev mode measures Turbopack recompiles) if a scenario targets
`:3000`. The current scenarios go straight to Supabase, so they don't need it.

Required env (never committed): `LOADTEST_PASSWORD`, plus the local keys from
`supabase status`.

## gridload versions

- `smoke.yaml` needs **v0.2.0** (scenarios, VUs, capture/interpolation).
- `deadline-hour.yaml` needs **v0.3.0** (the `spike` profile).
- `gridload report --html` / `--compare` need **v0.4.0**. Result files written
  by older binaries record only transport errors, so `expect` failures re-read
  as successes — re-run any baseline you intend to keep on v0.4.0.

`gridload report --compare` diffs percentiles between two runs. It is only
meaningful **between runs at the same rate on the same machine** — see the CPU
frequency-scaling caution in `TRAFFIC-MAP.md`.
