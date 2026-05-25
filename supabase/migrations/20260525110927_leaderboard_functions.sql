-- Leaderboard projections via SECURITY DEFINER functions. They expose only
-- display_name + points — never emails or the full users table — so the global
-- board can show everyone and league standings can show league-mates without
-- relaxing the strict own-row-only RLS on public.users.
--
-- A user's current total is the cumulative_points of their latest scored round.

create or replace function public.global_leaderboard(p_limit integer default 100)
returns table (
  rank bigint,
  user_id uuid,
  display_name text,
  total integer,
  rounds_played bigint
)
language sql
security definer
set search_path = ''
stable
as $$
  with latest as (
    select distinct on (us.user_id)
      us.user_id,
      us.cumulative_points as total
    from public.user_scores us
    join public.rounds r on r.id = us.round_id
    order by us.user_id, r.round_number desc
  ),
  played as (
    select user_id, count(*)::bigint as rounds_played
    from public.user_scores
    group by user_id
  )
  select
    rank() over (order by l.total desc) as rank,
    l.user_id,
    u.display_name,
    l.total,
    p.rounds_played
  from latest l
  join public.users u on u.id = l.user_id
  join played p on p.user_id = l.user_id
  order by l.total desc
  limit greatest(1, least(p_limit, 500));
$$;

grant execute on function public.global_leaderboard(integer) to anon, authenticated;

-- League standings — returns rows only when the caller is a member of the
-- league, and includes every member (0 until they're scored).
create or replace function public.league_standings(p_league integer)
returns table (
  rank bigint,
  user_id uuid,
  display_name text,
  total integer
)
language sql
security definer
set search_path = ''
stable
as $$
  with member_check as (
    select 1
    from public.league_members
    where league_id = p_league and user_id = (select auth.uid())
  ),
  members as (
    select user_id from public.league_members where league_id = p_league
  ),
  latest as (
    select distinct on (us.user_id)
      us.user_id,
      us.cumulative_points as total
    from public.user_scores us
    join public.rounds r on r.id = us.round_id
    order by us.user_id, r.round_number desc
  )
  select
    rank() over (order by coalesce(l.total, 0) desc) as rank,
    m.user_id,
    u.display_name,
    coalesce(l.total, 0) as total
  from members m
  join public.users u on u.id = m.user_id
  left join latest l on l.user_id = m.user_id
  where exists (select 1 from member_check)
  order by total desc;
$$;

grant execute on function public.league_standings(integer) to authenticated;
