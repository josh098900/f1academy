-- Backfill public.users for any auth user created before the handle_new_user
-- trigger existed (the trigger only fires on new signups). Idempotent.
insert into public.users (id, display_name)
select
  u.id,
  coalesce(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    split_part(u.email, '@', 1)
  )
from auth.users u
where not exists (select 1 from public.users p where p.id = u.id);
