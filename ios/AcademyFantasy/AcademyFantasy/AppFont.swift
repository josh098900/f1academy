import CoreText
import SwiftUI

// The three brand fonts, bundled and registered at launch, then exposed as
// SwiftUI Font helpers. Mirrors the web's roles:
//   display → Bebas Neue (condensed uppercase, and the hero numerals)
//   body    → Archivo (regular + semibold)
//   mono    → JetBrains Mono (tabular figures)
//
// The design doc treats system fonts (SF/Inter) as the cardinal "generic app"
// tell, so nothing should use `.system(...)` — reach for these instead.
enum AppFont {
  // PostScript names, read from the .ttf files (mdls) so `.custom` resolves
  // exactly rather than silently falling back to system.
  private static let files = [
    "BebasNeue-Regular",
    "JetBrainsMono-Regular",
    "Archivo-Regular",
    "Archivo-SemiBold",
  ]

  // Register the bundled .ttf files with Core Text once, at launch. Programmatic
  // registration avoids needing UIAppFonts in a generated Info.plist.
  static func register() {
    for name in files {
      guard let url = Bundle.main.url(forResource: name, withExtension: "ttf") else {
        print("⚠️ AppFont: '\(name).ttf' not found in bundle — is it in Copy Bundle Resources?")
        continue
      }
      var error: Unmanaged<CFError>?
      if !CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error) {
        print("⚠️ AppFont: failed to register \(name): \(String(describing: error))")
      }
    }
  }

  static func display(_ size: CGFloat) -> Font { .custom("BebasNeue-Regular", size: size) }
  static func body(_ size: CGFloat) -> Font { .custom("Archivo-Regular", size: size) }
  static func bodyStrong(_ size: CGFloat) -> Font { .custom("Archivo-SemiBold", size: size) }
  static func mono(_ size: CGFloat) -> Font { .custom("JetBrainsMono-Regular", size: size) }
}
