import SwiftUI
import UIKit

@main
struct AcademyFantasyApp: App {
  @StateObject private var auth = AuthManager()

  init() {
    AppFont.register() // must run before configureAppearance uses the fonts
    Self.configureAppearance()
  }

  var body: some Scene {
    WindowGroup {
      ContentView()
        .environmentObject(auth)
        .tint(Theme.Palette.accent) // selection, buttons → magenta
        .preferredColorScheme(.dark) // there is no light theme
    }
  }

  // SwiftUI's background modifiers don't reach UIKit's nav bar and tab bar, so
  // the appearance proxies paint them the brand black once, globally — with
  // Bebas Neue titles (the fonts are already registered above).
  private static func configureAppearance() {
    let base = UIColor(Theme.Palette.base)
    let primary = UIColor(Theme.Palette.primary)
    let hairline = UIColor(Theme.Palette.borderDefault)

    let nav = UINavigationBarAppearance()
    nav.configureWithOpaqueBackground()
    nav.backgroundColor = base
    nav.shadowColor = hairline
    var titleAttrs: [NSAttributedString.Key: Any] = [.foregroundColor: primary]
    var largeAttrs: [NSAttributedString.Key: Any] = [.foregroundColor: primary]
    if let bebas = UIFont(name: "BebasNeue-Regular", size: 20) {
      titleAttrs[.font] = bebas
    }
    if let bebasLarge = UIFont(name: "BebasNeue-Regular", size: 34) {
      largeAttrs[.font] = bebasLarge
    }
    nav.titleTextAttributes = titleAttrs
    nav.largeTitleTextAttributes = largeAttrs
    UINavigationBar.appearance().standardAppearance = nav
    UINavigationBar.appearance().scrollEdgeAppearance = nav
    UINavigationBar.appearance().compactAppearance = nav

    let tab = UITabBarAppearance()
    tab.configureWithOpaqueBackground()
    tab.backgroundColor = base
    tab.shadowColor = hairline
    UITabBar.appearance().standardAppearance = tab
    UITabBar.appearance().scrollEdgeAppearance = tab
  }
}
