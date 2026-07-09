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
| `TRAFFIC-MAP.md` | Audited request map: what deadline hour hits, Next vs Supabase-direct, bottleneck predictions | ✅ done |
| `seed.ts` | Provisions N `loadtest+*` users with valid teams in **local** Supabase; `--purge` teardown | ⏳ Task 2 |
| `smoke.yaml` | 1 VU, 1 pass through the journey — validates scenario correctness before real load | ⏳ Task 3 (needs gridload M2) |
| `deadline-hour.yaml` | The flagship: spike profile, real endpoints, realistic think-times | ⏳ Task 3 (needs gridload M3) |

**Read `TRAFFIC-MAP.md` first** — it explains why the save hot path is a Next
Server Action (not a REST call) and how the scenarios stand in for it.

## Running a test end to end

```bash
# one-time local stack
supabase start                      # local Supabase (API gateway :54321)
pnpm build && pnpm start            # the app under test on :3000 — NOT `pnpm dev`
                                    # (dev mode measures Turbopack recompiles, not the app)

# seed load-test data into LOCAL supabase only
LOADTEST_PASSWORD=… npx tsx loadtest/seed.ts           # default 500 users

# validate the scenario is correct (1 user, 1 pass) — needs gridload ≥ v0.2.0
gridload run loadtest/smoke.yaml

# the real thing — needs gridload ≥ v0.3.0 (spike profile)
gridload run loadtest/deadline-hour.yaml --output results/$(date +%F-%H%M).json

# teardown
npx tsx loadtest/seed.ts --purge
```

Required env vars (never committed): `LOADTEST_PASSWORD`, and the local
Supabase keys printed by `supabase status` (`SUPABASE_ANON_KEY` /
`SERVICE_ROLE_KEY`).

## gridload milestone dependencies

The scenarios can't run until the engine supports what they use:

- `smoke.yaml` needs **M2** (scenarios + virtual users + capture/interpolation).
- `deadline-hour.yaml` needs **M3** (the `spike` load profile).

So the natural order is: audit + seed here (no engine dependency) → validate
`smoke.yaml` the day gridload tags v0.2.0 → run `deadline-hour.yaml` at v0.3.0.
See the gridload repo's briefing for engine milestones.
