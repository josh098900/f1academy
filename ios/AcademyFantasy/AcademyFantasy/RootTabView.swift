import SwiftUI

// The signed-in shell. Read-only tabs for now; the Paddock and the fantasy
// team (which need the write API) join later.
struct RootTabView: View {
  var body: some View {
    TabView {
      MyTeamView()
        .tabItem { Label("Team", systemImage: "flag.checkered") }
      LeaderboardView()
        .tabItem { Label("Leaderboard", systemImage: "trophy") }
      LeaguesView()
        .tabItem { Label("Leagues", systemImage: "person.3") }
    }
  }
}
