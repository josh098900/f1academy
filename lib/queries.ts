import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/types";
import {
  type DriverSession,
  type SessionType,
  scoreDriverWeekend,
} from "@/lib/scoring";

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

export type SavedTeam = {
  driverIds: number[];
  boostDriverId: number;
  wildcardUsed: boolean;
};

// The user's saved pick for a round, if any (RLS scopes this to the user).
export async function getUserTeam(
  supabase: DB,
  userId: string,
  roundId: number
): Promise<SavedTeam | null> {
  const { data } = await supabase
    .from("user_teams")
    .select("driver_ids, boost_driver_id, wildcard_used")
    .eq("user_id", userId)
    .eq("round_id", roundId)
    .maybeSingle()
    .throwOnError();
  if (!data) return null;
  return {
    driverIds: data.driver_ids,
    boostDriverId: data.boost_driver_id,
    wildcardUsed: data.wildcard_used,
  };
}

export type TransferContext = {
  baseline: number[] | null; // previous round's squad — the transfer reference
  baselineBoost: number | null;
  wildcardUsedInPriorRound: boolean;
};

// Carry-over context for a round: the most recent prior round's team (the
// baseline transfers are counted against) and whether the season's wildcard
// has already been spent in an earlier round.
export async function getTransferContext(
  supabase: DB,
  userId: string,
  round: Pick<ActiveRound, "season_id" | "round_number">
): Promise<TransferContext> {
  const empty: TransferContext = {
    baseline: null,
    baselineBoost: null,
    wildcardUsedInPriorRound: false,
  };

  const { data: rounds } = await supabase
    .from("rounds")
    .select("id, round_number")
    .eq("season_id", round.season_id)
    .throwOnError();
  if (rounds.length === 0) return empty;

  const numberOf = new Map(rounds.map((r) => [r.id, r.round_number]));
  const { data: teams } = await supabase
    .from("user_teams")
    .select("round_id, driver_ids, boost_driver_id, wildcard_used")
    .eq("user_id", userId)
    .in(
      "round_id",
      rounds.map((r) => r.id)
    )
    .throwOnError();

  let best = -1;
  const ctx: TransferContext = { ...empty };
  for (const t of teams) {
    const num = numberOf.get(t.round_id) ?? -1;
    if (num >= round.round_number) continue; // only prior rounds
    if (t.wildcard_used) ctx.wildcardUsedInPriorRound = true;
    if (num > best) {
      best = num;
      ctx.baseline = t.driver_ids;
      ctx.baselineBoost = t.boost_driver_id;
    }
  }
  return ctx;
}

function surname(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1];
}

export type RoundRow = Database["public"]["Tables"]["rounds"]["Row"];
export type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];

export type LeagueSummary = {
  id: number;
  name: string;
  inviteCode: string;
  ownerId: string;
  memberCount: number;
};

// Leagues the user belongs to (RLS scopes this to their memberships).
export async function getUserLeagues(
  supabase: DB,
  userId: string
): Promise<LeagueSummary[]> {
  const { data } = await supabase
    .from("league_members")
    .select(
      "league:leagues(id, name, invite_code, owner_id, members:league_members(count))"
    )
    .eq("user_id", userId)
    .throwOnError();

  const leagues: LeagueSummary[] = [];
  for (const row of data) {
    const l = row.league;
    if (!l) continue;
    leagues.push({
      id: l.id,
      name: l.name,
      inviteCode: l.invite_code,
      ownerId: l.owner_id,
      memberCount: l.members?.[0]?.count ?? 0,
    });
  }
  return leagues.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getLeague(
  supabase: DB,
  leagueId: number
): Promise<LeagueSummary | null> {
  const { data } = await supabase
    .from("leagues")
    .select("id, name, invite_code, owner_id, members:league_members(count)")
    .eq("id", leagueId)
    .maybeSingle()
    .throwOnError();
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    inviteCode: data.invite_code,
    ownerId: data.owner_id,
    memberCount: data.members?.[0]?.count ?? 0,
  };
}

// League standings via the SECURITY DEFINER projection (members only).
export async function getLeagueStandings(
  supabase: DB,
  leagueId: number
): Promise<LeaderboardRow[]> {
  const { data } = await supabase
    .rpc("league_standings", { p_league: leagueId })
    .throwOnError();
  return (data ?? []).map((r) => ({
    rank: Number(r.rank),
    userId: r.user_id,
    displayName: r.display_name,
    total: r.total,
    roundsPlayed: 0,
  }));
}

export type LeaderboardRow = {
  rank: number;
  userId: string;
  displayName: string;
  total: number;
  roundsPlayed: number;
};

