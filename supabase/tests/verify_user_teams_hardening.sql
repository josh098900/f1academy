-- Verifies the user_teams hardening trigger (20260708003000) against live
-- data by impersonating a signed-in player, exactly as PostgREST would.
--
-- Run the whole file in the Supabase SQL editor.
--
-- HOW TO READ THE OUTPUT — the script ends by raising an exception ON
-- PURPOSE. The editor doesn't display RAISE NOTICE output, and anything
-- else (temp tables, settings) is erased by the rollback; an exception is
-- the one channel that is always shown AND aborts the whole block, which
-- is what guarantees every test write is rolled back. So:
--
--   a RED ERROR BOX whose message is a list of "PASS ..." lines = SUCCESS.
--   Any "FAIL ..." line in that list = the trigger is not enforcing.
--
-- No production data is touched: the final exception rolls everything back.

do $$
declare
  v_uid uuid;
  v_other uuid;              -- a DIFFERENT user — cross-user attack target
  v_open_round integer;      -- earliest upcoming round (the active one)
  v_locked_round integer;    -- any completed round
  v_ids integer[];           -- the user's current saved team
  v_cheap integer[];         -- 4 cheapest priced drivers for the open round
  v_dear integer[];          -- 4 priciest — over-budget attempt
  v_dear_sum numeric;
  v_transfers integer;
  v_report text := '';
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
    raise exception 'SKIP all: nobody has a team for the active round yet.';
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
  -- Grabbed while still postgres — the impersonated player couldn't read this.
  select u.id into v_other from public.users u where u.id <> v_uid limit 1;

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
    v_report := v_report || E'\nFAIL 1: duplicate drivers were accepted';
  exception when others then
    v_report := v_report || E'\nPASS 1: duplicates rejected (' || sqlerrm || ')';
  end;

  -- 2. Writing to a locked/complete round must be rejected.
  if v_locked_round is null then
    v_report := v_report || E'\nSKIP 2: no completed round to test against.';
  else
    begin
      insert into public.user_teams (user_id, round_id, driver_ids, boost_driver_id)
      values (v_uid, v_locked_round, v_cheap, v_cheap[1]);
      v_report := v_report || E'\nFAIL 2: wrote a team into a completed round';
    exception when others then
      v_report := v_report || E'\nPASS 2: locked round rejected (' || sqlerrm || ')';
    end;
  end if;

  -- 3. Moving an existing row to another round must be rejected.
  if v_locked_round is null then
    v_report := v_report || E'\nSKIP 3: no completed round to test against.';
  else
    begin
      update public.user_teams set round_id = v_locked_round
       where user_id = v_uid and round_id = v_open_round;
      v_report := v_report || E'\nFAIL 3: moved a team between rounds';
    exception when others then
      v_report := v_report || E'\nPASS 3: round move rejected (' || sqlerrm || ')';
    end;
  end if;

  -- 4. Over-budget squad must be rejected (needs the top 4 to breach the cap).
  if v_dear_sum <= 40 then
    v_report := v_report
      || E'\nSKIP 4: top-4 prices sum to £' || v_dear_sum || 'M — cannot breach the cap.';
  else
    begin
      update public.user_teams
         set driver_ids = v_dear, boost_driver_id = v_dear[1]
       where user_id = v_uid and round_id = v_open_round;
      v_report := v_report || E'\nFAIL 4: over-budget team was accepted';
    exception when others then
      v_report := v_report || E'\nPASS 4: over-budget rejected (' || sqlerrm || ')';
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
    v_report := v_report || E'\nFAIL 5: client-supplied transfers_used was stored';
  else
    v_report := v_report
      || E'\nPASS 5: transfers_used recomputed to ' || v_transfers || ' (99 was sent)';
  end if;

  -- 6. A legitimate resave must still work (happy path unbroken).
  begin
    update public.user_teams
       set driver_ids = v_ids
     where user_id = v_uid and round_id = v_open_round;
    v_report := v_report || E'\nPASS 6: legitimate resave accepted';
  exception when others then
    v_report := v_report || E'\nFAIL 6: legitimate resave was rejected (' || sqlerrm || ')';
  end;

  -- 7. Writing another user's row must hit the ownership guard BEFORE any
  -- user_teams read — the specific message matters: the wildcard error here
  -- would mean the trigger leaked whether the victim spent their wildcard.
  if v_other is null then
    v_report := v_report || E'\nSKIP 7: only one user in the database.';
  else
    begin
      insert into public.user_teams
        (user_id, round_id, driver_ids, boost_driver_id, wildcard_used)
      values (v_other, v_open_round, v_cheap, v_cheap[1], true);
      v_report := v_report || E'\nFAIL 7: wrote a team for another user';
    exception when others then
      if sqlerrm like '%own team%' then
        v_report := v_report || E'\nPASS 7: cross-user write hit the ownership guard (' || sqlerrm || ')';
      elsif sqlerrm like '%wildcard%' then
        v_report := v_report || E'\nFAIL 7: wildcard state LEAKED across users (' || sqlerrm || ')';
      else
        v_report := v_report
          || E'\nFAIL 7: blocked, but not by the ownership guard — leak still possible ('
          || sqlerrm || ')';
      end if;
    end;
  end if;

  -- Unconditional: aborts the block, rolling back every test write, and is
  -- the only output channel the SQL editor reliably displays. (RAISE's format
  -- string can't be concatenated, hence USING message.)
  raise exception using message =
    e'\n== user_teams hardening verification — red box is expected =='
    || e'\n== every line should say PASS (SKIP is fine where noted) ==\n'
    || v_report;
end $$;
