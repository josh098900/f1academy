import SwiftUI

// Pick (or edit) your four drivers, choose the boost, and save — in the brand.
// The lineup is driver cards with the team-colour bar and a selection tick; the
// budget maths is advisory only (the server re-validates on save, and its
// answer is the one the player sees).
struct TeamPickerView: View {
  let round: Round
  let lineup: [PricedDriver]
  let existing: SavedTeam?
  let partnerMap: [Int: String]
  var onSaved: () -> Void

  @Environment(\.dismiss) private var dismiss
  @State private var selected: Set<Int> = []
  @State private var boost: Int?
  @State private var saving = false
  @State private var errorText: String?

  private var chosen: [PricedDriver] {
    lineup.filter { selected.contains($0.driverId) }
  }
  private var spent: Double { chosen.reduce(0) { $0 + $1.price } }
  private var overBudget: Bool { spent > FantasyService.budgetCap + 0.0001 }
  private var canSave: Bool {
    selected.count == FantasyService.squadSize && !overBudget && boost != nil && !saving
  }

  var body: some View {
    NavigationStack {
      ZStack {
        Theme.Palette.base.ignoresSafeArea()
        ScrollView {
          VStack(spacing: 0) {
            budgetHeader

            sectionLabel("Drivers")
            ForEach(lineup) { driver in
              Button {
                toggle(driver)
              } label: {
                DriverCardRow(
                  name: driver.name,
                  price: driver.price,
                  teamColour: F1Teams.color(partner: partnerMap[driver.driverId]),
                  selectable: true,
                  selected: selected.contains(driver.driverId)
                )
              }
              .buttonStyle(.plain)
            }

            if !chosen.isEmpty {
              sectionLabel("Boost — doubles her points")
              ForEach(chosen) { driver in
                Button { boost = driver.driverId } label: {
                  boostRow(driver)
                }
                .buttonStyle(.plain)
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
            ProgressView().tint(Theme.Palette.accent)
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

  private var budgetHeader: some View {
    VStack(spacing: 6) {
      HStack {
        Text("\(selected.count)/\(FantasyService.squadSize) drivers")
          .font(AppFont.body(14))
          .foregroundStyle(Theme.Palette.secondary)
        Spacer()
        Text("£\(spent, specifier: "%.1f")M / £\(FantasyService.budgetCap, specifier: "%.0f")M")
          .font(AppFont.mono(15))
          .foregroundStyle(overBudget ? Theme.Palette.danger : Theme.Palette.primary)
      }
      if let errorText {
        Text(errorText)
          .font(AppFont.body(12))
          .foregroundStyle(Theme.Palette.danger)
          .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
    .padding(16)
  }

  private func boostRow(_ driver: PricedDriver) -> some View {
    HStack(spacing: 12) {
      Rectangle()
        .fill(F1Teams.color(partner: partnerMap[driver.driverId]))
        .frame(width: 4)
      Text(driver.name)
        .font(AppFont.body(16))
        .foregroundStyle(Theme.Palette.primary)
      Spacer()
      if boost == driver.driverId {
        Image(systemName: "checkmark")
          .foregroundStyle(Theme.Palette.accent)
          .padding(.trailing, 16)
      }
    }
    .frame(height: 48)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(Theme.Palette.surface)
    .overlay(alignment: .bottom) {
      Rectangle().fill(Theme.Palette.borderDefault).frame(height: 1)
    }
  }

  private func sectionLabel(_ text: String) -> some View {
    Text(text)
      .font(AppFont.mono(11))
      .textCase(.uppercase)
      .foregroundStyle(Theme.Palette.secondary)
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 16)
      .padding(.top, 16)
      .padding(.bottom, 8)
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
