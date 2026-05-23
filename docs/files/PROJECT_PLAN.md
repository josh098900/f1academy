# Project Plan

> Phased delivery aiming at a **Round 3 (Silverstone, 3–5 July 2026) launch**. ~6 weeks from now (today is 22 May 2026).

## Phase overview

| Phase | Duration | Goal | Definition of done |
|---|---|---|---|
| **0. Foundation** | Days 1–3 | Project scaffolded, deployed, "Hello World" live | URL loads on Vercel, Supabase connected, auth works |
| **1. Data model & seed** | Days 4–7 | DB schema in place, current season seeded | All drivers/teams/calendar for 2026 in DB |
| **2. Team selection** | Days 8–14 | User can pick a team within budget | Can pick 4 drivers + boost, save, see locked state |
| **3. Scoring engine** | Days 15–19 | Admin can enter results, scoring runs | Round 1 (Shanghai) and Round 2 (Montreal) results entered + scored as historical |
| **4. Leagues & leaderboards** | Days 20–25 | Mini-leagues work end-to-end | Two test users can create + join a league, see standings |
| **5. Claude Coach** | Days 26–32 | AI insights live | Pre-race + post-race insights generate, cache, display |
| **6. Polish & accessibility** | Days 33–38 | Mobile UX tight, a11y audit clean | Lighthouse > 90, axe a11y issues zero |
| **7. Soft launch** | Days 39–42 | Invite 10–20 friends to play Silverstone | First real round of live play |

Total: **42 days = 6 weeks**. Lines up with Silverstone weekend.

## Phase 0: Foundation (Days 1–3)

**Tasks**
- [ ] Create GitHub repo (private initially; flip public at launch)
- [ ] `pnpm create next-app` with TypeScript, Tailwind, App Router
- [ ] Install shadcn/ui base components
- [ ] Set up Supabase project (UK/EU region)
- [ ] Wire `@supabase/ssr` client; auth flow with email magic link + Google
- [ ] Deploy to Vercel (preview + production)
- [ ] Set up Sentry, basic error boundary
- [ ] Add `LICENSE` (MIT), `README`, the 6 planning docs in `/docs`
- [ ] Add CI: typecheck + lint on PR

**Definition of done:** push to main, deploys, sign in with Google works, hits the dashboard placeholder.

## Phase 1: Data model & seed (Days 4–7)

**Tasks**
- [ ] Write Supabase migrations for all tables in `ARCHITECTURE.md`
- [ ] Enable RLS on every user-data table; write policies; test with anon vs authed clients
- [ ] Seed `seasons`, `teams`, `rounds` for 2026
- [ ] Seed `drivers` and `season_entries` for 2026 — start with manual SQL from the Wikipedia 2026 page
- [ ] Generate driver avatars via DiceBear, store in Supabase Storage or pull at runtime
- [ ] Seed `driver_prices` for Round 3 (Silverstone) — based on Rounds 1–2 results
- [ ] Set up Supabase TypeScript type generation

**Definition of done:** `SELECT * FROM drivers` returns all 17 drivers with prices, avatars, F1 partner teams. `SELECT * FROM rounds` returns the 6 round schedule.

## Phase 2: Team selection UX (Days 8–14)

**Tasks**
- [ ] Driver browse page: grid of `DriverCard`s with photo, name, team, price, recent form
- [ ] `TeamPicker` component with budget bar, slot indicators (4 drivers + boost), live validation
- [ ] Server action: `saveTeam` (validates budget + 4-driver constraint + boost-in-team)
- [ ] Lock timer countdown component
- [ ] Locked state UI: shows your team, points (not yet scored), no edits allowed
- [ ] Transfers UI: free + paid transfer mechanics
- [ ] Wildcard chip button + confirmation modal
- [ ] Tests: scoring-engine-relevant invariants (budget, slot counts) tested with Vitest

**Definition of done:** A test user can sign in, pick 4 drivers under £40M, designate a boost, save, see locked state when lock_time passes. Transfers and wildcard work.

## Phase 3: Scoring engine (Days 15–19)

**Tasks**
- [ ] Pure scoring functions in `lib/scoring/` with golden-case tests
- [ ] Admin UI: enter session results with drag-and-drop or position input
- [ ] Admin action: `scoreRound` — iterates all `user_teams` for the round, computes scores, writes `user_scores`
- [ ] Idempotent re-run support (delete + recompute, log audit trail)
- [ ] Edge cases: DNF, DSQ, DNS, fastest lap, positions gained, podium streak, pole+win
- [ ] Backfill: enter Round 1 (Shanghai) and Round 2 (Montreal) historical results

**Definition of done:** Admin enters fictional Round 3 results, hits "Score", every user with a saved team has a `user_scores` row with a sensible breakdown. Tests cover the worked example from `SCORING_SYSTEM.md`.

