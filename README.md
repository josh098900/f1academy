# Academy Fantasy

A free-to-play fantasy game for the **F1 Academy** series — pick four drivers
under a £40M cap, boost your star for double points, score across every race
weekend, and climb the global leaderboard or your mini-leagues.

**Live at [f1academy-mu.vercel.app](https://f1academy-mu.vercel.app)** — launched
for Round 3 at Silverstone (July 2026) and now running live rounds with real
players. The official F1 Fantasy product excludes F1 Academy; this fills that
gap. Unofficial, non-commercial, entertainment only.

## What's in it

- **Team picker** — 4 drivers under budget, one 2× boost, a once-a-season
  wildcard chip, transfer penalties between rounds, server-enforced lock times
- **Live scoring** — quali, reverse-grid and feature races scored per the
  [scoring system](docs/files/SCORING_SYSTEM.md); leaderboards update in
  realtime via Supabase Realtime
- **Mini-leagues** — create, join by invite code, per-league standings
- **The Coach** — opt-in AI insights (Google Gemini, clearly labelled):
  pre-race reads, personal post-race recaps, per-driver scouting takes.
  Off by default; cached and rate-limited to stay inside the free tier
- **Results pipeline** — race results parsed from Wikipedia by a daily cron,
  qualifying entered via the admin panel, grids derived automatically
  (reverse-grid top 8 inversion included)
- **Ops** — lock-time email reminders (Resend), admin-authored news feed,
  a [race-weekend runbook](docs/files/RACE_WEEKEND_RUNBOOK.md), and one-command
  tooling for mid-season wildcard drivers

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript strict, Turbopack) |
| Styling | Tailwind CSS v4 + shadcn/ui (Base UI), custom design system |
| Database / Auth | Supabase (Postgres, Auth, Realtime, RLS), `@supabase/ssr` |
| AI | Google Gemini (`gemini-2.5-flash`) — the opt-in "Coach" |
| Email | Resend (custom SMTP for auth mail + API for reminders) |
| Errors | Sentry |
| Hosting | Vercel (London region, cron schedules) |

## Getting started

Requires Node 22+ and pnpm 11+.

```bash
pnpm install
cp .env.example .env.local   # then fill in your values
pnpm dev                     # http://localhost:3000
```

### Environment variables

See [.env.example](.env.example) for the full annotated list — Supabase URL and
keys, `CRON_SECRET` for the scheduled routes, `GEMINI_API_KEY` for the Coach,
and `RESEND_API_KEY` for reminder emails. Sentry's source-map token, if used,
lives in `.env.sentry-build-plugin` (gitignored).

## Scripts

| Command | What |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build |
| `pnpm test` | Vitest (scoring engine, team rules, parsers, auth helpers) |
| `pnpm lint` | ESLint |
| `pnpm exec tsc --noEmit` | Typecheck |
| `pnpm exec tsx scripts/wiki-sync.ts` | Regenerate season seed data from Wikipedia |
| `pnpm exec tsx scripts/price-recalibrate.ts <round>` | Recompute driver prices from form |
| `pnpm exec tsx scripts/add-wildcard.ts` | Register a mid-season wildcard driver |

CI (GitHub Actions) runs typecheck, lint, and build on every PR and push to `main`.

## Documentation

1. [LEGAL_AND_ETHICS.md](docs/files/LEGAL_AND_ETHICS.md) — what we can and can't do. Read first.
2. [PRODUCT_SPEC.md](docs/files/PRODUCT_SPEC.md) — features and user flows.
3. [SCORING_SYSTEM.md](docs/files/SCORING_SYSTEM.md) — the points system.
4. [DESIGN_SYSTEM.md](docs/files/DESIGN_SYSTEM.md) — visual language and tokens.
5. [ARCHITECTURE.md](docs/files/ARCHITECTURE.md) — stack, schema, folder layout.
6. [DATA_PIPELINE.md](docs/files/DATA_PIPELINE.md) — how race results get in.
7. [RACE_WEEKEND_RUNBOOK.md](docs/files/RACE_WEEKEND_RUNBOOK.md) — the recurring admin loop.
8. [PROJECT_PLAN.md](docs/files/PROJECT_PLAN.md) — the phased delivery that got here.

Security and code reviews conducted along the way are archived in
[docs/reviews/](docs/reviews/).

## Legal & attribution

Free to play. For entertainment only. No money involved.

Race data sourced from Wikipedia (CC BY-SA 4.0) and Wikidata (CC0). Circuit
outlines from Wikimedia Commons (per-file attribution in the app footer). We do
not scrape or extract data from f1academy.com.

F1, FORMULA 1, F1 ACADEMY, GRAND PRIX and related marks are trademarks of Formula
One Licensing BV. Academy Fantasy is unofficial and not associated with the
Formula 1 group of companies.

## License

Code is [MIT](LICENSE). Documentation and the scoring system are CC BY 4.0.

Maintainer: Josh — [@josh098900](https://github.com/josh098900)
