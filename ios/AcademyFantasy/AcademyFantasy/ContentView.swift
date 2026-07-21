import SwiftUI

struct ContentView: View {
  @EnvironmentObject var auth: AuthManager
  var body: some View {
    Group {
      if auth.isSignedIn {
        LeaderboardView()
      } else {
        LoginView()
      }
    }
    .task { await auth.restore() }
  }
}
