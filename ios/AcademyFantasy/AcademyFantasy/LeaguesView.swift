import Supabase
import SwiftUI

// The leagues you're in, and each one's standings. Both are direct,
// RLS-scoped reads: `league_members` embedding `leagues` gives you exactly
// your leagues, and `league_standings` is a members-only SECURITY DEFINER
// projection — the same data the website shows.
struct LeaguesView: View {
  @State private var leagues: [League] = []
  @State private var loading = true

  var body: some View {
    NavigationStack {
      Group {
        if loading {
          ProgressView()
        } else if leagues.isEmpty {
          VStack(spacing: 8) {
            Image(systemName: "person.3")
              .font(.largeTitle)
              .foregroundStyle(.secondary)
            Text("No leagues yet")
              .font(.headline)
            Text("Join a league on the website to see it here.")
              .font(.footnote)
              .foregroundStyle(.secondary)
              .multilineTextAlignment(.center)
          }
          .padding()
        } else {
          List(leagues) { league in
            NavigationLink(league.name) {
              LeagueStandingsView(league: league)
            }
          }
        }
      }
      .navigationTitle("Leagues")
      .task { await load() }
      .refreshable { await load() }
    }
  }

  func load() async {
    loading = true
    defer { loading = false }
    do {
      let userId = try await supabase.auth.session.user.id
      let memberships: [LeagueMembership] = try await supabase
        .from("league_members")
        .select("leagues(id, name)")
        .eq("user_id", value: userId.uuidString)
        .execute()
        .value
      leagues = memberships.map(\.leagues).sorted { $0.name < $1.name }
    } catch {
      leagues = []
    }
  }
}

struct LeagueStandingsView: View {
  let league: League
  @EnvironmentObject var auth: AuthManager
  @State private var rows: [StandingRow] = []
  @State private var loading = true

  var body: some View {
    ScrollView {
      LazyVStack(spacing: 0) {
        ForEach(rows) { row in
          StandingRowView(row: row, isMe: row.userId == auth.userId)
        }
      }
    }
    .background(Theme.Palette.base)
    .overlay {
      if loading { ProgressView().tint(Theme.Palette.accent) }
    }
    .navigationTitle(league.name)
    .navigationBarTitleDisplayMode(.inline)
    .task { await load() }
    .refreshable { await load() }
  }

  func load() async {
    loading = true
    defer { loading = false }
    do {
      rows = try await supabase
        .rpc("league_standings", params: ["p_league": league.id])
        .execute()
        .value
    } catch {
      rows = []
    }
  }
}
