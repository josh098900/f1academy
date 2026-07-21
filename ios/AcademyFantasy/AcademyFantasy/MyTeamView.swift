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

  var body: some View {
    NavigationStack {
      Group {
        if loading {
          ProgressView()
        } else if let errorText {
          Text(errorText).foregroundStyle(.red).padding()
        } else if let round {
          teamList(round)
        } else {
          Text("No round is open for selection right now.")
            .foregroundStyle(.secondary)
            .padding()
        }
      }
      .navigationTitle("My Team")
      .task { await load() }
      .refreshable { await load() }
    }
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
