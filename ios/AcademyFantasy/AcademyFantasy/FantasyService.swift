import Foundation
import Supabase

// The fantasy-team data layer. Reads go direct to Supabase under RLS; the
// SAVE (chunk 3) will POST to the Next API. Centralising the queries here
// keeps the views thin and gives the write a natural home next to the reads
// it depends on.
enum FantasyService {
  // Mirrors the server-side rules (BUDGET_CAP, SQUAD_SIZE) for display only —
  // the server is the source of truth and re-validates every save.
  static let budgetCap = 40.0
  static let squadSize = 4

  // The round currently open for selection: the earliest 'upcoming' round,
  // matching getActiveRound() on the server.
  static func activeRound() async throws -> Round? {
    let rows: [Round] = try await supabase
      .from("rounds")
      .select("id, round_number, country, circuit_name, lock_time")
      .eq("status", value: "upcoming")
      .order("round_number", ascending: true)
      .limit(1)
      .execute()
      .value
    return rows.first
  }

  // Every driver priced for the round, with names — the pool you pick from.
  static func lineup(roundId: Int) async throws -> [PricedDriver] {
    try await supabase
      .from("driver_prices")
      .select("driver_id, price_millions, drivers(full_name, short_name)")
      .eq("round_id", value: roundId)
      .order("price_millions", ascending: false)
      .execute()
      .value
  }

  // The signed-in user's saved pick for the round, if any. RLS scopes
  // user_teams to the caller; we filter by the session user too.
  static func myTeam(roundId: Int) async throws -> SavedTeam? {
    let userId = try await supabase.auth.session.user.id
    let rows: [SavedTeam] = try await supabase
      .from("user_teams")
      .select("driver_ids, boost_driver_id")
      .eq("round_id", value: roundId)
      .eq("user_id", value: userId.uuidString)
      .limit(1)
      .execute()
      .value
    return rows.first
  }
}
