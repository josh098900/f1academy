-- Coach insights can be global (shared by everyone) or per-user. Pre-race reads
-- and driver takes are the same for all players, so they're stored once with a
-- null user_id; post-race recaps stay per-user. Inserts remain service-role-only.

alter table public.coach_insights alter column user_id drop not null;

drop policy if exists "read own insights" on public.coach_insights;
create policy "read own or global insights" on public.coach_insights
  for select to authenticated
  using (user_id = (select auth.uid()) or user_id is null);
