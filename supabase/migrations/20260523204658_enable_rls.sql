-- Row Level Security — see docs/files/ARCHITECTURE.md.
-- Reference tables: public read, service-role-only write (no write policies, as
-- the service role bypasses RLS). User tables: scoped to the owner, with
-- league-mate read access via SECURITY DEFINER helpers (which bypass RLS to
-- avoid policy recursion).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- True if the current user shares at least one league with `target`.
create function public.shares_league_with(target uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.league_members self_m
    join public.league_members other_m on self_m.league_id = other_m.league_id
    where self_m.user_id = (select auth.uid())
      and other_m.user_id = target
  );
$$;

-- True if the current user is a member of `league`.
create function public.is_league_member(league integer)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.league_members
    where league_id = league
      and user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Reference data — public read, service-role-only write
-- ---------------------------------------------------------------------------

alter table public.seasons enable row level security;
create policy "seasons are public" on public.seasons for select using (true);

alter table public.teams enable row level security;
create policy "teams are public" on public.teams for select using (true);

alter table public.drivers enable row level security;
create policy "drivers are public" on public.drivers for select using (true);

alter table public.season_entries enable row level security;
create policy "season_entries are public" on public.season_entries for select using (true);

alter table public.rounds enable row level security;
create policy "rounds are public" on public.rounds for select using (true);

alter table public.sessions enable row level security;
create policy "sessions are public" on public.sessions for select using (true);

alter table public.session_results enable row level security;
create policy "session_results are public" on public.session_results for select using (true);

alter table public.driver_prices enable row level security;
create policy "driver_prices are public" on public.driver_prices for select using (true);

-- ---------------------------------------------------------------------------
-- users — own row only (read + update)
-- NOTE: leaderboards that show other players' display names will be served via
-- a server-side query or a dedicated view/RPC (revisit in Phase 4), keeping the
-- base table strict here.
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
create policy "read own user" on public.users
  for select to authenticated using ((select auth.uid()) = id);
create policy "update own user" on public.users
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- user_teams — own + league-mates can read; write own only. Service role
-- (scoring engine) bypasses RLS.
-- ---------------------------------------------------------------------------

alter table public.user_teams enable row level security;
create policy "read own or league-mate teams" on public.user_teams
  for select to authenticated
  using ((select auth.uid()) = user_id or public.shares_league_with(user_id));
create policy "insert own team" on public.user_teams
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own team" on public.user_teams
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- user_scores — own + league-mates can read; writes via service role only
-- ---------------------------------------------------------------------------

alter table public.user_scores enable row level security;
create policy "read own or league-mate scores" on public.user_scores
  for select to authenticated
  using ((select auth.uid()) = user_id or public.shares_league_with(user_id));

-- ---------------------------------------------------------------------------
-- leagues — members read; owner manages
-- ---------------------------------------------------------------------------

alter table public.leagues enable row level security;
create policy "read leagues you're in" on public.leagues
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_league_member(id));
create policy "owner creates league" on public.leagues
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner updates league" on public.leagues
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner deletes league" on public.leagues
  for delete to authenticated using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- league_members — members read; users join/leave themselves
-- ---------------------------------------------------------------------------

alter table public.league_members enable row level security;
create policy "read members of your leagues" on public.league_members
  for select to authenticated using (public.is_league_member(league_id));
create policy "join a league yourself" on public.league_members
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "leave a league yourself" on public.league_members
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- coach_insights — own read; inserts via service role only
-- ---------------------------------------------------------------------------

alter table public.coach_insights enable row level security;
create policy "read own insights" on public.coach_insights
  for select to authenticated using ((select auth.uid()) = user_id);
