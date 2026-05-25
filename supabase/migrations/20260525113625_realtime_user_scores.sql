-- Enable Supabase Realtime for user_scores so leaderboards refresh live when a
-- round is scored. Idempotent. RLS still applies to realtime events, so a client
-- receives changes only for rows it can read (enough to trigger a re-fetch).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_scores'
  ) then
    alter publication supabase_realtime add table public.user_scores;
  end if;
end $$;
