-- Ownership guard for the user_teams trigger (fixes a cross-user info leak
-- in 20260708003000, caught in external review).
--
-- BEFORE triggers run before RLS WITH CHECK, and this function is SECURITY
-- DEFINER, so its reads bypass RLS. A player could INSERT with a victim's
-- UUID (global_leaderboard exposes them by design) and wildcard_used=true:
-- the write always fails, but WHICH error came back revealed whether the
-- victim had spent their season wildcard — a 1-bit oracle on private team
-- state. Rejecting rows for other users before any user_teams read makes
-- the definer reads unreachable for anyone else's data.
--
-- Full function restated (create or replace); the guard is the block right
-- after the role check. Everything else is unchanged from 20260708003000.

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
