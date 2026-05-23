# Architecture

> Stack, schema, services, folder structure. Claude Code should treat this as the source of truth for technical decisions.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15** (App Router) | Josh's primary stack; great Vercel integration; RSC for fast initial loads; mobile-first patterns mature |
| Language | **TypeScript** (strict mode) | Type safety across full-stack; Supabase TS client; portfolio signal |
| Styling | **Tailwind CSS** + **shadcn/ui** | Component velocity; consistent design tokens; copy-paste-own pattern |
| Database | **Supabase Postgres** | Auth + DB + realtime + storage in one; generous free tier; RLS for security |
| Auth | **Supabase Auth** | Email magic link + Google OAuth; same dashboard as DB |
| Realtime | **Supabase Realtime** | Leaderboard updates push to clients without polling |
| AI | **Anthropic API** (Claude Sonnet 4.7) | Coach feature; the portfolio angle; Josh already builds with the SDK |
| Hosting | **Vercel** | Native Next.js; preview deployments; analytics; generous free tier |
| Charts | **Recharts** | Already in Josh's toolkit; good mobile rendering |
| Monitoring | **Vercel Analytics** + **Sentry** (free tier) | Page perf + error tracking |
| CI | **GitHub Actions** | Standard for OSS; runs typecheck + tests + lint on PR |

## High-level architecture

```
                   ┌────────────────────┐
                   │  Next.js (Vercel)  │
                   │  RSC + Server      │
                   │  Actions + API     │
                   └─────────┬──────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
        ┌─────▼─────┐  ┌─────▼─────┐  ┌────▼────────┐
        │ Supabase  │  │ Anthropic │  │ Email send  │
        │ Postgres  │  │   API     │  │ (Resend)    │
        │ Auth      │  │ (Coach)   │  │             │
        │ Realtime  │  │           │  │             │
        └───────────┘  └───────────┘  └─────────────┘
```

## Database schema

All tables use snake_case column names and have `created_at`, `updated_at` timestamps unless noted.

### `seasons`
```sql
id            SERIAL PRIMARY KEY
year          INT NOT NULL UNIQUE     -- 2023, 2024, 2025, 2026
is_current    BOOLEAN NOT NULL        -- exactly one row TRUE
```

### `teams` (the racing teams, not user fantasy teams)
```sql
id            SERIAL PRIMARY KEY
name          TEXT NOT NULL           -- "Prema Racing"
country_code  TEXT                    -- "IT"
short_name    TEXT                    -- for badges
external_id   INT                     -- the f1academy.com numeric ID (for cross-referencing)
```

### `drivers`
```sql
id                SERIAL PRIMARY KEY
full_name         TEXT NOT NULL          -- "Emma Felbermayr"
short_name        TEXT NOT NULL          -- "E. Felbermayr"
country_code      TEXT                   -- "AT"
date_of_birth     DATE
external_id       INT                    -- f1academy.com numeric ID, for cross-referencing
wikipedia_url     TEXT                   -- attribution source
wikidata_qid      TEXT                   -- e.g. "Q123456"
avatar_url        TEXT                   -- our generated/stylised avatar; not press photos
```

### `season_entries` (which driver drives for which team in which season, and F1 partner)
```sql
id                  SERIAL PRIMARY KEY
season_id           INT REFERENCES seasons(id)
driver_id           INT REFERENCES drivers(id)
team_id             INT REFERENCES teams(id)
car_number          INT
f1_partner_team     TEXT                 -- "Aston Martin", "Williams", "—" (free entry)
is_wildcard         BOOLEAN DEFAULT FALSE
rounds              INT[]                -- array of round numbers they're contracted for
UNIQUE(season_id, driver_id)
```

### `rounds`
```sql
id              SERIAL PRIMARY KEY
season_id       INT REFERENCES seasons(id)
round_number    INT NOT NULL             -- 1, 2, 3...
country         TEXT
circuit_name    TEXT                     -- "Circuit Gilles Villeneuve"
date_start      DATE
date_end        DATE
lock_time       TIMESTAMPTZ              -- when team selection locks (= Quali start)
status          TEXT                     -- 'upcoming' | 'live' | 'complete'
UNIQUE(season_id, round_number)
```

