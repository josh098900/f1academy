-- The Paddock grows a memory: a team per player, a race log, and coins.
-- First slice of the garage (P4) — every quick race pays out, server-side.
--
-- Design decisions, so the next migration doesn't have to relearn them:
--
-- * Levels, not stats. The DB stores car/staff upgrade LEVELS (small ints);
--   the level -> sim-stat mapping lives in code beside the sim's tuning, so
--   rebalancing the game never needs a data migration.
--
-- * Inputs, not timelines. A race row is (seed, track, laps, driver,
--   strategy) plus a result summary. The sim is deterministic, so those few
--   hundred bytes replay the identical race forever; storing anything more
--   would be storing something a client could disagree with.
--
-- * Coins are server-authoritative. There is NO client write path: RLS
--   grants SELECT only, and every mutation goes through
--   settle_paddock_race() — called by a server action that minted the seed
--   itself, re-simulated the race, and computed the payout from its own
--   result. Forging a result means breaking the sim's maths, not a form.

create table public.paddock_teams (
  user_id uuid primary key references public.users(id) on delete cascade,
  coins integer not null default 0 check (coins >= 0),
  -- Car upgrade levels. 0 = the stock car every player starts with.
  car_power smallint not null default 0 check (car_power between 0 and 10),
  car_aero smallint not null default 0 check (car_aero between 0 and 10),
  car_reliability smallint not null default 0 check (car_reliability between 0 and 10),
  car_pit_crew smallint not null default 0 check (car_pit_crew between 0 and 10),
  -- Team-principal investments: the staff AROUND the driver, never the
  -- driver herself — her rating stays derived from real results.
  eng_race_engineer smallint not null default 0 check (eng_race_engineer between 0 and 10),
  eng_simulator smallint not null default 0 check (eng_simulator between 0 and 10),
  eng_data_analyst smallint not null default 0 check (eng_data_analyst between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger paddock_teams_updated_at
  before update on public.paddock_teams
  for each row execute function public.set_updated_at();

create table public.paddock_races (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  -- Everything needed to replay the race, byte for byte...
  seed bigint not null,
  track_id text not null,
  laps smallint not null,
  driver_id integer not null references public.drivers(id),
  strategy jsonb not null,
  -- ...and the summary a history screen lists without replaying anything.
  finish_position smallint not null,
  grid_position smallint not null,
  retired text check (retired in ('crash', 'mechanical')),
  coins_earned integer not null check (coins_earned >= 0),
  created_at timestamptz not null default now()
);

create index paddock_races_user_created_idx
  on public.paddock_races (user_id, created_at desc);

alter table public.paddock_teams enable row level security;
alter table public.paddock_races enable row level security;

-- Read your own garage, your own history. Deliberately NO insert/update/
-- delete policies for authenticated: writes happen below as the service
-- role, or not at all.
create policy "paddock_teams_select_own"
  on public.paddock_teams for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "paddock_races_select_own"
  on public.paddock_races for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- One atomic settlement: bank the payout and log the race together, so a
-- failure between the two can never mint coins without history or history
-- without coins.
create function public.settle_paddock_race(
  p_user_id uuid,
  p_seed bigint,
  p_track_id text,
  p_laps smallint,
  p_driver_id integer,
  p_strategy jsonb,
  p_finish_position smallint,
  p_grid_position smallint,
  p_coins integer,
  p_retired text default null
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
begin
  insert into public.paddock_teams as t (user_id, coins)
  values (p_user_id, p_coins)
  on conflict (user_id)
  do update set coins = t.coins + excluded.coins
  returning coins into v_balance;

  insert into public.paddock_races (
    user_id, seed, track_id, laps, driver_id, strategy,
    finish_position, grid_position, retired, coins_earned
  ) values (
    p_user_id, p_seed, p_track_id, p_laps, p_driver_id, p_strategy,
    p_finish_position, p_grid_position, p_retired, p_coins
  );

  return v_balance;
end;
$$;

-- Service-role only — a player JWT cannot reach the settlement function at
-- all (same tightening pattern as 20260612153016_tighten_function_grants).
revoke all on function public.settle_paddock_race(uuid, bigint, text, smallint, integer, jsonb, smallint, smallint, integer, text) from public;
revoke all on function public.settle_paddock_race(uuid, bigint, text, smallint, integer, jsonb, smallint, smallint, integer, text) from anon;
revoke all on function public.settle_paddock_race(uuid, bigint, text, smallint, integer, jsonb, smallint, smallint, integer, text) from authenticated;
grant execute on function public.settle_paddock_race(uuid, bigint, text, smallint, integer, jsonb, smallint, smallint, integer, text) to service_role;
