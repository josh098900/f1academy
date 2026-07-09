# Academy Fantasy — repo guidance

A free-to-play fantasy game for the F1 Academy series. Next.js 16 (App Router,
Server Components/Actions) + Supabase (Postgres, RLS, Auth, Realtime), TypeScript,
Tailwind v4, deployed on Vercel.

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
