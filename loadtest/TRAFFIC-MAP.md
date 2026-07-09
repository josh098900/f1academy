# Traffic map — Academy Fantasy deadline hour

Task 1 of the load-testing brief: trace what a deadline-hour session actually
does over the wire, so the gridload scenarios measure the real system and not a
strawman. Audited against the codebase on 2026-07-09. **Keep this current when
API routes, server actions, or supabase-js calls change** (CLAUDE.md rule).

---

## TL;DR — the two findings that shape everything

**1. This app is server-heavy, which inverts the brief's default assumption.**
The brief warns that in a typical Next + Supabase app the browser talks to
Supabase directly, so a test aimed only at `:3000` misses the real load. Academy
Fantasy is the opposite: **almost every read is a Next.js Server Component and
the team save is a Next Server Action.** The only things the browser sends
straight to Supabase are (a) login and (b) a realtime WebSocket. So most
deadline-hour load lands on the Next server at `:3000`, which then talks to
Postgres server-side.

**2. The hot path — saving a team — is a Next Server Action, not a REST call.**
`saveTeam` is invoked as `onSave={saveTeam}` inside a `startTransition`
([team page](../app/(app)/team/page.tsx#L118), [TeamPicker](../components/team/TeamPicker.tsx#L106)).
Over the wire that is a `POST /team` carrying a `Next-Action: <hash>` header and
an RSC-encoded body, authenticated by the **session cookie** — not a clean JSON
endpoint with a Bearer token. The action id is a build-time hash and the body
is an internal serialization format, so **it is not cleanly replayable by a
plain HTTP tool like gridload.** This is the single most important fact for
scenario design; §5 lays out the options.

Consequence: gridload can honestly load-test two layers — the **direct-to-
Supabase** surface (login, RPCs, and a direct `user_teams` write that exercises
the same DB trigger the real save hits) and the **Next server read** surface
(GET pages). The Next server-action *overhead itself* needs a deliberate choice
to measure (§5).

---

## Layers and base URLs

Local Supabase puts Auth, PostgREST, and Realtime behind one API gateway.

| Layer | Base URL | Auth | gridload fit |
|---|---|---|---|
| **1. Supabase direct** | `http://localhost:54321` | `apikey` header + `Authorization: Bearer <token>` | Clean HTTP — ideal |
| **2. Next server (reads)** | `http://localhost:3000` | **session cookie** (`sb-<ref>-auth-token`) | Doable; needs cookie setup (§4) |
| **3. Next server action (save)** | `http://localhost:3000/team` | session cookie + `Next-Action` header + RSC body | Not cleanly replayable (§5) |
| **Realtime** | `ws://localhost:54321/realtime/v1` | WebSocket | **Out of scope** — gridload is HTTP only (§6) |

Ports come from [supabase/config.toml](../supabase/config.toml): API gateway
`54321`, app dev/start on `3000`.

---

## Per-action trace

### 1. Log in — Supabase direct (Layer 1)

The UI only offers **Google OAuth** (`signInWithOAuth`) and **magic link**
(`signInWithOtp`) — [login page](../app/login/page.tsx#L45). **Neither is
replayable over plain HTTP** (OAuth needs a browser+Google; magic link needs an
inbox). This is by design, not a gap.

For load testing, seeded users get a password (see `seed.ts`, Task 2), and we
use Supabase's password grant, which is always available on the Auth server
regardless of what the UI exposes:

```
POST http://localhost:54321/auth/v1/token?grant_type=password
Headers: apikey: <SUPABASE_ANON/PUBLISHABLE_KEY>, Content-Type: application/json
Body:    { "email": "loadtest+${VU_ID}@example.com", "password": "${LOADTEST_PASSWORD}" }
→ 200 { "access_token": "<JWT>", "refresh_token": "...", "expires_in": 3600, ... }
```

Capture `access_token` ($.access_token). It's a `authenticated`-role JWT good
for ~1h — longer than any test run, so **log in once per VU and reuse the token**
for the whole iteration (see rate limits, §7).

### 2. Load the team picker / driver prices — Next server (Layer 2)

`GET http://localhost:3000/team` — a Server Component
([team page](../app/(app)/team/page.tsx)). Server-side it runs, in parallel:
`getRoundLineupCached`, `getSeasonFormCached` (both **data-cached** since the
perf pass — usually no DB hit), plus `getUserTeam`, `getTransferContext`,
`getCoachEnabled` (per-user, **uncached** — real DB reads). Returns HTML/RSC.
Auth is the session cookie; without it the page redirects to `/login`.

The driver prices themselves are baked into that page render — there is no
separate `/rest/v1/drivers` fetch from the browser (unlike the brief's
placeholder). `GET /drivers` is the analogous public grid page.

### 3. Save / update a team — the hot path (Layer 3, see §5)

Real path: `saveTeam` server action
([actions.ts](../app/(app)/team/actions.ts#L22)). Server-side it:
`getUser()` → `getActiveRound` → lock check → `getRoundLineup` (cached) →
`validateTeam` → `getTransferContext` + `getUserTeam` → `resolveWildcard` →
`countTransfers` → **`upsert` into `user_teams`**, which fires the
`enforce_team_rules` **DB trigger** (ownership, active-round, distinct-4,
budget, eligibility, transfers recompute, wildcard). Then `revalidatePath`.

The database write + trigger is the part most likely to bottleneck under 400
concurrent savers, and it is reachable directly (§5, Layer-1 proxy):

```
POST http://localhost:54321/rest/v1/user_teams?on_conflict=user_id,round_id
Headers: apikey: <KEY>, Authorization: Bearer <token>,
         Content-Type: application/json, Prefer: resolution=merge-duplicates
Body: { "user_id": "<VU's uuid>", "round_id": <active>, "driver_ids": [.,.,.,.],
        "boost_driver_id": <one of them>, "wildcard_used": false }
→ 201 (trigger recomputes transfers_used and validates)
```

The team must be **valid for the seeded prices** (4 distinct, priced, ≤ £40M,
boost in team) or the trigger returns an error — so the seed script and the
scenario payload are coupled (the seed decides which `driver_ids` are legal).

### 4. View global standings — Next server + RPC (Layer 2)

`GET http://localhost:3000/leaderboard` — Server Component
([leaderboard page](../app/(app)/leaderboard/page.tsx)) calling the
`global_leaderboard(p_limit)` SECURITY DEFINER RPC (granted to `anon` +
`authenticated`). Mounts `<RealtimeRefresh>` (§6).

The RPC can also be hit directly as a Layer-1 proxy for its DB cost:
`POST http://localhost:54321/rest/v1/rpc/global_leaderboard` with
`{ "p_limit": 100 }` and a Bearer token.

### 5. View a league page — Next server + RPC (Layer 2)

`GET http://localhost:3000/leagues/<id>` — Server Component
([league page](../app/(app)/leagues/[leagueId]/page.tsx)): `getLeague`
(PostgREST select, RLS-scoped to members) + `league_standings(p_league)` RPC
(granted **`authenticated` only**). Non-members get `notFound()`. Also mounts
`<RealtimeRefresh>`.

### 6. Realtime — out of gridload scope, but note the load

Every leaderboard/league page mounts `<RealtimeRefresh>`
([component](../components/RealtimeRefresh.tsx)), which opens a **WebSocket** to
`ws://localhost:54321/realtime/v1` and subscribes to `postgres_changes` on
`user_scores`. gridload speaks plain HTTP, so **this is not simulated.** Worth
recording: at true deadline-hour peak, ~400 concurrent users on those pages
means ~400 live WebSocket connections to Supabase Realtime — a real resource
cost the HTTP test will *not* surface. Deadline hour is pre-lock and pre-scoring
so these channels are mostly idle (no `user_scores` writes until Monday
scoring), but the connection count itself is the load. Flagged, not tested.

---

## Auth model — cookies, not Bearer (important for Layer 2)

The Next server reads the session from a **cookie** via `@supabase/ssr`
(`sb-<project-ref>-auth-token`, base64-chunked), never an `Authorization`
header. So to drive Layer 2 (GET pages) gridload must present that cookie, not a
Bearer token. Two ways:

- **Preferred:** run the password grant, then format the token pair into the
  `sb-<ref>-auth-token` cookie value `@supabase/ssr` expects, and send it as a
  `Cookie` header on the `:3000` requests. The gridload session/cookie-jar
  feature (engine M2) should capture and resend cookies; document the exact
  cookie name/shape once we confirm it against a real login in the browser
  devtools.
- **Simpler fallback:** point the deadline-hour flagship mostly at **Layer 1**
  (Bearer, no cookie gymnastics), and cover Layer 2 with a smaller GET-only
  scenario. Layer 1 is where the bottleneck risk lives anyway.

---

## Bottleneck predictions (post-perf-pass)

The July perf pass changed the target materially — factor it in:

- **Shared reads are data-cached** (`getActiveRoundCached`, `getRoundLineupCached`,
  `getSeasonFormCached`). Round/lineup/prices/form are served from Next's cache
  and mostly **do not hit Postgres** under load. Don't expect these to be the
  ceiling; if they show as slow, the cache isn't working.
- **Per-user reads are uncached:** `getUserTeam`, `getTransferContext` on every
  `/team` load. These hit `user_teams` (indexed on `user_id`, `round_id`) — fast
  individually, but they're the read load that scales with concurrency.
- **The save hot path is the prime suspect.** Each save = an upsert **plus** the
  `enforce_team_rules` trigger doing several `SELECT`s (rounds, driver_prices,
  prior user_teams). Under 400 concurrent savers on one round, watch for
  row-lock contention on the conflicting `(user_id, round_id)` upsert and the
  trigger's repeated reads. **This is the experiment worth running first.**
- **RPC aggregation:** `global_leaderboard` / `league_standings` do ranking
  aggregation. Cheap at 27 users; re-check at seeded 500.

## Rate limits — the login burst will trip Auth unless we raise the local limit

Verified in [config.toml](../supabase/config.toml) `[auth.rate_limit]`:

| Limit | Default | Scope | Hit by us? |
|---|---|---|---|
| `sign_in_sign_ups` | **30 / 5 min** | **per IP address** | **YES — badly** |
| `token_refresh` | 150 / 5 min | per IP address | No |

**The problem.** Even with each VU logging in exactly once, gridload's spike
ramps 20 → 400 VUs in 30s, so ~380 token requests land inside one 30-second
window. Against a 30-per-5-minutes limit that's ~12× over. The run would
measure Supabase's rate limiter, not Academy Fantasy.

**Why raising the limit is correct, not cheating.** The limit is **per IP
address**. At a real deadline hour, 400 users log in from ~400 different IPs —
one login each — and nobody comes close to 30/5min. Our load generator is a
single host, so all 400 logins share one IP. **The limiter is an artifact of
load-testing from one machine, not a constraint real traffic would meet.**
Leaving it in place would mask the bottleneck we're actually hunting (the save
trigger under contention).

**Mitigation, in order of preference:**

1. **Local:** raise `sign_in_sign_ups` in `supabase/config.toml` (done — set to
   1000, with a comment explaining why). Applies on the next `supabase start`.
2. **Staging (real Supabase project):** `config.toml` doesn't apply. Raise it in
   the dashboard under Auth → Rate Limits before any run, or pre-mint tokens
   out-of-band and skip the login step.
3. Watch for `429` in gridload's status-code breakdown regardless — it's the
   tell that a limiter, not the app, is what we measured.

**Consequences to state plainly:** this deliberately means our load test does
*not* exercise Supabase Auth's anti-abuse limiting. That's intentional and
correct for this experiment. Token refresh is never hit (tokens last ~1h, runs
are ≤10m). PostgREST and Next have no built-in per-user limiter locally, so the
read/save steps are unthrottled — which is what we want.

**VU identity note (gridload v0.3.0):** `${VU_ID}` is 1-based and IDs stay dense
— at target `n`, exactly VUs 1..n run, and ramp-down retires the highest IDs
first. So seed **at least `peak_vus`** accounts (400 for deadline-hour; the seed
default of 500 covers it) and every VU that logs in will find its account.

## RLS check for load-test users

Every deadline-hour step is permitted for a seeded `authenticated` user:
login (confirmed via admin createUser), read own `/team` (own-row RLS), save
(insert/update policy `auth.uid() = user_id` + trigger), read `/leaderboard`
(RPC granted to authenticated), read a league they've joined. **No RLS blocker.**
Note the recent pre-lock privacy change means a VU cannot read *another* VU's
team before lock — irrelevant here, since no journey step does that.

---

## How the save is represented (resolved 2026-07-09)

The real save is a hard-to-replay server action, so the flagship stands in for
it. **Decision: A now, B later.**

- **A — Direct `user_teams` upsert (Layer 1). ← flagship uses this.** Stable, and
  it exercises the exact DB trigger + row that the real save bottlenecks on — the
  true ceiling. Bypasses Next server-action overhead (framing/validation TS),
  which is cheap relative to the DB anyway. `deadline-hour.yaml`'s `save_team`
  step is the PostgREST upsert shown in §3.
- **B — Thin JSON API route** (`app/api/loadtest/save-team/route.ts`) mirroring
  `saveTeam`, Bearer-callable, guarded off in production. **Deferred** — add only
  if we later want to attribute latency to the Next layer specifically, once the
  DB ceiling from A is known.
- **C — Replay the captured server-action POST.** Rejected: the `Next-Action`
  hash changes every build and the RSC body is internal. Too fragile.

So the flagship measures the database ceiling first (the prime suspect); the
Next-layer attribution is a follow-up experiment, not a launch blocker.