// Global standings (top N by cumulative points) — via the SECURITY DEFINER
// projection, so it can rank all players without exposing the users table.
export async function getGlobalLeaderboard(
  supabase: DB,
  limit = 100
): Promise<LeaderboardRow[]> {
  const { data } = await supabase
    .rpc("global_leaderboard", { p_limit: limit })
    .throwOnError();
  return (data ?? []).map((r) => ({
    rank: Number(r.rank),
    userId: r.user_id,
    displayName: r.display_name,
    total: r.total,
    roundsPlayed: Number(r.rounds_played),
  }));
}

// Whether the player has opted in to AI Coach insights. Default off — they
// turn it on from the Home account section.
export async function getCoachEnabled(
  supabase: DB,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("users")
    .select("coach_enabled")
    .eq("id", userId)
    .maybeSingle()
    .throwOnError();
  return data?.coach_enabled ?? false;
}

// The player's leaderboard name. Set on signup by handle_new_user (Google full
// name, OR email local-part as fallback); editable from the Home account
// section. Treated as required by the schema, so we always have a string.
export async function getDisplayName(
  supabase: DB,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle()
    .throwOnError();
  return data?.display_name ?? "";
}

// Lock-time email reminder opt-out. Defaults to true (most signups expect a
// transactional nudge before locks); the toggle lives next to Coach.
export async function getRemindersEnabled(
  supabase: DB,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("users")
    .select("reminders_enabled")
    .eq("id", userId)
    .maybeSingle()
    .throwOnError();
  return data?.reminders_enabled ?? true;
}

export type Announcement = {
  id: number;
  title: string | null;
  body: string;
  pinned: boolean;
  createdAt: string;
};

// Admin-authored news, pinned first then newest. `limit` caps the dashboard
// card; omit for the full /news page.
export async function getAnnouncements(
  supabase: DB,
  limit?: number
): Promise<Announcement[]> {
  let query = supabase
    .from("announcements")
    .select("id, title, body, pinned, created_at")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (limit) query = query.limit(limit);
  const { data } = await query.throwOnError();
  return (data ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    pinned: a.pinned,
    createdAt: a.created_at,
  }));
}

export async function getCurrentSeason(supabase: DB) {
  const { data } = await supabase
    .from("seasons")
    .select("id, year")
    .eq("is_current", true)
    .maybeSingle()
    .throwOnError();
  return data;
}

export async function getAllRounds(
  supabase: DB,
  seasonId: number
): Promise<RoundRow[]> {
  const { data } = await supabase
    .from("rounds")
    .select("*")
    .eq("season_id", seasonId)
    .order("round_number", { ascending: true })
    .throwOnError();
  return data;
}

export async function getRoundSessions(
  supabase: DB,
  roundId: number
): Promise<SessionRow[]> {
  const { data } = await supabase
    .from("sessions")
    .select("*")
    .eq("round_id", roundId)
    .throwOnError();
  // qualifying first, then races in order.
  const order = ["qualifying", "race1", "race2", "race3"];
  return data.sort(
    (a, b) => order.indexOf(a.session_type) - order.indexOf(b.session_type)
  );
}

export type Entrant = {
  driverId: number;
  fullName: string;
  shortName: string;
  carNumber: number | null;
  isWildcard: boolean;
};

// Drivers racing a given round (full-season always; wildcards only their
// rounds). No price needed — used for results entry on historical rounds too.
export async function getRoundEntrants(
  supabase: DB,
  round: Pick<RoundRow, "season_id" | "round_number">
): Promise<Entrant[]> {
  const { data } = await supabase
    .from("season_entries")
    .select(
      "car_number, is_wildcard, rounds, driver:drivers(id, full_name, short_name)"
    )
    .eq("season_id", round.season_id)
    .throwOnError();

  const entrants: Entrant[] = [];
  for (const e of data) {
    if (!e.driver) continue;
    if (e.is_wildcard && !(e.rounds ?? []).includes(round.round_number)) continue;
    entrants.push({
      driverId: e.driver.id,
      fullName: e.driver.full_name,
      shortName: e.driver.short_name,
      carNumber: e.car_number,
      isWildcard: e.is_wildcard,
    });
  }
  return entrants.sort((a, b) => (a.carNumber ?? 999) - (b.carNumber ?? 999));
}

export type ResultRow = {
  driverId: number;
  position: number | null;
  gridPosition: number | null;
  status: "classified" | "dnf" | "dsq" | "dns";
  fastestLap: boolean;
};

