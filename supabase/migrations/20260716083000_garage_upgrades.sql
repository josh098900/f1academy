-- The garage opens: car components go from a 0-10 placeholder to the real
-- progression scale, and buying a level becomes an atomic, race-proof write.
--
-- Levels run 0-25: five tiers (Bronze, Silver, Gold, Platinum, Diamond) of
-- five levels each. The tier boundaries, the coin costs, and the level->stat
-- curve all live in code (lib/paddock/garage.ts) — the database only ever
-- stores WHERE the player is, never what it's worth, so rebalancing the
-- economy stays a deploy rather than a data migration.

alter table public.paddock_teams
  drop constraint paddock_teams_car_power_check,
  drop constraint paddock_teams_car_aero_check,
  drop constraint paddock_teams_car_reliability_check,
  drop constraint paddock_teams_car_pit_crew_check,
  add constraint paddock_teams_car_power_check check (car_power between 0 and 25),
  add constraint paddock_teams_car_aero_check check (car_aero between 0 and 25),
  add constraint paddock_teams_car_reliability_check check (car_reliability between 0 and 25),
  add constraint paddock_teams_car_pit_crew_check check (car_pit_crew between 0 and 25);

-- One purchase, one atomic compare-and-swap. The server action computes the
-- price from the CURRENT level (the cost table lives in code); this function
-- only goes through if the row still shows that level and the coins cover it
-- — so two rapid clicks (or two tabs) can't buy level N twice at level N's
-- price, and a balance can never go negative. Zero rows updated = the world
-- moved; the action tells the player to try again.
create function public.buy_paddock_upgrade(
  p_user_id uuid,
  p_component text,
  p_from_level smallint,
  p_cost integer
) returns table (
  coins integer,
  car_power smallint,
  car_aero smallint,
  car_reliability smallint,
  car_pit_crew smallint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_component not in ('power', 'aero', 'reliability', 'pit_crew') then
    raise exception 'Unknown component %', p_component;
  end if;
  if p_cost < 0 then
    raise exception 'Negative cost';
  end if;

  return query
  update public.paddock_teams t
     set coins = t.coins - p_cost,
         car_power = t.car_power
           + case when p_component = 'power' then 1 else 0 end,
         car_aero = t.car_aero
           + case when p_component = 'aero' then 1 else 0 end,
         car_reliability = t.car_reliability
           + case when p_component = 'reliability' then 1 else 0 end,
         car_pit_crew = t.car_pit_crew
           + case when p_component = 'pit_crew' then 1 else 0 end
   where t.user_id = p_user_id
     and t.coins >= p_cost
     and case p_component
           when 'power' then t.car_power
           when 'aero' then t.car_aero
           when 'reliability' then t.car_reliability
           when 'pit_crew' then t.car_pit_crew
         end = p_from_level
     and p_from_level < 25
  returning t.coins, t.car_power, t.car_aero, t.car_reliability, t.car_pit_crew;
end;
$$;

-- Service-role only, same pattern as settle_paddock_race: a player JWT
-- cannot reach the till directly.
revoke all on function public.buy_paddock_upgrade(uuid, text, smallint, integer) from public;
revoke all on function public.buy_paddock_upgrade(uuid, text, smallint, integer) from anon;
revoke all on function public.buy_paddock_upgrade(uuid, text, smallint, integer) from authenticated;
grant execute on function public.buy_paddock_upgrade(uuid, text, smallint, integer) to service_role;
