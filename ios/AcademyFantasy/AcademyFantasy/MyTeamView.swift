import SwiftUI

// Your fantasy team for the open round — read-only for now. The picker that
// edits and saves it (POST /api/team) is the next chunk; this proves the
// team reads and lays out the data the picker will drive.
struct MyTeamView: View {
  @State private var round: Round?
  @State private var lineup: [PricedDriver] = []
  @State private var team: SavedTeam?
  @State private var loading = true
  @State private var errorText: String?
  @State private var picking = false

  var body: some View {
    NavigationStack {
      Group {
        // Once a round is loaded, ALWAYS show the list — a pull-to-refresh
        // must not swap it out for a spinner, or it tears down the very
        // refresh control driving the gesture (which cancels the task). The
        // full-screen spinner is only for the first load, when there's no
        // list yet; refreshes get the pull indicator instead.
        if let round {
          teamList(round)
        } else if loading {
          ProgressView()
        } else if let errorText {
          Text(errorText).foregroundStyle(.red).padding()
        } else {
          Text("No round is open for selection right now.")
            .foregroundStyle(.secondary)
            .padding()
        }
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
            onSaved: { Task { await load() } }
          )
        }
      }
      .task { await load() }
      .refreshable { await load() }
    }
  }

  // You can only edit an open round you have a lineup for. A locked round
  // (or one with no prices yet) hides the button — the server would refuse
  // the save anyway, but there's no reason to offer it.
  private var canEdit: Bool {
    guard let round, !lineup.isEmpty else { return false }
    guard let raw = round.lockTime else { return true }
    guard let date = ISO8601DateFormatter().date(from: raw) else { return true }
    return date > Date()
  }

  @ViewBuilder
  private func teamList(_ round: Round) -> some View {
    List {
      Section {
        VStack(alignment: .leading, spacing: 4) {
          Text("Round \(round.roundNumber)")
            .font(.headline)
          if let location = roundLocation(round) {
            Text(location).foregroundStyle(.secondary)
          }
          Text(lockLabel(round))
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
      }

      if let team {
        Section("Your picks") {
          ForEach(pickedDrivers(team)) { driver in
            HStack {
              Text(driver.name)
              if driver.driverId == team.boostDriverId {
                Text("2×")
                  .font(.caption2).bold()
                  .foregroundStyle(.orange)
              }
              Spacer()
              Text("£\(driver.price, specifier: "%.1f")M")
                .monospacedDigit()
                .foregroundStyle(.secondary)
            }
          }
        }
        Section {
          HStack {
            Text("Spent")
            Spacer()
            Text("£\(spent(pickedDrivers(team)), specifier: "%.1f")M / £\(FantasyService.budgetCap, specifier: "%.0f")M")
              .monospacedDigit()
          }
        }
      } else {
        Section {
          Text("You haven't picked a team for this round yet.")
            .foregroundStyle(.secondary)
        }
      }
    }
  }

  // The saved driver ids, resolved to their priced entries (name + price).
  private func pickedDrivers(_ team: SavedTeam) -> [PricedDriver] {
    team.driverIds.compactMap { id in
      lineup.first { $0.driverId == id }
    }
  }

  private func spent(_ picks: [PricedDriver]) -> Double {
    picks.reduce(0) { $0 + $1.price }
  }

  // Circuit, else country, else nothing — the round's "where".
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
      lineup = try await lineupTask
      team = try await teamTask
    } catch {
      errorText = error.localizedDescription
    }
  }
}
