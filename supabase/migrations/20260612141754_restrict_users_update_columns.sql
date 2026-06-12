-- Security: stop users escalating themselves to admin.
--
-- RLS is row-level, not column-level. The "update own user" policy restricts
-- WHICH ROW a user can edit, but Supabase's default table-wide UPDATE grant to
-- `authenticated` let them edit ANY column on that row — including is_admin.
-- A logged-in user could flip their own is_admin from the browser console and
-- take over the admin panel (results entry + scoring), corrupting standings.
--
-- Fix: revoke the table-wide UPDATE and re-grant UPDATE only on the columns a
-- user legitimately self-edits. is_admin is intentionally excluded — it's only
-- ever read (lib/admin.ts) and is set by the service role / owner.
--
-- Safe + non-breaking:
--   * The three self-update server actions only touch the granted columns
--     (display_name, coach_enabled, reminders_enabled).
--   * updated_at is maintained by the set_updated_at BEFORE trigger; column
--     privilege is checked against the user's SET clause, not trigger writes,
--     so it needs no grant.
--   * handle_new_user (INSERT) and the SECURITY DEFINER leaderboard functions
--     run as owner and are unaffected; service_role keeps full access.
--
-- Idempotent (REVOKE of an absent privilege warns but succeeds; GRANT of an
-- existing one is a no-op). This mirrors a hotfix already applied directly to
-- production via the Supabase SQL editor; the migration captures it so the repo
-- matches prod and a rebuilt/reset database stays protected.

revoke update on public.users from anon, authenticated;

grant update (display_name, favourite_team_id, coach_enabled, reminders_enabled)
  on public.users to authenticated;
