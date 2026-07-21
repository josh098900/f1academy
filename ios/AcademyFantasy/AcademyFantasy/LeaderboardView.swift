import Supabase
import SwiftUI

struct LeaderboardView: View {
  @EnvironmentObject var auth: AuthManager
  @State private var rows: [StandingRow] = []
  @State private var loading = true
  @State private var errorText: String?

  var body: some View {
    NavigationStack {
      ScrollView {
        LazyVStack(spacing: 0) {
          ForEach(rows) { row in
            StandingRowView(row: row, isMe: row.userId == auth.userId)
          }
        }
      }
      .background(Theme.Palette.base)
      .overlay {
        if loading {
          ProgressView().tint(Theme.Palette.accent)
        }
      }
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
