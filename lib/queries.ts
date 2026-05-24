import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/types";

type DB = SupabaseClient<Database>;

export type ActiveRound = Database["public"]["Tables"]["rounds"]["Row"];

export type LineupDriver = {
  driverId: number;
  fullName: string;
  shortName: string;
  lastName: string;
  countryCode: string | null;
  avatarUrl: string | null;
  carNumber: number | null;
  team: string;
  f1Partner: string | null;
  isWildcard: boolean;
  price: number;
};

// The round currently open for team selection: the earliest upcoming round.
// Null if the season is over (nothing upcoming).
export async function getActiveRound(supabase: DB): Promise<ActiveRound | null> {
  const { data } = await supabase
    .from("rounds")
    .select("*")
    .eq("status", "upcoming")
    .order("round_number", { ascending: true })
    .limit(1)
    .maybeSingle()
    .throwOnError();
  return data;
}

export type SavedTeam = { driverIds: number[]; boostDriverId: number };

// The user's saved pick for a round, if any (RLS scopes this to the user).
export async function getUserTeam(
  supabase: DB,
  userId: string,
  roundId: number
): Promise<SavedTeam | null> {
  const { data } = await supabase
    .from("user_teams")
    .select("driver_ids, boost_driver_id")
    .eq("user_id", userId)
    .eq("round_id", roundId)
    .maybeSingle()
    .throwOnError();
  if (!data) return null;
  return { driverIds: data.driver_ids, boostDriverId: data.boost_driver_id };
}

function surname(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1];
}

// Pickable drivers for a round, with that round's price. Full-season drivers are
// available every round; wildcards only in the rounds they're contracted for.
export async function getRoundLineup(
  supabase: DB,
  round: Pick<ActiveRound, "id" | "season_id" | "round_number">
): Promise<LineupDriver[]> {
  const { data: entries } = await supabase
    .from("season_entries")
    .select(
      "car_number, f1_partner_team, is_wildcard, rounds, driver:drivers(id, full_name, short_name, country_code, avatar_url), team:teams(name)"
    )
    .eq("season_id", round.season_id)
    .throwOnError();

  const { data: prices } = await supabase
    .from("driver_prices")
    .select("driver_id, price_millions")
    .eq("round_id", round.id)
    .throwOnError();

  const priceByDriver = new Map(prices.map((p) => [p.driver_id, Number(p.price_millions)]));

  const lineup: LineupDriver[] = [];
  for (const e of entries) {
    if (!e.driver || !e.team) continue;
    const available = !e.is_wildcard || (e.rounds ?? []).includes(round.round_number);
    if (!available) continue;
    const price = priceByDriver.get(e.driver.id);
    if (price === undefined) continue; // no price set for this round yet

    lineup.push({
      driverId: e.driver.id,
      fullName: e.driver.full_name,
      shortName: e.driver.short_name,
      lastName: surname(e.driver.full_name),
      countryCode: e.driver.country_code,
      avatarUrl: e.driver.avatar_url,
      carNumber: e.car_number,
      team: e.team.name,
      f1Partner: e.f1_partner_team,
      isWildcard: e.is_wildcard,
      price,
    });
  }

  // Most expensive first — the stars lead the grid.
  lineup.sort((a, b) => b.price - a.price || a.lastName.localeCompare(b.lastName));
  return lineup;
}
