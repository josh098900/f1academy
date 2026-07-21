import SwiftUI

// The visual identity, ported from the web design system
// (docs/files/DESIGN_SYSTEM.md and app/globals.css). Black-first, one magenta
// accent, hard geometry. One dark theme — there is no light mode, matching the
// web exactly.
//
// This is the single source of truth for colour on iOS; nothing should reach
// for a system colour (.gray, .blue…) — that's the "generic app" drift the
// design doc warns against.
enum Theme {
  enum Palette {
    // Foundational
    static let base = Color(hex: 0x0A0A0A) // near-black canvas
    static let surface = Color(hex: 0x141414) // cards / panels
    static let elevated = Color(hex: 0x1C1C1C) // sheets, menus
    static let borderDefault = Color(hex: 0x2A2A2A) // barely visible
    static let borderStrong = Color(hex: 0x3D3D3D) // hover, focus

    // Text
    static let primary = Color(hex: 0xF5F5F5) // warm white
    static let secondary = Color(hex: 0x888888) // labels, metadata
    static let muted = Color(hex: 0x555555) // timestamps, disclaimers
    static let inverse = Color(hex: 0x0A0A0A) // on accent backgrounds

    // Accent — the one colour. Actions, current-user highlight, in-the-points.
    static let accent = Color(hex: 0xFF2D92) // electric magenta
    static let accentHover = Color(hex: 0xFF52A6)
    static let accentActive = Color(hex: 0xE61F7E)
    static let accentMuted = Color(hex: 0x4A0F2D)

    // Semantic
    static let success = Color(hex: 0x00E5A0) // mint — scoring / positions gained
    static let danger = Color(hex: 0xFF3D3D)
    static let warning = Color(hex: 0xFFB800) // yellow flag
    static let info = Color(hex: 0x4DB8FF) // rare
  }

  // Hard geometry: 2px on essentially everything (0 for full-bleed edges).
  static let corner: CGFloat = 2
}

extension Color {
  // A 0xRRGGBB literal → opaque sRGB Color. Every design token is an opaque hex,
  // so this keeps the palette readable as the same values the web uses.
  init(hex: UInt32) {
    self.init(
      .sRGB,
      red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255,
      blue: Double(hex & 0xFF) / 255,
      opacity: 1
    )
  }
}
