import SwiftUI

// One line of a standings table, shared by the leaderboard and league views.
// The rank is a hero numeral (Bebas), points are tabular mono (JetBrains), and
// when it's you the whole row tints magenta — the design's current-user accent.
// Container-agnostic: it paints its own full-width band + hairline, so it drops
// into a LazyVStack without a List's insets fighting the edge-to-edge look.
struct StandingRowView: View {
  let row: StandingRow
  var isMe: Bool = false

  var body: some View {
    HStack(spacing: 14) {
      Text("\(row.rank)")
        .font(AppFont.display(28))
        .foregroundStyle(isMe ? Theme.Palette.accent : Theme.Palette.secondary)
        .frame(minWidth: 38, alignment: .leading)

      Text(row.displayName ?? "—")
        .font(AppFont.body(16))
        .foregroundStyle(isMe ? Theme.Palette.accent : Theme.Palette.primary)
        .lineLimit(1)

      Spacer(minLength: 8)

      Text("\(row.total)")
        .font(AppFont.mono(16))
        .foregroundStyle(Theme.Palette.primary)
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 11)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(isMe ? Theme.Palette.accentMuted : Color.clear)
    .overlay(alignment: .bottom) {
      Rectangle().fill(Theme.Palette.borderDefault).frame(height: 1)
    }
  }
}
