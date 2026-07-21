import SwiftUI

// A driver card — the signature component. A full-height bar in the driver's F1
// partner colour runs down the leading edge (the web's 4px team stripe), then
// the name, an optional 2× boost marker, and the price in tabular mono.
//
// One component serves both the read view (My Team's picks) and the picker
// (selectable, from the full lineup) via the `selectable`/`selected` flags.
struct DriverCardRow: View {
  let name: String
  let price: Double
  let teamColour: Color
  var isBoost: Bool = false
  var selectable: Bool = false
  var selected: Bool = false

  var body: some View {
    HStack(spacing: 12) {
      Rectangle()
        .fill(teamColour)
        .frame(width: 4)

      if selectable {
        Image(systemName: selected ? "checkmark.circle.fill" : "circle")
          .foregroundStyle(selected ? Theme.Palette.accent : Theme.Palette.muted)
      }

      Text(name)
        .font(AppFont.body(16))
        .foregroundStyle(Theme.Palette.primary)
        .lineLimit(1)

      if isBoost {
        Text("2×")
          .font(AppFont.bodyStrong(11))
          .foregroundStyle(Theme.Palette.accent)
      }

      Spacer(minLength: 8)

      Text("£\(price, specifier: "%.1f")M")
        .font(AppFont.mono(14))
        .foregroundStyle(Theme.Palette.secondary)
    }
    .padding(.trailing, 16)
    .frame(height: 54)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(Theme.Palette.surface)
    .overlay(alignment: .bottom) {
      Rectangle().fill(Theme.Palette.borderDefault).frame(height: 1)
    }
  }
}
