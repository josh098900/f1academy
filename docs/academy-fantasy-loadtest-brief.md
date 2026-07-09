# Academy Fantasy — Load Testing Brief (gridload companion)

**Audience:** Claude Code, working inside the `academy-fantasy` repo. You have not seen the gridload project — this document is self-contained. Read it fully before doing anything.

---

## 1. Context

`gridload` is a load-testing CLI written in Go, developed in a **separate repo** by the same developer (Josh). It fires configurable HTTP load at a target and reports latency percentiles, throughput, and error rates. Academy Fantasy is its first real customer.

The relationship between the projects: gridload is a generic engine, installed as a binary on Josh's machine. This repo owns the **target-specific scenario files** — declarative YAML descriptions of realistic user journeys — which live in `loadtest/` and are consumed by the external `gridload` command. No gridload code lives in this repo. The repos never depend on each other; the binary simply sends HTTP requests to the locally running app.

**Why this matters for Academy Fantasy specifically:** fantasy sports traffic is spike-shaped. On race weekends, most users pile in during the hour before the lineup deadline, all hitting the same few operations — log in, check driver prices, save/edit their team, view standings — and then traffic collapses. The goal of this work is to be able to replay "deadline hour" on demand against a local or staging environment, find the ceiling *before* the 2026 season starts, and fix whatever breaks.

## 2. Hard safety rules

1. **Never point a load test at production Supabase or a production deployment.** Targets are the local stack (`supabase start` + `npm run dev`) or a dedicated staging project only. This is non-negotiable — production load tests burn quota, trip abuse detection, and cost money.
2. Scenario files must never contain real user credentials or production keys. Secrets are referenced via environment variable interpolation (`${VAR_NAME}`), never inlined.
3. All load-test accounts are clearly namespaced (`loadtest+*@example.com`) so they can be identified and purged.

## 3. Task 1 — Endpoint audit (do this first)

Before any YAML is written, audit the codebase and produce `loadtest/TRAFFIC-MAP.md` answering, precisely:

**Which requests during a deadline-hour session go to the Next.js server, and which go directly to Supabase?** In a Next.js + Supabase app, client-side `supabase-js` calls bypass Next entirely and hit Supabase's own API (locally on its own port — typically `54321` for the API gateway). A load test aimed only at `localhost:3000` can miss the real bottleneck completely. For each user action below, trace the actual code path and document:

- Exact method + URL (including which base: Next server vs Supabase API), e.g. `POST http://localhost:54321/auth/v1/token?grant_type=password`
- Required headers (`apikey`, `Authorization: Bearer …`, content type)
- Request payload shape (real field names from the code, with example values)
- Response shape, and specifically which field a later request needs (e.g. `access_token`)
- Whether it's a PostgREST table query, an RPC, a Next API route, or a server action
- Any client-side caching that would reduce real-world request frequency

User actions to trace (adjust to what actually exists in the app):

