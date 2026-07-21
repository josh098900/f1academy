import Foundation

// The row shared by every standings screen. The global leaderboard and a
// league's standings return the same shape (global_leaderboard also sends
// rounds_played, which Codable simply ignores), so one model serves both.
struct StandingRow: Codable, Identifiable {
  let rank: Int
  let userId: String
  let displayName: String?
  let total: Int

  var id: String { userId }

  enum CodingKeys: String, CodingKey {
    case rank
    case userId = "user_id"
    case displayName = "display_name"
    case total
  }
}

// A league the player belongs to. Read via `league_members` embedding
// `leagues`, so PostgREST returns it nested under the `leagues` key.
struct League: Codable, Identifiable {
  let id: Int
  let name: String
}

struct LeagueMembership: Codable {
  let leagues: League
}
