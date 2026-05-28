-- Per-user toggle for AI Coach insights. Default off — players opt in via the
-- Home account section. Existing rows backfill to false courtesy of the
-- default; RLS already lets users update their own row.
alter table public.users
  add column coach_enabled boolean not null default false;