### `sessions`
```sql
id              SERIAL PRIMARY KEY
round_id        INT REFERENCES rounds(id)
session_type    TEXT NOT NULL             -- 'qualifying' | 'race1' | 'race2'
session_start   TIMESTAMPTZ
status          TEXT                      -- 'upcoming' | 'live' | 'complete'
```

### `session_results`
```sql
id                  SERIAL PRIMARY KEY
session_id          INT REFERENCES sessions(id)
driver_id           INT REFERENCES drivers(id)
position            INT                   -- finishing position; NULL if DNF/DSQ
grid_position       INT                   -- for races; NULL for quali
status              TEXT                  -- 'classified' | 'dnf' | 'dsq' | 'dns'
fastest_lap         BOOLEAN DEFAULT FALSE
data_source         TEXT NOT NULL         -- 'wikipedia' | 'manual_admin' | 'wikidata'
verified_against    TEXT                  -- e.g. 'f1academy.com/results?raceid=24' (verification only)
verified_at         TIMESTAMPTZ
UNIQUE(session_id, driver_id)
```

### `driver_prices` (per round)
```sql
id              SERIAL PRIMARY KEY
round_id        INT REFERENCES rounds(id)
driver_id       INT REFERENCES drivers(id)
price_millions  NUMERIC(4,1)              -- 4.0 to 15.0
UNIQUE(round_id, driver_id)
```

### `users` (extension of Supabase auth.users)
```sql
id              UUID PRIMARY KEY          -- matches auth.users.id
display_name    TEXT NOT NULL
favourite_team_id INT REFERENCES teams(id)
created_at      TIMESTAMPTZ
```

### `user_teams` (one row per user per round — their pick)
```sql
id              SERIAL PRIMARY KEY
user_id         UUID REFERENCES users(id) ON DELETE CASCADE
round_id        INT REFERENCES rounds(id)
driver_ids      INT[] NOT NULL            -- exactly 4
boost_driver_id INT NOT NULL              -- must be in driver_ids
transfers_used  INT DEFAULT 0
wildcard_used   BOOLEAN DEFAULT FALSE
locked_at       TIMESTAMPTZ               -- when the team was finalised
UNIQUE(user_id, round_id)
```

### `user_scores` (computed by scoring engine)
```sql
id                  SERIAL PRIMARY KEY
user_id             UUID REFERENCES users(id) ON DELETE CASCADE
round_id            INT REFERENCES rounds(id)
round_points        INT NOT NULL
boost_points_added  INT
transfer_penalty    INT DEFAULT 0
cumulative_points   INT NOT NULL
breakdown           JSONB                  -- per-driver scoring details
UNIQUE(user_id, round_id)
```

### `leagues` (mini-leagues)
```sql
id              SERIAL PRIMARY KEY
name            TEXT NOT NULL
invite_code     TEXT NOT NULL UNIQUE       -- 6 chars, e.g. "MNT-4K"
owner_id        UUID REFERENCES users(id)
season_id       INT REFERENCES seasons(id)
created_at      TIMESTAMPTZ
```

### `league_members`
```sql
league_id       INT REFERENCES leagues(id) ON DELETE CASCADE
user_id         UUID REFERENCES users(id) ON DELETE CASCADE
joined_at       TIMESTAMPTZ
PRIMARY KEY (league_id, user_id)
```

### `coach_insights` (cache for Claude responses)
```sql
id              SERIAL PRIMARY KEY
user_id         UUID REFERENCES users(id) ON DELETE CASCADE
round_id        INT REFERENCES rounds(id)
kind            TEXT                       -- 'pre_race' | 'post_race' | 'driver_take'
target_id       INT                        -- driver_id if 'driver_take', else NULL
content         TEXT NOT NULL
model           TEXT                       -- e.g. 'claude-opus-4-7'
tokens_used     INT
created_at      TIMESTAMPTZ
```

## Row Level Security (RLS) — Supabase

- `users`: a user can SELECT/UPDATE their own row only
- `user_teams`: a user can SELECT their own + leagues they're in; INSERT/UPDATE their own only
- `user_scores`: read for own + league members; write only via service role (scoring engine)
- `leagues`: SELECT for members; INSERT/UPDATE for owners
- `coach_insights`: SELECT for own user only; INSERT via service role
- All `drivers`, `teams`, `rounds`, `sessions`, `session_results` tables: public SELECT, service-role-only write

