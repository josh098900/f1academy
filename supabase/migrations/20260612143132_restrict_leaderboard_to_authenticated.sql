-- Security: stop anonymous callers reading the player roster.
--
-- global_leaderboard was granted EXECUTE to `anon`, so anyone with the public
-- publishable key (it ships in the JS bundle) could call the RPC without
-- logging in and enumerate every player's display name, point total, and
-- internal user UUID. The app never uses anonymous access — /leaderboard is
-- behind auth and the public landing page only reads the round schedule — so
-- this exposure has no functional upside.
--
-- Restrict to authenticated. Also revoke from PUBLIC: Postgres grants EXECUTE
-- on functions to PUBLIC by default, and `anon` is a member of PUBLIC, so the
-- explicit anon revoke alone wouldn't be enough. authenticated keeps its own
-- explicit grant (re-asserted below); service_role / owner are unaffected.
-- Idempotent — revoking an absent grant warns but succeeds.

revoke execute on function public.global_leaderboard(integer) from anon, public;

grant execute on function public.global_leaderboard(integer) to authenticated;
