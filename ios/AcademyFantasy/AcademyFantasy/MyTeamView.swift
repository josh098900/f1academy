import SwiftUI

// Your fantasy team for the open round, in the brand: a Bebas round header,
// your picks as driver cards (the team-colour bar down the leading edge), and
// the spend against the cap. The picker sheet edits and saves it.
struct MyTeamView: View {
  @State private var round: Round?
  @State private var lineup: [PricedDriver] = []
  @State private var team: SavedTeam?
  @State private var partnerMap: [Int: String] = [:]
  @State private var loading = true
  @State private var errorText: String?
  @State private var picking = false

  var body: some View {
    NavigationStack {
      ZStack {
        Theme.Palette.base.ignoresSafeArea()
        content
      }
      .navigationTitle("My Team")
      .toolbar {
        Button(team == nil ? "Pick" : "Edit") { picking = true }
          .disabled(!canEdit)
      }
      .sheet(isPresented: $picking) {
        if let round {
          TeamPickerView(
            round: round,
            lineup: lineup,
            existing: team,
            partnerMap: partnerMap,
            onSaved: { Task { await load() } }
          )
        }
      }
      .task { await load() }
      .refreshable { await load() }
    }
  }

  // Once a round is loaded, always show the scroll view — a pull-to-refresh
  // must not swap it for a spinner (that tears down the refresh control and
  // cancels the task). The spinner is first-load only.
  @ViewBuilder
  private var content: some View {
    if let round {
      ScrollView {
        VStack(spacing: 0) {
          header(round)
          if let team {
            sectionLabel("Your picks")
            ForEach(pickedDrivers(team)) { driver in
              DriverCardRow(
                name: driver.name,
                price: driver.price,
                teamColour: F1Teams.color(partner: partnerMap[driver.driverId]),
                isBoost: driver.driverId == team.boostDriverId
              )
            }
            budgetBar(team)
          } else {
            emptyState
          }
        }
      }
    } else if loading {
      ProgressView().tint(Theme.Palette.accent)
    } else if let errorText {
      Text(errorText)
        .font(AppFont.body(14))
        .foregroundStyle(Theme.Palette.danger)
        .padding()
    } else {
      Text("No round is open for selection right now.")
        .font(AppFont.body(14))
        .foregroundStyle(Theme.Palette.secondary)
        .padding()
    }
  }

  private func header(_ round: Round) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      Text("Round \(round.roundNumber)")
        .font(AppFont.display(36))
        .foregroundStyle(Theme.Palette.primary)
      if let location = roundLocation(round) {
        Text(location)
          .font(AppFont.body(14))
          .foregroundStyle(Theme.Palette.secondary)
      }
      Text(lockLabel(round))
        .font(AppFont.mono(12))
        .foregroundStyle(Theme.Palette.secondary)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(16)
  }

  private func sectionLabel(_ text: String) -> some View {
    Text(text)
      .font(AppFont.mono(11))
      .textCase(.uppercase)
      .foregroundStyle(Theme.Palette.secondary)
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 16)
      .padding(.top, 12)
      .padding(.bottom, 8)
  }

  private func budgetBar(_ team: SavedTeam) -> some View {
    HStack {
      Text("Spent")
        .font(AppFont.body(13))
        .foregroundStyle(Theme.Palette.secondary)
      Spacer()
      Text("£\(spent(pickedDrivers(team)), specifier: "%.1f")M / £\(FantasyService.budgetCap, specifier: "%.0f")M")
        .font(AppFont.mono(14))
        .foregroundStyle(Theme.Palette.primary)
    }
    .padding(16)
  }

  private var emptyState: some View {
    VStack(spacing: 8) {
      Text("No team yet")
        .font(AppFont.display(28))
        .foregroundStyle(Theme.Palette.primary)
      Text("Tap Pick to choose your four drivers.")
        .font(AppFont.body(13))
        .foregroundStyle(Theme.Palette.secondary)
    }
    .frame(maxWidth: .infinity)
    .padding(.top, 44)
  }

  // You can only edit an open round you have a lineup for.
  private var canEdit: Bool {
    guard let round, !lineup.isEmpty else { return false }
    guard let raw = round.lockTime else { return true }
    guard let date = ISO8601DateFormatter().date(from: raw) else { return true }
    return date > Date()
  }

  private func pickedDrivers(_ team: SavedTeam) -> [PricedDriver] {
    team.driverIds.compactMap { id in lineup.first { $0.driverId == id } }
  }

  private func spent(_ picks: [PricedDriver]) -> Double {
    picks.reduce(0) { $0 + $1.price }
  }

  private func roundLocation(_ round: Round) -> String? {
    [round.circuitName, round.country].compactMap { $0 }.first
  }

  private func lockLabel(_ round: Round) -> String {
    guard let raw = round.lockTime else { return "Selection open" }
    let iso = ISO8601DateFormatter()
    if let date = iso.date(from: raw) {
      if date <= Date() { return "Locked" }
      let out = DateFormatter()
      out.dateStyle = .medium
      out.timeStyle = .short
      return "Locks \(out.string(from: date))"
    }
    return "Locks \(raw.prefix(10))"
  }

  private func load() async {
    loading = true
    errorText = nil
    defer { loading = false }
    do {
      let r = try await FantasyService.activeRound()
      round = r
      guard let r else { return }
      async let lineupTask = FantasyService.lineup(roundId: r.id)
      async let teamTask = FantasyService.myTeam(roundId: r.id)
      async let partnersTask = FantasyService.partnerMap(seasonId: r.seasonId)
      lineup = try await lineupTask
      team = try await teamTask
      // The colour bars degrade to neutral grey if this one fails; don't let
      // it break the screen.
      partnerMap = (try? await partnersTask) ?? [:]
    } catch {
      errorText = error.localizedDescription
    }
  }
}
