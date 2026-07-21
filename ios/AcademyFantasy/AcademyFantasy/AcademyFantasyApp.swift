//
//  AcademyFantasyApp.swift
//  AcademyFantasy
//
//  Created by Joshua Mathers on 21/07/2026.
//

import SwiftUI

@main
struct AcademyFantasyApp: App {
  @StateObject private var auth = AuthManager()
  var body: some Scene {
    WindowGroup {
      ContentView().environmentObject(auth)
    }
  }
}
