-- Driver contracts: the roster gate (P4 chunk 3).
--
-- Josh's design: everyone starts with the four lowest-rated drivers free,
-- and works up — better drivers unlock by RANK (the garage you've built)
-- and cost coins to sign. A signed contract is permanent: reality may move
-- her rating, but she stays on your books.
--
-- Which drivers are free, what the bands cost, and which rank opens which
-- band all live in code (lib/paddock/roster.ts) — same balance-as-data rule
-- as the garage. The database stores only the fact of a signature.

create table public.paddock_contracts (
  user_id uuid not null references public.users(id) on delete cascade,
  driver_id integer not null references public.drivers(id),
  cost integer not null check (cost >= 0),
  signed_at timestamptz not null default now(),
  primary key (user_id, driver_id)
);

alter table public.paddock_contracts enable row level security;

-- Read your own contracts; writing happens below as the service role only.
create policy "paddock_contracts_select_own"
  on public.paddock_contracts for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- One signature, one atomic transaction: the coins come off and the contract
-- lands together. The primary key makes a double-sign an exception, which
-- rolls the deduction back with it — a double-click signs once and pays
-- once. Zero rows from the coin update means the balance didn't cover it.
create function public.sign_paddock_driver(
  p_user_id uuid,
  p_driver_id integer,
  p_cost integer
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
begin
  if p_cost < 0 then
    raise exception 'Negative cost';
  end if;

  update public.paddock_teams t
     set coins = t.coins - p_cost
   where t.user_id = p_user_id
     and t.coins >= p_cost
  returning t.coins into v_balance;

  if v_balance is null then
    raise exception 'INSUFFICIENT_COINS';
  end if;

  insert into public.paddock_contracts (user_id, driver_id, cost)
  values (p_user_id, p_driver_id, p_cost);

  return v_balance;
end;
$$;

-- Service-role only, same pattern as the settle and buy functions.
revoke all on function public.sign_paddock_driver(uuid, integer, integer) from public;
revoke all on function public.sign_paddock_driver(uuid, integer, integer) from anon;
revoke all on function public.sign_paddock_driver(uuid, integer, integer) from authenticated;
grant execute on function public.sign_paddock_driver(uuid, integer, integer) to service_role;
