//
//  AuthManager.swift
//  AcademyFantasy
//
//  Created by Joshua Mathers on 21/07/2026.
//

import Combine
import Supabase
import SwiftUI

// Holds the session and drives the OTP flow. @MainActor so the @Published
// changes land on the main thread for SwiftUI. `ObservableObject` and
// `@Published` are Combine types — import it explicitly so the compiler can
// see them (SwiftUI doesn't always re-export Combine in this toolchain).
@MainActor
final class AuthManager: ObservableObject {
  @Published var email = ""
  @Published var awaitingCode = false
  @Published var isSignedIn = false
  @Published var errorText: String?

  // Ask Supabase to email a 6-digit code. shouldCreateUser: false so a typo
  // can't spawn a stray account — Phase 0 is for existing users (you).
  func sendCode() async {
    errorText = nil
    do {
      try await supabase.auth.signInWithOTP(email: email, shouldCreateUser: false)
      awaitingCode = true
    } catch {
      errorText = error.localizedDescription
    }
  }

  func verify(code: String) async {
    errorText = nil
    do {
      try await supabase.auth.verifyOTP(email: email, token: code, type: .email)
      isSignedIn = true
    } catch {
      errorText = error.localizedDescription
    }
  }

  // On launch, pick up a session the SDK already has stored.
  func restore() async {
    isSignedIn = (try? await supabase.auth.session) != nil
  }

  func signOut() async {
    try? await supabase.auth.signOut()
    isSignedIn = false
    awaitingCode = false
  }
}