1. Log in
2. Load the team-picker / driver prices view
3. Save or update a team lineup (the deadline-hour hot path — trace this one extra carefully, including any validation or budget-check queries it triggers)
4. View league/global standings
5. View a league page (if leagues exist)
6. Any polling or realtime subscriptions the client opens (note these — gridload speaks plain HTTP, so realtime channels are out of scope, but we should know what load they'd add)

Also flag in the traffic map: endpoints you suspect will be slow under load (unindexed filters, N+1 patterns, RPCs doing heavy aggregation), and any rate limiting already present (Supabase auth has built-in rate limits — login-heavy scenarios may need to reuse tokens rather than re-authenticating every iteration; note the limits you find).

## 4. Task 2 — Seed script

Create `loadtest/seed.ts` (or `.sql`, whichever fits the repo's tooling) that provisions a realistic load-test dataset in **local Supabase only**:

- N load-test users (default 500) with emails `loadtest+1@example.com` … `loadtest+N@example.com` and a single shared password read from `LOADTEST_PASSWORD` env var. Create them via the Supabase admin API / service role so they're confirmed and can log in immediately.
- Each user gets a plausible team/lineup within budget rules, so "edit team" journeys operate on real state rather than empty accounts.
- Enough surrounding data to make queries realistically expensive: a season's worth of race results, price history, and standings rows if those tables exist. **An empty database is fast; the slow queries only appear at realistic data volume.** Match the data model that actually exists in this repo.
- A teardown mode (`--purge`) that deletes everything namespaced to loadtest accounts.
- A guard: the script must refuse to run if the Supabase URL it's pointed at is not localhost/127.0.0.1 (or an explicitly allowlisted staging URL in an env var).

While writing this, verify RLS policies allow the load-test users to perform every step in the journey (save team, read standings, etc.). If a step would be blocked, document it in TRAFFIC-MAP.md — that's a finding, not an obstacle.

## 5. Task 3 — Scenario files

Create `loadtest/deadline-hour.yaml` (the flagship) plus a trivial `loadtest/smoke.yaml` (one VU, one loop through the journey — used to validate correctness before running real load). Use **exactly** this format; it's what gridload parses. Do not invent extra keys — unknown keys are a validation error.

```yaml
target:
  base_url: http://localhost:3000        # replace per TRAFFIC-MAP findings;
                                          # direct-to-Supabase steps may need
                                          # absolute URLs to the 54321 gateway
  allowed_hosts:
    - localhost
  default_headers:
    apikey: ${SUPABASE_ANON_KEY}

load:
  model: vus            # 'vus' (virtual users) or 'rate' (fixed req/s)
  profile: spike        # constant | ramp | spike | soak | stages
  baseline_vus: 20
  peak_vus: 400
  ramp_up: 30s          # how fast the spike hits
  hold: 5m              # time at peak
  total_duration: 10m

journey:
  name: deadline-hour-user
  steps:
    - name: login
      request:
        method: POST
        path: /auth/v1/token?grant_type=password
        json:
          email: loadtest+${VU_ID}@example.com
          password: ${LOADTEST_PASSWORD}
      capture:
        token: $.access_token          # JSON path into response body
      expect:
        status: 200

    - think: 1s-3s                      # uniform random think-time

    - name: fetch_prices
      request:
        method: GET
        path: /rest/v1/drivers?select=*
        headers:
          Authorization: Bearer ${token}
      expect:
        status: 200

    - think: 5s-15s                     # user agonising over their lineup

    - name: save_team
      request:
        method: POST
        path: /rest/v1/rpc/save_team
        headers:
          Authorization: Bearer ${token}
        json:
          drivers: [1, 4, 7, 12, 15]
      expect:
        status: [200, 201]

    - think: 2s-4s

    - name: view_standings
      request:
        method: GET
        path: /rest/v1/standings?select=*
      expect:
        status: 200
```

Format notes:

- `${VU_ID}` is a gridload built-in (the virtual user's index) — this is how each VU maps to its own seeded account.
- `${ANYTHING_ELSE}` interpolates from environment variables at run time.
- `capture` pulls a value from a response via JSON path for use in later steps.
- A failed `expect` marks the request as an error in metrics but does not stop the VU (real users retry). Add `abort_on_fail: true` on a step only where continuing makes no sense (e.g. login failed).
- **The paths, payloads, and captures above are placeholders.** Replace every step with the real requests discovered in Task 1 — real field names, real RPC names, real query strings. A scenario that doesn't match the actual API measures nothing.
- Keep think-times realistic; they control effective request rate per VU and are part of what makes the simulation honest.

## 6. Task 4 — Documentation

**`loadtest/README.md`** covering: what this folder is, the two-repo relationship (one paragraph), how to run a test end to end:

```
# one-time
supabase start
npm run dev
npx tsx loadtest/seed.ts            # seed 500 loadtest users

# validate the scenario is correct (1 user, 1 pass)
gridload run loadtest/smoke.yaml

# the real thing
gridload run loadtest/deadline-hour.yaml --output results/$(date +%F-%H%M).json
```

…plus the safety rules from §2 and a pointer to TRAFFIC-MAP.md.

**`CLAUDE.md` addition** — append this section (create the file if it doesn't exist):

```markdown
## Load testing (loadtest/)

This repo contains scenario configs for `gridload`, an external Go load-testing
CLI (separate repo, installed as a binary). The engine is generic; this folder
holds Academy-Fantasy-specific journeys.

- Scenarios ONLY ever target localhost or the designated staging project.
  Never production. No exceptions, including "just a quick check".
- Scenario YAML format is defined in loadtest/README.md — do not invent keys.
- loadtest/TRAFFIC-MAP.md documents which requests hit Next vs Supabase
  directly; keep it updated when API routes or supabase-js calls change.
- If you change an endpoint used in a scenario (path, payload, auth), update
  the corresponding step in the same PR.
- Seed/teardown: `npx tsx loadtest/seed.ts` / `--purge`. Load-test accounts
  are namespaced loadtest+*@example.com.
```

## 7. Deliverables checklist

- [ ] `loadtest/TRAFFIC-MAP.md` — audited request map, Next vs direct-to-Supabase, with exact paths/payloads and suspected bottlenecks
- [ ] `loadtest/seed.ts` with `--purge` and a localhost guard
- [ ] `loadtest/smoke.yaml` — 1 VU validation scenario using real endpoints
- [ ] `loadtest/deadline-hour.yaml` — spike profile, real endpoints, realistic think-times
- [ ] `loadtest/README.md` — how to run, safety rules
- [ ] `CLAUDE.md` updated with the load-testing section
- [ ] Any RLS or rate-limit blockers documented rather than worked around silently

Order matters: audit → seed → smoke → deadline-hour. Do not write deadline-hour.yaml before the traffic map exists.
