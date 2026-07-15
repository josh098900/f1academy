-- Staff investments: the team-principal layer (P4 chunk 4).
--
-- The pact behind the whole roster design: real drivers' ratings are DERIVED
-- from real results and never "trained". What the player upgrades is the
-- TEAM around her — a race engineer (consistency), a simulator programme
-- (pace), a data analyst (racecraft) — bonuses that sit on top of whichever
-- driver is in the car. The eng_* columns (0-10) have existed since the
-- first paddock migration; this extends the buy function to reach them.
--
-- Same compare-and-swap contract as car parts: the row must still show the
-- level the server priced, the coins must cover it, and each component has
-- its own ceiling (car parts 25, staff 10).

-- The return table grows the staff columns, and Postgres refuses to change
-- a function's return type in place — drop and recreate.
drop function public.buy_paddock_upgrade(uuid, text, smallint, integer);

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
  car_pit_crew smallint,
  eng_race_engineer smallint,
  eng_simulator smallint,
  eng_data_analyst smallint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_component not in (
    'power', 'aero', 'reliability', 'pit_crew',
    'race_engineer', 'simulator', 'data_analyst'
  ) then
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
           + case when p_component = 'pit_crew' then 1 else 0 end,
         eng_race_engineer = t.eng_race_engineer
           + case when p_component = 'race_engineer' then 1 else 0 end,
         eng_simulator = t.eng_simulator
           + case when p_component = 'simulator' then 1 else 0 end,
         eng_data_analyst = t.eng_data_analyst
           + case when p_component = 'data_analyst' then 1 else 0 end
   where t.user_id = p_user_id
     and t.coins >= p_cost
     and case p_component
           when 'power' then t.car_power
           when 'aero' then t.car_aero
           when 'reliability' then t.car_reliability
           when 'pit_crew' then t.car_pit_crew
           when 'race_engineer' then t.eng_race_engineer
           when 'simulator' then t.eng_simulator
           when 'data_analyst' then t.eng_data_analyst
         end = p_from_level
     and p_from_level < case
           when p_component in ('power', 'aero', 'reliability', 'pit_crew')
             then 25
           else 10
         end
  returning t.coins, t.car_power, t.car_aero, t.car_reliability,
            t.car_pit_crew, t.eng_race_engineer, t.eng_simulator,
            t.eng_data_analyst;
end;
$$;

-- A freshly created function gets default grants — lock the till back to
-- service-role only.
revoke all on function public.buy_paddock_upgrade(uuid, text, smallint, integer) from public;
revoke all on function public.buy_paddock_upgrade(uuid, text, smallint, integer) from anon;
revoke all on function public.buy_paddock_upgrade(uuid, text, smallint, integer) from authenticated;
grant execute on function public.buy_paddock_upgrade(uuid, text, smallint, integer) to service_role;
