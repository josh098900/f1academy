import SwiftUI

struct ContentView: View {
  @EnvironmentObject var auth: AuthManager
  @State private var showSplash = true

  var body: some View {
    ZStack {
      Group {
        if auth.isSignedIn {
          RootTabView()
        } else {
          LoginView()
        }
      }
      .task { await auth.restore() }

      if showSplash {
        SplashView {
          withAnimation(.easeOut(duration: 0.4)) { showSplash = false }
        }
        .transition(.opacity)
        .zIndex(1)
      }
    }
  }
}
