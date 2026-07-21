import SwiftUI

// Reusable button styles, matching the web's hard-edged CTAs. Uppercase Archivo
// on a sharp 2px rectangle, with a brake-pulse (a darken on press) instead of a
// glide — restraint on motion, per the design doc.

// The one prominent action: magenta fill, inverse (near-black) text.
struct PrimaryButtonStyle: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(AppFont.bodyStrong(15))
      .textCase(.uppercase)
      .foregroundStyle(Theme.Palette.inverse)
      .frame(maxWidth: .infinity)
      .padding(.vertical, 14)
      .background(
        configuration.isPressed ? Theme.Palette.accentActive : Theme.Palette.accent
      )
      .clipShape(RoundedRectangle(cornerRadius: Theme.corner))
  }
}

// A quieter action: surface fill, hairline border, primary text.
struct SecondaryButtonStyle: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(AppFont.bodyStrong(15))
      .textCase(.uppercase)
      .foregroundStyle(Theme.Palette.primary)
      .frame(maxWidth: .infinity)
      .padding(.vertical, 14)
      .background(
        configuration.isPressed ? Theme.Palette.elevated : Theme.Palette.surface
      )
      .overlay(
        RoundedRectangle(cornerRadius: Theme.corner)
          .stroke(Theme.Palette.borderStrong, lineWidth: 1)
      )
      .clipShape(RoundedRectangle(cornerRadius: Theme.corner))
  }
}
