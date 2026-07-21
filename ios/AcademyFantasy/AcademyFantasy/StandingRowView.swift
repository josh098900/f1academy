import SwiftUI

// One line of a standings table, shared by the leaderboard and league views.
// When it's you, it tints and says so — the single most-wanted feature of any
// leaderboard is "where am I?".
struct StandingRowView: View {
  let row: StandingRow
  var isMe: Bool = false

  var body: some View {
    HStack(spacing: 12) {
      Text("\(row.rank)")
        .frame(width: 32, alignment: .leading)
        .foregroundStyle(.secondary)
        .monospacedDigit()
      Text(row.displayName ?? "—")
        .fontWeight(isMe ? .semibold : .regular)
      if isMe {
        Text("you")
          .font(.caption2)
          .foregroundStyle(.secondary)
      }
      Spacer()
      Text("\(row.total)")
        .monospacedDigit()
        .bold()
    }
    .listRowBackground(isMe ? Color.accentColor.opacity(0.12) : nil)
  }
}
