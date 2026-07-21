import SwiftUI

// Pick (or edit) your four drivers, choose the boost, and save.
//
// The budget maths here is only for immediate feedback — the SERVER is the
// source of truth and re-validates everything on save, so if these numbers and
// the server ever disagreed, the server's answer is the one that counts (and
// it's the message the player would see).
struct TeamPickerView: View {
  let round: Round
  let lineup: [PricedDriver]
  let existing: SavedTeam?
  var onSaved: () -> Void

  @Environment(\.dismiss) private var dismiss
  @State private var selected: Set<Int> = []
  @State private var boost: Int?
  @State private var saving = false
  @State private var errorText: String?

  private var chosen: [PricedDriver] {
    lineup.filter { selected.contains($0.driverId) }
  }
  private var spent: Double {
    chosen.reduce(0) { $0 + $1.price }
  }
  private var overBudget: Bool {
    spent > FantasyService.budgetCap + 0.0001
  }
  private var canSave: Bool {
    selected.count == FantasyService.squadSize
      && !overBudget
      && boost != nil
      && !saving
  }

  var body: some View {
    NavigationStack {
      List {
        Section {
          HStack {
            Text("\(selected.count)/\(FantasyService.squadSize) drivers")
            Spacer()
            Text("£\(spent, specifier: "%.1f")M / £\(FantasyService.budgetCap, specifier: "%.0f")M")
              .monospacedDigit()
              .foregroundStyle(overBudget ? Color.red : Color.primary)
          }
          if let errorText {
            Text(errorText).font(.footnote).foregroundStyle(.red)
          }
        }

        Section("Drivers") {
          ForEach(lineup) { driver in
            Button {
              toggle(driver)
            } label: {
              HStack {
                Image(systemName: selected.contains(driver.driverId)
                  ? "checkmark.circle.fill" : "circle")
                  .foregroundStyle(selected.contains(driver.driverId)
                    ? Color.accentColor : Color.secondary)
                Text(driver.name).foregroundStyle(.primary)
                Spacer()
                Text("£\(driver.price, specifier: "%.1f")M")
                  .monospacedDigit()
                  .foregroundStyle(.secondary)
              }
            }
          }
        }

        if !chosen.isEmpty {
          Section("Boost — doubles her points") {
            ForEach(chosen) { driver in
              Button {
                boost = driver.driverId
              } label: {
                HStack {
                  Text(driver.name).foregroundStyle(.primary)
                  Spacer()
                  if boost == driver.driverId {
                    Image(systemName: "checkmark")
                      .foregroundStyle(Color.accentColor)
                  }
                }
              }
            }
          }
        }
      }
      .navigationTitle("Pick your team")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          if saving {
            ProgressView()
          } else {
            Button("Save") { Task { await save() } }
              .disabled(!canSave)
          }
        }
      }
      .onAppear {
        if selected.isEmpty, let existing {
          selected = Set(existing.driverIds)
          boost = existing.boostDriverId
        }
      }
    }
  }

  private func toggle(_ driver: PricedDriver) {
    let id = driver.driverId
    if selected.contains(id) {
      selected.remove(id)
      if boost == id { boost = nil } // can't boost a driver you dropped
    } else if selected.count < FantasyService.squadSize {
      selected.insert(id)
    }
  }

  private func save() async {
    guard let boost else { return }
    saving = true
    errorText = nil
    defer { saving = false }
    do {
      try await FantasyService.saveTeam(
        driverIds: Array(selected),
        boostDriverId: boost
      )
      onSaved()
      dismiss()
    } catch {
      errorText = error.localizedDescription
    }
  }
}
