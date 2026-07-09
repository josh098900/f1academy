# gridload — Project Briefing

**A load-testing tool in Go. First customer: Academy Fantasy.**

This document is the working brief for building `gridload` with Claude Code. Read it fully before writing code. It defines what we're building, what we're *not* building, the architecture, and a strict milestone sequence. Do not skip ahead in the milestone order.

---

## 1. What gridload is

`gridload` is a command-line HTTP load-testing tool, in the spirit of vegeta and k6, written in Go. It generates configurable load against an HTTP target and reports latency percentiles, throughput, and error rates.

It is a **general-purpose tool** that happens to have a first real-world customer: Academy Fantasy, a fantasy F1 Academy app (Next.js + Supabase) launching for the 2026 season. Fantasy sports traffic is spike-shaped — everyone hits the app in the hour before the lineup deadline on race weekends — so gridload's flagship use case is replaying "deadline hour" on demand against a staging environment.

**Repo:** `gridload` (standalone). Academy-Fantasy-specific scenario files live in the Academy Fantasy repo, *not* here. This repo ships the engine plus generic `examples/`.

## 2. What gridload is not (non-goals)

- Not a browser-automation tool. No JS execution, no rendering. HTTP only.
- Not a SaaS. No hosted dashboard, no accounts, no web UI (an HTML *report file* is fine).
- Not a k6 clone with a scripting language. Scenarios are declarative YAML, not code.
- Not distributed — until every prior milestone is done. Distributed mode is a stretch goal, explicitly last.
- Not a monitoring/APM tool. It measures from the client side only.

If a feature idea doesn't serve "generate load, measure the target's behaviour, report it clearly," it's out of scope.

## 3. Hard safety guardrails (build these in from Milestone 1)

1. **Host allowlist.** Every run requires the target host to appear in an `allowed_hosts` list (config file or `--allow-host` flag). If the target host isn't allowlisted, gridload refuses to run and explains why. There is no `--force` override.
2. **Localhost is implicitly allowed.** `localhost`, `127.0.0.1`, and `::1` never need allowlisting.
3. **Default rate ceiling.** A global cap (default 1,000 req/s) applies unless explicitly raised via `--max-rate`. Prevents fat-finger incidents.
4. **Never production Supabase.** Load tests run against a local Supabase stack (`supabase start`) or a dedicated staging project. This is an operational rule, but the README must state it prominently.

## 4. Two load models (know the difference)

gridload supports both of the standard load-generation models, introduced in different milestones:

**Open-loop (rate-based)** — "fire N requests per second on a fixed schedule, regardless of how fast responses come back." This is vegeta's model. It avoids *coordinated omission*: latency for each request is measured from its **scheduled** send time, so a slow target can't hide its slowness by slowing the test down. Milestone 1 builds this.

**Closed-loop (virtual users)** — "simulate N concurrent users, each performing a journey step-by-step with think-time between steps, looping for the test duration." This is k6's model and the natural fit for multi-step user journeys. Milestone 2 builds this.

The deadline-hour scenario uses the VU model; quick single-endpoint checks use the rate model.

## 5. Architecture

```
gridload/
├── cmd/
│   └── gridload/
│       └── main.go          # CLI entrypoint, flag/subcommand wiring
├── internal/
│   ├── attack/              # request execution: workers, pacing, cancellation
│   │   ├── attacker.go      # open-loop rate attacker
│   │   ├── vu.go            # closed-loop virtual-user runner (M2)
│   │   └── pacer.go         # schedules send times for a given profile
│   ├── scenario/            # YAML parsing + validation, journey model
│   ├── profile/             # load shapes: constant, ramp, spike, soak (M3)
│   ├── metrics/             # per-request results, HDR histogram, aggregation
│   ├── report/              # text summary, JSON output, HTML report (M4)
│   └── target/              # http.Client construction, headers, auth helpers
├── examples/                # generic sample scenarios (NOT Academy Fantasy's)
├── testdata/
├── go.mod
└── README.md
```

Design principles:

- **Everything flows through channels.** Workers emit a `Result` struct per request (`{scheduled, sent, done time.Time; code int; err error; bytes int64; step string}`) onto a results channel; a single collector goroutine owns the histogram. No shared mutable metrics state, no mutex soup.
- **`context.Context` everywhere.** Ctrl-C cancels cleanly mid-run and still prints a report for the data collected so far.
- **The pacer is the heart.** A `Pacer` interface answers "when should request #n be sent?" Constant rate is one implementation; ramp and spike profiles (M3) are just other implementations. Get this interface right in M1 and M3 becomes small.
- **Interfaces at the seams, structs everywhere else.** `Pacer`, `Reporter`, and `Profile` are interfaces. Don't pre-abstract anything else.

### Dependencies (keep this list short)

- `github.com/HdrHistogram/hdrhistogram-go` — latency recording (record in nanoseconds)
- `gopkg.in/yaml.v3` — scenario parsing
- Standard library for everything else in M1–M3. No cobra, no bubbletea yet — plain `flag` with subcommands is fine. Revisit only at M4 if the CLI genuinely hurts.

Go 1.22 or newer.

## 6. Milestones

Work strictly in order. Each milestone ends with: tests passing, README updated, a git tag (`v0.1.0`, `v0.2.0`, ...). **Do not begin milestone N+1 until milestone N is tagged.** If an exciting idea appears, add it to `IDEAS.md` and get back to the current milestone.

### M1 — Rate attacker (the weekend build) → v0.1.0

Single-endpoint, open-loop load testing from the CLI:

