import SwiftUI

// Published F1 team colours, used factually to identify the F1 partner behind
// each F1 Academy entry — the 4px leading bar on driver cards, and standings
// accents. Mirrors lib/f1-teams.ts on the web; keep the two in sync.
enum F1Teams {
  static let colors: [String: Color] = [
    "Mercedes": Color(hex: 0x00D2BE),
    "Red Bull Racing": Color(hex: 0x1E41FF),
    "Ferrari": Color(hex: 0xDC0000),
    "McLaren": Color(hex: 0xFF8700),
    "Aston Martin": Color(hex: 0x006F62),
    "Alpine": Color(hex: 0x0090FF),
    "Williams": Color(hex: 0x005AFF),
    "Racing Bulls": Color(hex: 0x6692FF),
    "Haas": Color(hex: 0xB6BABD),
    "Kick Sauber": Color(hex: 0x52E252),
    "Audi": Color(hex: 0x52E252), // 2026 entry colour TBC
    "Cadillac": Color(hex: 0xC9B037), // 2027 entry; placeholder
    "—": Color(hex: 0x555555), // no F1 partner
  ]

  // A driver's F1 partner colour; unknown or none → the neutral "no partner"
  // grey (same fallback as the web's teamColor()).
  static func color(partner: String?) -> Color {
    guard let partner, let colour = colors[partner] else {
      return colors["—"]!
    }
    return colour
  }
}
