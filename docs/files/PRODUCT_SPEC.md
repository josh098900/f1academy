# Product Spec

> What ships in v1. Everything beyond this is a follow-up release.

## Core loop

1. User signs up → picks their team for the upcoming race weekend (within budget cap)
2. Race weekend happens → admin enters results → scoring engine runs
3. User sees their points, their ranking, and AI commentary from Claude Coach
4. User makes one free transfer for the next round → loops back to step 1

The loop must feel rewarding every race weekend. Six rounds per season = six high-engagement moments. We design for that cadence.

## v1 features (must ship)

### Onboarding
- Email or Google sign-in via Supabase Auth
- Brief 3-screen intro: "Pick a team", "Score points", "Compete with friends"
- "No real money" disclaimer on the final intro screen — acknowledged before account is created

### Team selection
- Browse all current-season F1 Academy drivers (17 in 2026)
- Each driver has a **price** (between £4M and £15M, calibrated by past results — see SCORING_SYSTEM.md)
- User picks **4 drivers** within a **£40M budget cap**
- User picks **1 boost driver** (gets 2× points that round) — chosen from the 4 picks
- Team is locked at the start of Qualifying for that round
- Pre-lock state shows clearly: "Locks in 2d 4h 12m"

### Mini-leagues
- Every user gets a global ranking by default
- User can create a private league → gets a 6-character invite code → shares with friends
- A user can join up to 5 private leagues
- League view: ranking, gap to leader, recent movers
- "Head-to-head" stat between friends (who's ahead overall)

### Scoring & results
- After race weekend, admin enters results in admin panel
- Scoring engine runs, points appear on user dashboards
- Race-by-race breakdown of how each driver scored (Quali / Race 1 / Race 2 / FL / OT)
- Season-long points trend chart (Recharts)

### Claude Coach (the AI angle)
- Pre-race: "Here's my read on this weekend" — Claude analyses recent form, track history, F1 team partner news. Surfaces 2–3 picks worth considering.
- Post-race: "What happened" — short narrative recap of where you gained/lost points vs the field
- Driver detail page: "Coach's take on [driver name]" — paragraph blending recent results, track suitability, and team context
- All Claude responses **labelled clearly as AI-generated**. No fake authority.

### Transfers
- One **free transfer per round** (swap one driver, re-balance budget)
- Subsequent transfers within a round cost **-10 points each** at next scoring
- **Wildcard chip** — once per season, full team reset, no penalty
- Transfers lock when Qualifying starts

### Account / settings
- View team history (every round, what you picked, what you scored)
- Leave a league
- Delete account (GDPR — full data delete, confirmation required)
- Notification preferences (email reminder before round locks)

## Out of scope for v1 (later)

- Push notifications (web push or native app)
- "Captain" voting in leagues (most-picked driver wins extra)
- Driver pricing change mid-season
- Live in-race scoring (we score after the weekend, not live)
- iOS/Android native apps (web is mobile-responsive)
- Social sharing of teams to Twitter/Instagram
- "Battle royale" knockout leagues
- Predictor-style mini-games on top of fantasy

## Key UX principles

1. **Mobile first.** Most fantasy app usage is on a phone in spare moments. Design for one-handed thumb-reach.
2. **Race weekends are the heartbeat.** The week of a race, the app should feel alive — countdown timers, pre-race teasers, post-race recaps. Between rounds, calm.
3. **Friction is the enemy.** Picking a team should take under 2 minutes. Joining a league should be one tap from a shared link.
4. **AI insights are additive, not gating.** Coach gives suggestions; the user always decides. No "Claude's picks" auto-populated team.
5. **The leaderboard is the dopamine.** Surface movement, not just absolute rank. "Up 14 places this round" is more compelling than "Ranked 1,247."

## User stories (top 10)

1. As a new user, I can sign up with email or Google in under 30 seconds.
2. As a new user, I see all 17 drivers with their prices and pick a balanced team in under 2 minutes.
3. As a user, I can boost one driver in my team to score 2× points.
4. As a user, I can create a private league and share an invite code with friends.
5. As a user, I can join a league using a 6-character code.
6. As a user, I see how my team is performing live on a leaderboard during/after race weekends.
7. As a user, I get a Claude-generated analysis of this weekend's picks before Quali locks.
8. As a user, I get a personalised post-race recap of where my points came from.
9. As a user, I can transfer one driver per round for free, with a wildcard chip once per season.
10. As a user, I can delete my account and all my data with one confirmation.

## Success metrics for v1

| Metric | Target by end of 2026 season (5 rounds of live play) |
|---|---|
| Signed-up users | 500+ |
| Returning users round-on-round | 60%+ |
| Private leagues created | 50+ |
| Median team-set time | < 2 min |
| Claude Coach interactions per user per round | 2+ |
| Cost (Supabase + Vercel + Anthropic) | < £20/month |

These are realistic given a niche audience and zero marketing budget. Hitting them = a credible portfolio piece. Exceeding them = a real product.
