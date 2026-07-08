-- Verifies the user_teams hardening trigger (20260708003000) against live
-- data by impersonating a signed-in player, exactly as PostgREST would.
--
-- Run the whole file in the Supabase SQL editor. EVERYTHING ROLLS BACK —
-- no production data is touched. Read the Messages tab: every line should
-- say PASS (or SKIP where the data can't exercise a case).
--
-- Impersonates a user who has a team saved for the active round, so update
-- paths are exercised against a real row.

begin;

do $$
declare
  v_uid uuid;
  v_open_round integer;      -- earliest upcoming round (the active one)
  v_locked_round integer;    -- any completed round
  v_ids integer[];           -- the user's current saved team
  v_cheap integer[];         -- 4 cheapest priced drivers for the open round
  v_dear integer[];          -- 4 priciest — over-budget attempt
  v_dear_sum numeric;
  v_transfers integer;
begin
  -- A player with a team for the active round.
  select r.id into v_open_round
    from public.rounds r
   where r.status = 'upcoming'
   order by r.round_number
   limit 1;
  select ut.user_id, ut.driver_ids into v_uid, v_ids
    from public.user_teams ut
   where ut.round_id = v_open_round
   limit 1;
  if v_uid is null then
    raise notice 'SKIP all: nobody has a team for the active round yet.';
    return;
  end if;
  select r.id into v_locked_round
    from public.rounds r
   where r.status = 'complete'
   order by r.round_number desc
   limit 1;
  select array_agg(driver_id) into v_cheap from (
    select driver_id from public.driver_prices
     where round_id = v_open_round order by price_millions asc limit 4
  ) c;
  select array_agg(driver_id), sum(price_millions) into v_dear, v_dear_sum from (
    select driver_id, price_millions from public.driver_prices
     where round_id = v_open_round order by price_millions desc limit 4
  ) d;

  -- Become that player, as PostgREST would.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text,
    true
  );
  perform set_config('role', 'authenticated', true);

  -- 1. Duplicate drivers must be rejected (they'd each be scored).
  begin
    update public.user_teams
       set driver_ids = array[v_cheap[1], v_cheap[1], v_cheap[1], v_cheap[1]],
           boost_driver_id = v_cheap[1]
     where user_id = v_uid and round_id = v_open_round;
    raise warning 'FAIL 1: duplicate drivers were accepted';
  exception when others then
    raise notice 'PASS 1: duplicates rejected (%)', sqlerrm;
  end;

  -- 2. Writing to a locked/complete round must be rejected.
  if v_locked_round is null then
    raise notice 'SKIP 2: no completed round to test against.';
  else
    begin
      insert into public.user_teams (user_id, round_id, driver_ids, boost_driver_id)
      values (v_uid, v_locked_round, v_cheap, v_cheap[1]);
      raise warning 'FAIL 2: wrote a team into a completed round';
    exception when others then
      raise notice 'PASS 2: locked round rejected (%)', sqlerrm;
    end;
  end if;

  -- 3. Moving an existing row to another round must be rejected.
  if v_locked_round is null then
    raise notice 'SKIP 3: no completed round to test against.';
  else
    begin
      update public.user_teams set round_id = v_locked_round
       where user_id = v_uid and round_id = v_open_round;
      raise warning 'FAIL 3: moved a team between rounds';
    exception when others then
      raise notice 'PASS 3: round move rejected (%)', sqlerrm;
    end;
  end if;

  -- 4. Over-budget squad must be rejected (needs the top 4 to breach the cap).
  if v_dear_sum <= 40 then
    raise notice 'SKIP 4: top-4 prices sum to £%M — cannot breach the cap.', v_dear_sum;
  else
    begin
      update public.user_teams
         set driver_ids = v_dear, boost_driver_id = v_dear[1]
       where user_id = v_uid and round_id = v_open_round;
      raise warning 'FAIL 4: over-budget team was accepted';
    exception when others then
      raise notice 'PASS 4: over-budget rejected (%)', sqlerrm;
    end;
  end if;

  -- 5. transfers_used must be recomputed, not trusted.
  update public.user_teams
     set transfers_used = 99
   where user_id = v_uid and round_id = v_open_round;
  select transfers_used into v_transfers
    from public.user_teams
   where user_id = v_uid and round_id = v_open_round;
  if v_transfers = 99 then
    raise warning 'FAIL 5: client-supplied transfers_used was stored';
  else
    raise notice 'PASS 5: transfers_used recomputed to % (99 was sent)', v_transfers;
  end if;

  -- 6. A legitimate resave must still work (happy path unbroken).
  begin
    update public.user_teams
       set driver_ids = v_ids
     where user_id = v_uid and round_id = v_open_round;
    raise notice 'PASS 6: legitimate resave accepted';
  exception when others then
    raise warning 'FAIL 6: legitimate resave was rejected (%)', sqlerrm;
  end;
end $$;

rollback;
