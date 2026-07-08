-- Two residual hardening items from the post-trigger adversarial review.
--
-- 1. Pre-lock team privacy: the original SELECT policy let league-mates read
--    each other's user_teams rows at ANY time. The app never surfaces rival
--    teams pre-lock, but the API allowed reading (and copying/countering) a
--    league-mate's picks before the deadline. League-mate visibility now
--    starts only once the round is locked; your own rows are unrestricted.
--
-- 2. Active-round-only writes: the trigger accepted any unlocked upcoming
--    round. Harmless today (future rounds have no prices, so eligibility
--    rejects everything), but if two rounds were ever priced at once a player
--    could bank a stale transfer baseline by saving a future round early and
--    then reshaping the earlier team — and two open wildcard writes could
--    race. Writes are now pinned to the earliest upcoming round of the
--    season, exactly what saveTeam targets.

-- ---------------------------------------------------------------------------
-- 1. Lock-scoped league-mate visibility
-- ---------------------------------------------------------------------------

drop policy if exists "read own or league-mate teams" on public.user_teams;
create policy "read own or league-mate teams" on public.user_teams
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    or (
      public.shares_league_with(user_id)
      and exists (
        select 1
          from public.rounds r
         where r.id = round_id
           and (
             r.status <> 'upcoming'
             or (r.lock_time is not null and r.lock_time <= now())
           )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Trigger: only THE active round is writable
--    (full function restated; the new block is "Only the active round".)
-- ---------------------------------------------------------------------------

create or replace function public.enforce_team_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round public.rounds%rowtype;
  v_priced integer;
  v_spent numeric;
  v_baseline integer[];
  v_transfers integer;
begin
  -- Player writes only — service role / direct SQL are trusted paths.
  if (select auth.role()) is distinct from 'authenticated' then
    return new;
  end if;

  -- Own rows only, checked BEFORE any user_teams reads: RLS would reject the
  -- write anyway, but only after this SECURITY DEFINER function had already
  -- read another user's rows — and the wildcard error below would leak
  -- whether that user has spent their wildcard.
  if new.user_id is distinct from (select auth.uid()) then
    raise exception 'You can only save your own team.';
  end if;

  select * into v_round from public.rounds where id = new.round_id;
  if v_round.id is null then
    raise exception 'Round not found.';
  end if;
  if v_round.status <> 'upcoming' then
    raise exception 'This round is not open for team selection.';
  end if;
  -- Null lock_time = "Locks TBC", still open — same semantic as saveTeam.
  if v_round.lock_time is not null and v_round.lock_time <= now() then
    raise exception 'Selection has locked for this round.';
  end if;

  -- Only the active round (earliest upcoming this season) is open — the same
  -- round saveTeam targets. Blocks future-round writes that would bank a
  -- stale transfer baseline if two rounds were ever priced at once, and
  -- keeps concurrent wildcard writes on a single row.
  if exists (
    select 1
      from public.rounds r
     where r.season_id = v_round.season_id
       and r.status = 'upcoming'
       and r.round_number < v_round.round_number
  ) then
    raise exception 'This round is not open for team selection yet.';
  end if;

  -- A row can never move between rounds: updating round_id would let a team
  -- escape a locked round (and re-land wherever it liked).
  if tg_op = 'UPDATE' and new.round_id <> old.round_id then
    raise exception 'A team cannot move to another round.';
  end if;

  -- 4 DISTINCT drivers. The schema CHECK only counts array length, and the
  -- scorer scores each entry independently — duplicates would multiply points.
  if (select count(distinct d) from unnest(new.driver_ids) d) <> 4 then
    raise exception 'A team must be 4 different drivers.';
  end if;

  -- Every driver priced for this round (unpriced = not racing it), and the
  -- squad within budget. Mirrors validateTeam() with BUDGET_CAP = 40.
  select count(*), coalesce(sum(price_millions), 0)
    into v_priced, v_spent
    from public.driver_prices
   where round_id = new.round_id
     and driver_id = any (new.driver_ids);
  if v_priced <> 4 then
    raise exception 'A selected driver is not available this round.';
  end if;
  if v_spent > 40 then
    raise exception 'Team is over the £40M budget cap.';
  end if;

  -- transfers_used is COMPUTED here, never trusted from the client: changes
  -- versus the most recent prior round the user fielded a team in (same
  -- season). No baseline -> 0. Mirrors countTransfers().
  select ut.driver_ids
    into v_baseline
    from public.user_teams ut
    join public.rounds r on r.id = ut.round_id
   where ut.user_id = new.user_id
     and r.season_id = v_round.season_id
     and r.round_number < v_round.round_number
   order by r.round_number desc
   limit 1;
  if v_baseline is null then
    v_transfers := 0;
  else
    select count(*)
      into v_transfers
      from unnest(new.driver_ids) d
     where d <> all (v_baseline);
  end if;
  new.transfers_used := v_transfers;

  -- Wildcard: sticky once saved on a round (a resave can't restore the chip),
  -- and once per season. Mirrors resolveWildcard().
  if tg_op = 'UPDATE' and old.wildcard_used then
    new.wildcard_used := true;
  end if;
  if new.wildcard_used
     and (tg_op = 'INSERT' or not old.wildcard_used)
     and exists (
       select 1
         from public.user_teams ut
         join public.rounds r on r.id = ut.round_id
        where ut.user_id = new.user_id
          and ut.wildcard_used
          and ut.round_id <> new.round_id
          and r.season_id = v_round.season_id
     )
  then
    raise exception 'The wildcard has already been used this season.';
  end if;

  return new;
end;
$$;
