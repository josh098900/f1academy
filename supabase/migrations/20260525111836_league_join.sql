-- Join a league by invite code. SECURITY DEFINER so a non-member can look up
-- the league (the strict RLS on leagues only lets members read it). Enforces
-- the 5-league cap. Idempotent — joining a league you're already in is a no-op.
create or replace function public.join_league(p_code text)
returns table (id integer, name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_league public.leagues%rowtype;
  v_count integer;
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = 'P0001';
  end if;

  select * into v_league from public.leagues where invite_code = upper(p_code);
  if not found then
    raise exception 'No league with that code' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.league_members
    where league_id = v_league.id and user_id = v_uid
  ) then
    select count(*) into v_count from public.league_members where user_id = v_uid;
    if v_count >= 5 then
      raise exception 'You can only join up to 5 leagues' using errcode = 'P0003';
    end if;
    insert into public.league_members (league_id, user_id) values (v_league.id, v_uid);
  end if;

  return query select v_league.id, v_league.name;
end;
$$;

grant execute on function public.join_league(text) to authenticated;