## Phase 4: Leagues & leaderboards (Days 20–25)

**Tasks**
- [ ] Create league flow: name + invite code generation (6-char, collision-free)
- [ ] Join league flow: enter code, validate, add to `league_members`
- [ ] League view: standings table, gap to leader, "biggest mover this round"
- [ ] Global leaderboard: top 100 + your position
- [ ] Realtime: subscribe to `user_scores` changes for live leaderboard updates
- [ ] Email reminder: 24h before round lock, send "Pick your team!" via Resend
- [ ] Leave league flow

**Definition of done:** Two test accounts can: account A creates a league → shares code → account B joins → both see each other in the standings. Realtime updates when admin re-runs scoring.

## Phase 5: Claude Coach (Days 26–32)

**Tasks**
- [ ] Anthropic SDK setup in `lib/coach/`
- [ ] Prompt templates for each insight type:
  - Pre-race: takes round metadata, current standings, recent form per driver → returns 2–3 picks worth considering
  - Post-race: takes user's team, round results, user's score → returns personal recap
  - Driver take: takes driver metadata, recent results, F1 partner news → returns paragraph
- [ ] Caching layer: write to `coach_insights`, read first
- [ ] Rate limiting: max 5 Coach calls per user per 10 minutes
- [ ] UI: Coach drawer/page with insights, clear "AI-generated" badge
- [ ] Cost monitoring: log token usage per call; alerting if monthly spend > £10

**Definition of done:** User on dashboard sees a pre-race "Coach's take" before Silverstone. Post-Silverstone, sees personalised recap. Driver detail page shows Coach's take on that driver. All clearly labelled AI.

## Phase 6: Polish & a11y (Days 33–38)

**Tasks**
- [ ] Mobile UX pass on every screen — thumb-zone reachable, no horizontal scroll
- [ ] axe a11y audit: zero serious issues
- [ ] Lighthouse: > 90 on Performance, Accessibility, Best Practices, SEO
- [ ] Empty states and error states on every screen
- [ ] Loading skeletons
- [ ] Onboarding flow (3 screens + disclaimer ack)
- [ ] Privacy notice + cookie banner
- [ ] Account deletion (GDPR)
- [ ] Terms of Service page (short, plain English)
- [ ] Trademark notice in footer
- [ ] Favicon + OG image + meta tags
- [ ] About page mentioning Wikipedia attribution

**Definition of done:** Lighthouse > 90, a11y clean, polished on iPhone SE through to iPad Pro.

## Phase 7: Soft launch (Days 39–42)

**Tasks**
- [ ] Pre-Silverstone: invite 10–20 friends, Discord, university course-mates
- [ ] Watch what they break
- [ ] Hotfix
- [ ] Silverstone weekend (3–5 July): live use!
- [ ] Enter Silverstone results immediately post-race
- [ ] Run scoring + Coach for first real round
- [ ] Collect feedback
- [ ] Tweet about it / post on LinkedIn / start the public narrative

**Definition of done:** 20+ real users played Silverstone, the scoring engine ran cleanly, no major bugs surfaced, you have anecdotes to talk about in any future Anthropic conversation.

## Post-launch (Rounds 4–6)

The remaining 2026 calendar (Zandvoort Aug, Austin Oct, Vegas Nov) gives three more rounds of live use before the season ends. Use those to:

- Watch what's actually used vs. not
- Tune scoring (probably needed)
- Decide whether to flip Wikipedia from "verifier" to "primary" data source (v2)
- Build the case study / portfolio writeup
- Consider reaching out to F1 Academy for an official conversation (Phase 4 of Legal doc)

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Round 3 launch slips → miss live season window | Cut Coach feature, ship without; add Coach as Round 4 launch |
| Wikipedia not yet updated post-Silverstone → can't verify | Manual entry is the v1 plan anyway; Wikipedia is bonus |
| No users sign up | OK for portfolio — Anthropic recruiter cares about quality of build, not user count |
| Anthropic spend spikes from a bot | Rate limiting + per-user cap + monthly cost alert |
| Tracking from racing community ("you copying f1 fantasy") | App clearly different in scope; legal posture clean |
| Burnout — 6 weeks is tight alongside final year | Each phase is independently shippable; if Phase 5 slips, you still have a working app at Phase 4 |

## Anti-goals (things we will NOT do during this 6 weeks)

- Native mobile apps
- Push notifications
- Web push
- A custom design system (use shadcn)
- A custom auth system (use Supabase)
- A custom Postgres (use Supabase)
- Driver pricing changes mid-round
- Live in-race scoring
- Social sharing features
- Custom analytics (use Vercel Analytics)

Anything not listed in the phase checklists above is out of scope.
