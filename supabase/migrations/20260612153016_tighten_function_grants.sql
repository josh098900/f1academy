-- Tighten function security (Supabase advisor 0011, 0028, 0029).
--
-- (1) Pin set_updated_at's search_path. A mutable search_path lets a caller
--     shadow unqualified names; all our other functions already set it.
alter function public.set_updated_at() set search_path = '';

-- (2) Lock down EXECUTE on SECURITY DEFINER functions. Postgres grants EXECUTE
--     to PUBLIC on every function at creation, which is why `anon` can reach
--     them via /rest/v1/rpc/*. Revoke that and re-grant only where needed.

-- Trigger function — never meant to be called as an RPC. Triggers fire
-- regardless of EXECUTE grants, so revoke from everyone.
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- RLS helper functions. authenticated MUST keep EXECUTE — the policies on
-- user_teams / user_scores / league_members / leagues call them during
-- evaluation, and revoking it would break those reads. Just drop anon/PUBLIC.
revoke execute on function public.shares_league_with(uuid) from anon, public;
grant execute on function public.shares_league_with(uuid) to authenticated;
revoke execute on function public.is_league_member(integer) from anon, public;
grant execute on function public.is_league_member(integer) to authenticated;

-- Intentional authenticated-only RPCs. They already guard on auth.uid()
-- internally, but drop the implicit anon/PUBLIC grant so they're not callable
-- signed-out at all.
revoke execute on function public.join_league(text) from anon, public;
grant execute on function public.join_league(text) to authenticated;
revoke execute on function public.league_standings(integer) from anon, public;
grant execute on function public.league_standings(integer) to authenticated;

-- Note: the remaining 0029 ("authenticated can execute") warnings for
-- global_leaderboard, join_league, league_standings, shares_league_with and
-- is_league_member are by design — those are intentional RPCs or RLS helpers
-- that signed-in users legitimately need. rls_auto_enable is NOT created by
-- these migrations and is handled out-of-band.