## API design (Next.js Route Handlers / Server Actions)

| Endpoint / Action | Purpose | Auth |
|---|---|---|
| `GET /api/drivers` | List drivers + prices for current round | Public |
| `GET /api/rounds/current` | Current round metadata + lock time | Public |
| `POST /api/teams/save` (server action) | Save user team for current round | Authed |
| `POST /api/teams/wildcard` | Use wildcard chip | Authed |
| `GET /api/leagues/mine` | User's leagues | Authed |
| `POST /api/leagues/create` | Create league + return invite code | Authed |
| `POST /api/leagues/join` | Join via invite code | Authed |
| `GET /api/leaderboard/global` | Top 100 + your position | Public/authed |
| `GET /api/leaderboard/league/[id]` | League standings | Authed (member only) |
| `GET /api/coach/pre-race` | Generate / fetch cached pre-race insight for current user | Authed |
| `GET /api/coach/post-race/[roundId]` | Post-race recap for current user | Authed |
| `POST /api/admin/score-round` | Run scoring engine for a round | Admin only |
| `POST /api/admin/results` | Enter session results | Admin only |

## Folder structure

```
academy-fantasy/
├── README.md
├── docs/                          ← these planning docs live here
├── app/                           ← Next.js App Router
│   ├── (marketing)/
│   │   ├── page.tsx               ← landing page
│   │   └── about/
│   ├── (app)/                     ← authenticated area
│   │   ├── dashboard/
│   │   ├── team/                  ← team selection
│   │   ├── leagues/
│   │   │   ├── page.tsx
│   │   │   └── [leagueId]/
│   │   ├── coach/
│   │   └── account/
│   ├── (admin)/                   ← admin area
│   │   ├── results/
│   │   └── score/
│   ├── api/
│   │   ├── coach/
│   │   ├── leagues/
│   │   ├── leaderboard/
│   │   └── admin/
│   └── layout.tsx
├── components/
│   ├── ui/                        ← shadcn primitives
│   ├── team/                      ← TeamPicker, DriverCard, BudgetBar
│   ├── leaderboard/
│   ├── coach/
│   └── shared/
├── lib/
│   ├── supabase/                  ← client + server clients
│   ├── scoring/                   ← scoring engine (pure functions)
│   ├── coach/                     ← Anthropic API wrappers
│   └── utils/
├── db/
│   ├── migrations/                ← Supabase migrations
│   ├── seed/                      ← seed scripts (drivers, teams, 2026 calendar)
│   └── types.ts                   ← generated from Supabase
├── scripts/
│   ├── wiki-sync.ts               ← optional: cross-check results from Wikipedia API
│   └── price-recalibrate.ts       ← runs between rounds
└── tests/
    ├── scoring.test.ts            ← scoring engine tests (golden cases)
    └── e2e/                       ← Playwright
```

## Performance & cost budget

- **Vercel:** Free tier covers <1k MAU comfortably. Edge runtime for public reads.
- **Supabase:** Free tier = 500MB DB, 2GB bandwidth/month. Our data is tiny; we'll fit.
- **Anthropic API:** Budget ~£10/month. Cache aggressively in `coach_insights`. One pre-race + one post-race per user per round = ~12 calls per active user per season.
- **Resend (email):** Free tier = 3k emails/month. Fine for reminders.

Goal: full operating cost under **£20/month** at v1 scale.

## Security checklist

- [ ] Anthropic API key in Vercel env vars, never in client bundle
- [ ] Supabase service role key only in server actions / API routes
- [ ] RLS enabled on every user-data table, with verified policies
- [ ] Rate limit auth attempts (Supabase built-in)
- [ ] Rate limit Coach endpoint per user (e.g. 5 calls / 10 min) to cap Anthropic spend
- [ ] CSRF: server actions use Next.js built-in protection
- [ ] Admin routes gated by a single `is_admin` flag on `users` (set manually in DB for v1)
- [ ] Privacy notice + cookie banner served on first visit
- [ ] All user-content fields (display name, league name) sanitised + length-capped
