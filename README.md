# Academy Fantasy

A free-to-play fantasy game for the **F1 Academy** series — pick a team within a
budget cap, score points across each race weekend, compete in mini-leagues with
friends, and get AI-powered insights from a Claude-powered "Coach."

The official F1 Fantasy product excludes F1 Academy. This fills that gap. It is
unofficial, non-commercial, and for entertainment only.

> **Status:** Building Phase 0 (Foundation). Targeting a Round 3 Silverstone
> launch (3–5 July 2026). See [docs/files/PROJECT_PLAN.md](docs/files/PROJECT_PLAN.md).

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript strict, Turbopack) |
| Styling | Tailwind CSS v4 + shadcn/ui (Base UI), custom design system |
| Database / Auth | Supabase (Postgres, Auth, Realtime), `@supabase/ssr` |
| AI | Anthropic API (Claude) — the "Coach" feature |
| Errors | Sentry |
| Hosting | Vercel |

## Getting started

Requires Node 22+ and pnpm 11+.

```bash
pnpm install
cp .env.example .env.local   # then fill in your Supabase values
pnpm dev                     # http://localhost:3000
```

### Environment variables

See [.env.example](.env.example). You'll need a Supabase project (UK/EU region):

- `NEXT_PUBLIC_SUPABASE_URL` — project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — publishable key (safe for the browser)
- `SUPABASE_SECRET_KEY` — server-only secret key (scoring engine, admin)

Sentry's source-map upload token, if used, lives in `.env.sentry-build-plugin`
(gitignored).

## Scripts

| Command | What |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint |
| `pnpm exec tsc --noEmit` | Typecheck |

CI (GitHub Actions) runs typecheck, lint, and build on every PR and push to `main`.

## Documentation

The planning docs are the source of truth for what this is and how it's built:

1. [LEGAL_AND_ETHICS.md](docs/files/LEGAL_AND_ETHICS.md) — what we can and can't do. Read first.
2. [PRODUCT_SPEC.md](docs/files/PRODUCT_SPEC.md) — features and user flows.
3. [SCORING_SYSTEM.md](docs/files/SCORING_SYSTEM.md) — the points system.
4. [DESIGN_SYSTEM.md](docs/files/DESIGN_SYSTEM.md) — visual language and tokens.
5. [ARCHITECTURE.md](docs/files/ARCHITECTURE.md) — stack, schema, folder layout.
6. [DATA_PIPELINE.md](docs/files/DATA_PIPELINE.md) — how race results get in.
7. [PROJECT_PLAN.md](docs/files/PROJECT_PLAN.md) — phased delivery.

## Legal & attribution

Free to play. For entertainment only. No money involved.

Race data sourced from Wikipedia (CC BY-SA 4.0) and Wikidata (CC0). We do not
scrape or extract data from f1academy.com.

F1, FORMULA 1, F1 ACADEMY, GRAND PRIX and related marks are trademarks of Formula
One Licensing BV. Academy Fantasy is unofficial and not associated with the
Formula 1 group of companies.

## License

Code is [MIT](LICENSE). Documentation and the scoring system are CC BY 4.0.

Maintainer: Josh — [@josh098900](https://github.com/josh098900)
