//
//  LeaderboardView.swift
//  AcademyFantasy
//
//  Created by Joshua Mathers on 21/07/2026.
//

import Supabase
import SwiftUI

// The RPC's return shape, one row per player. bigint columns arrive as JSON
// numbers; Int decodes them fine at this scale.
struct LeaderboardRow: Codable, Identifiable {
  let rank: Int
  let userId: String
  let displayName: String?
  let total: Int
  let roundsPlayed: Int

  var id: String { userId }

  enum CodingKeys: String, CodingKey {
    case rank
    case userId = "user_id"
    case displayName = "display_name"
    case total
    case roundsPlayed = "rounds_played"
  }
}

struct LeaderboardView: View {
  @EnvironmentObject var auth: AuthManager
  @State private var rows: [LeaderboardRow] = []
  @State private var loading = true
  @State private var errorText: String?

  var body: some View {
    NavigationStack {
      List(rows) { row in
        HStack {
          Text("\(row.rank)")
            .frame(width: 32, alignment: .leading)
            .foregroundStyle(.secondary)
          Text(row.displayName ?? "—")
          Spacer()
          Text("\(row.total)").monospacedDigit().bold()
        }
      }
      .overlay { if loading { ProgressView() } }
      .navigationTitle("Leaderboard")
      .toolbar {
        Button("Sign out") { Task { await auth.signOut() } }
      }
      .task { await load() }
      .refreshable { await load() }
    }
  }

  // The authenticated RPC call. The SDK attaches the session's JWT, so the
  // `authenticated`-only grant is satisfied and RLS/SECURITY DEFINER do the
  // rest — the same board the website renders.
  func load() async {
    loading = true
    defer { loading = false }
    do {
      rows = try await supabase
        .rpc("global_leaderboard", params: ["p_limit": 100])
        .execute()
        .value
    } catch {
      errorText = error.localizedDescription
    }
  }
}
