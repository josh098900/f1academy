# Academy Fantasy — Fantasy League for F1 Academy

> **Status:** Planning phase. No code yet. These docs are what Claude Code (and Josh) work from.

## The one-sentence pitch

The official F1 Fantasy game has 2.4M+ teams but excludes F1 Academy. **Academy Fantasy** is a hybrid predictor + fantasy web app for the all-female F1 support series — pick a team within a budget cap, score points across the season, compete in mini-leagues with friends, get AI-powered insights from a Claude-powered "Coach."

## Why this exists

- F1 Academy has zero fan-built tooling. No fantasy, no predictor, no community apps.
- The official F1 Fantasy product deliberately excludes the Academy.
- F1 Academy fandom is growing fast (Netflix series, F1 weekend integration, brand sponsorships) — captive audience that grows every race weekend.
- First mover advantage on a clearly underserved niche.

## What this is NOT

- ❌ Not a gambling product. No real money. Entertainment only. Clear disclaimer.
- ❌ Not affiliated with F1 Academy, Formula 1, or the FIA.
- ❌ Not a scraper for f1academy.com (their TOS forbids extraction — see `LEGAL_AND_ETHICS.md`).
- ❌ Not the official "F1 Fantasy" product. Different name, different branding.

## What this IS

- ✅ A web app: Next.js 15 + TypeScript + Tailwind + shadcn/ui
- ✅ Supabase for Postgres + auth + realtime leaderboards
- ✅ A scoring engine that runs after each race weekend
- ✅ Mini-leagues with private invite codes
- ✅ "Claude Coach" — AI-powered weekly picks analysis via the Anthropic API
- ✅ Mobile-first responsive design
- ✅ Open source (MIT) — Josh's portfolio piece

## Target launch

Round 3 — Silverstone, **3–5 July 2026**. That gives us ~6 weeks. Round 2 (Montreal) is this weekend (22–24 May); we use it as our offline test data.

Remaining 2026 calendar after launch:
- Round 4: Zandvoort, 21–23 Aug
- Round 5: Austin, 23–25 Oct
- Round 6: Las Vegas, 19–21 Nov

Four rounds of live use before the season ends = a real demo period for portfolio/recruiter conversations.

## How to read these docs (in order)

1. **`LEGAL_AND_ETHICS.md`** — what we can and can't do. Read first.
2. **`PRODUCT_SPEC.md`** — features, user flows, what ships in v1.
3. **`SCORING_SYSTEM.md`** — the points system. The heart of the product.
4. **`DESIGN_SYSTEM.md`** — visual language, tokens, components. **Read before writing any UI.**
5. **`ARCHITECTURE.md`** — stack, database schema, services, folder layout.
6. **`DATA_PIPELINE.md`** — how race results get into the system. The operationally hardest bit.
7. **`PROJECT_PLAN.md`** — phased delivery, milestones, what "done" looks like.

## Working agreement with Claude Code

- Never write code that fetches from `f1academy.com` programmatically.
- Race results enter the system via (a) Wikipedia API after-the-fact, (b) manual admin panel as fallback, (c) Wikidata where available. Never via scraping the official site.
- All published surfaces (footer, dataset README, API responses) carry the required trademark notice.
- All player-facing copy says "entertainment only, no money" wherever scoring or competition appears.
- Anthropic API key lives in env vars, never committed.
- "Claude Coach" responses are clearly labelled as AI-generated.

## Maintainer

Josh — BSc Software Engineering, University of Portsmouth.
GitHub: [@josh098900](https://github.com/josh098900)