```
gridload attack --url http://localhost:3000/api/standings \
    --rate 100 --duration 30s --method GET
```

Scope:
- Constant-rate pacer scheduling sends at precise intervals
- Worker pool executing requests; results channel → collector → HDR histogram
- Latency measured from scheduled send time (coordinated-omission-safe)
- Text report: total requests, throughput, error rate, status-code breakdown, latency p50/p90/p95/p99/max, bytes transferred
- Host allowlist + rate ceiling guardrails
- `--output results.json` writes raw per-request results as JSON lines
- Graceful Ctrl-C: cancel via context, report on partial data

Acceptance: run it against a local `httptest`-style dummy server with injected latency and verify the reported percentiles match the injected distribution. Unit-test the pacer's scheduling math directly.

### M2 — Scenarios and virtual users → v0.2.0

Declarative multi-step journeys with a closed-loop VU engine:

```
gridload run examples/browse-and-post.yaml
```

Scope:
- YAML scenario format (spec in §7) with validation and helpful error messages
- VU runner: N goroutine "users" each looping through the journey with randomised think-time
- Variable capture and substitution: pull a value out of one response (JSON path), use it in a later request — enough to do login → authed requests
- Per-step metrics: the report breaks down latency and errors by journey step
- Environment variable interpolation in scenarios (`${API_KEY}`) so secrets never live in YAML

Acceptance: a scenario against a local dummy server that logs in, captures a token, and uses it in a second request; per-step percentiles reported correctly.

### M3 — Load profiles → v0.3.0

Shapes over time, as new `Pacer`/VU-scheduler implementations:

- `constant` — what M1/M2 already do
- `ramp` — linearly scale rate or VUs from A to B over the duration
- `spike` — baseline load, sharp jump to peak, hold, drop back (the deadline-hour shape)
- `soak` — moderate constant load for long durations; report should surface drift (compare first-10% vs last-10% latency)

Also: stages syntax in YAML (a list of `{duration, target}` steps) so arbitrary shapes compose.

Acceptance: unit tests asserting scheduled send-times/VU-counts for each profile shape; a spike run visibly produces the expected request-rate curve in the output.

### M4 — Reporting that tells a story → v0.4.0

- `gridload report results.json --html report.html`: self-contained HTML file with latency-over-time chart, RPS-over-time chart, latency histogram, per-step table. Inline JS/CSS, no external CDN needed to view it.
- Terminal output upgraded: live progress line during the run (current RPS, p95, error %), final summary table
- `--compare baseline.json` mode: diff two runs (before/after a fix) and print percentile deltas — this is the feature that turns runs into findings

### M5 (stretch, only if summer allows) — Distributed mode

Multiple worker machines coordinated by one controller, results streamed back and merged. **Do not design for this early.** No interfaces, no abstractions, no "just in case" hooks in M1–M4. If we get here, we design it then, fresh.

## 7. Scenario file spec (M2+)

```yaml
# examples/deadline-hour.yaml — shape of the format; Academy Fantasy's real
# version lives in that repo's loadtest/ folder.

target:
  base_url: http://localhost:3000
  allowed_hosts:
    - localhost
  default_headers:
    apikey: ${SUPABASE_ANON_KEY}

load:
  model: vus            # 'vus' or 'rate'
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
        token: $.access_token        # JSON path into the response body
      expect:
        status: 200

    - think: 1s-3s                    # uniform random think-time

    - name: fetch_prices
      request:
        method: GET
        path: /rest/v1/drivers?select=*
        headers:
          Authorization: Bearer ${token}
      expect:
        status: 200

    - think: 5s-15s                   # user is agonising over their lineup

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

Notes for the implementation:
- `${VU_ID}` is a built-in variable (the virtual user's index) — enables per-user test accounts.
- `expect.status` failing marks the request as an error in metrics but does **not** abort the VU's loop (real users retry); an `abort_on_fail: true` per-step flag can opt into stopping that VU's iteration.
- Unknown YAML keys should be a validation *error*, not silently ignored — typos in load configs are dangerous.

## 8. Testing strategy

- **The dummy target lives in `internal/testutil`:** an `httptest.Server` with configurable per-route latency distributions, error injection rates, and a request counter. Nearly every integration test uses it.
- **Pacer math gets pure unit tests** — given rate R and elapsed time T, assert exactly which request indices should have been sent.
- **Percentile sanity test** — inject a known latency distribution, assert reported p50/p95/p99 within tolerance.
- **Scenario parsing** — table-driven tests over `testdata/*.yaml`, including invalid files asserting the *quality* of error messages (they should name the field and line).
- Run everything with `-race`. The results-channel design should make this boring, which is the point.

## 9. Working agreement (read this, Future Josh)

- One milestone at a time. Tag it, then move on.
- New ideas go in `IDEAS.md`, not into the current branch.
- The definition of "done" for the summer is **M1–M4 plus one real finding** against a staging Academy Fantasy: a documented "before → bottleneck found → after" story in the README. That story is worth more than M5.
- If it's late August and M4 isn't done, ship what's tagged. Tagged and working beats ambitious and broken.

## 10. First session with Claude Code

Suggested opening moves, in order:

1. `go mod init github.com/<your-username>/gridload`, commit the skeleton directory layout from §5 with doc comments describing each package's responsibility.
2. Build `internal/testutil`'s dummy server first — you need something to shoot at before building the gun.
3. Implement the constant-rate `Pacer` with unit tests.
4. Implement the attacker worker pool + results collector, wire up the `attack` subcommand.
5. Text reporter. Run it against the dummy server. Celebrate.