export async function getSessionResults(
  supabase: DB,
  sessionId: number
): Promise<ResultRow[]> {
  const { data } = await supabase
    .from("session_results")
    .select("driver_id, position, grid_position, status, fastest_lap")
    .eq("session_id", sessionId)
    .throwOnError();
  return data.map((r) => ({
    driverId: r.driver_id,
    position: r.position,
    gridPosition: r.grid_position,
    status: r.status as ResultRow["status"],
    fastestLap: r.fastest_lap,
  }));
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

export type DriverRoundResult = {
  roundNumber: number;
  circuitName: string;
  points: number;
  sessions: { type: SessionType; position: number | null; fastestLap: boolean }[];
};

export type DriverProfile = {
  driverId: number;
  fullName: string;
  shortName: string;
  lastName: string;
  countryCode: string | null;
  avatarUrl: string | null;
  wikipediaUrl: string | null;
  carNumber: number | null;
  team: string | null;
  f1Partner: string | null;
  price: number | null; // active round, if priced
  seasonPoints: number;
  history: DriverRoundResult[];
};

// A driver's season profile: identity, F1-partner entry, current price, and
// per-round fantasy points from completed rounds. Powers /drivers/[id] and the
// Coach's driver-take. Reads public tables only.
export async function getDriverProfile(
  supabase: DB,
  driverId: number
): Promise<DriverProfile | null> {
  const { data: driver } = await supabase
    .from("drivers")
    .select(
      "id, full_name, short_name, country_code, avatar_url, wikipedia_url"
    )
    .eq("id", driverId)
    .maybeSingle()
    .throwOnError();
  if (!driver) return null;

  const season = await getCurrentSeason(supabase);

  const { data: entry } = season
    ? await supabase
        .from("season_entries")
        .select("car_number, f1_partner_team, team:teams(name)")
        .eq("season_id", season.id)
        .eq("driver_id", driverId)
        .maybeSingle()
        .throwOnError()
    : { data: null };

  // Current price = the active (next upcoming) round's price, if set.
  const active = await getActiveRound(supabase);
  let price: number | null = null;
  if (active) {
    const { data: p } = await supabase
      .from("driver_prices")
      .select("price_millions")
      .eq("round_id", active.id)
      .eq("driver_id", driverId)
      .maybeSingle()
      .throwOnError();
    price = p ? Number(p.price_millions) : null;
  }

  const history: DriverRoundResult[] = [];
  let seasonPoints = 0;

  if (season) {
    const { data: rounds } = await supabase
      .from("rounds")
      .select("id, round_number, circuit_name")
      .eq("season_id", season.id)
      .eq("status", "complete")
      .order("round_number", { ascending: true })
      .throwOnError();

    for (const round of rounds) {
      const { data: sessions } = await supabase
        .from("sessions")
        .select("id, session_type")
        .eq("round_id", round.id)
        .throwOnError();
      if (sessions.length === 0) continue;
      const typeOf = new Map(sessions.map((s) => [s.id, s.session_type]));

      const { data: results } = await supabase
        .from("session_results")
        .select("session_id, position, grid_position, status, fastest_lap")
        .eq("driver_id", driverId)
        .in(
          "session_id",
          sessions.map((s) => s.id)
        )
        .throwOnError();
      if (results.length === 0) continue;

      const driverSessions: DriverSession[] = [];
      const summary: DriverRoundResult["sessions"] = [];
      for (const r of results) {
        const type = typeOf.get(r.session_id);
        if (!type) continue;
        driverSessions.push({
          type: type as DriverSession["type"],
          position: r.position,
          gridPosition: r.grid_position,
          status: r.status as DriverSession["status"],
          fastestLap: r.fastest_lap,
        });
        summary.push({
          type: type as SessionType,
          position: r.position,
          fastestLap: r.fastest_lap,
        });
      }

      const points = scoreDriverWeekend({ sessions: driverSessions }).base;
      seasonPoints += points;
      const order = ["qualifying", "race1", "race2", "race3"];
      summary.sort(
        (a, b) => order.indexOf(a.type) - order.indexOf(b.type)
      );
      history.push({
        roundNumber: round.round_number,
        circuitName: round.circuit_name ?? `Round ${round.round_number}`,
        points,
        sessions: summary,
      });
    }
  }

  return {
    driverId: driver.id,
    fullName: driver.full_name,
    shortName: driver.short_name,
    lastName: surname(driver.full_name),
    countryCode: driver.country_code,
    avatarUrl: driver.avatar_url,
    wikipediaUrl: driver.wikipedia_url,
    carNumber: entry?.car_number ?? null,
    team: entry?.team?.name ?? null,
    f1Partner: entry?.f1_partner_team ?? null,
    price,
    seasonPoints,
    history,
  };
}
