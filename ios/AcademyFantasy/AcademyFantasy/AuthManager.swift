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
  // The signed-in user's id, lowercased to match Postgres' uuid text form, so
  // the views can highlight "you" in any standings list.
  @Published var userId: String?
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
      await refreshSession()
    } catch {
      errorText = error.localizedDescription
    }
  }

  // Continue with Google. The SDK opens an ASWebAuthenticationSession, runs
  // the OAuth dance, and captures the callback itself — which is why no
  // Info.plist URL scheme is needed. The one requirement is that
  // `academyfantasy://login-callback` is in Supabase's allowed Redirect URLs.
  func signInWithGoogle() async {
    errorText = nil
    do {
      _ = try await supabase.auth.signInWithOAuth(
        provider: .google,
        redirectTo: URL(string: "academyfantasy://login-callback")
      )
      await refreshSession()
    } catch {
      errorText = error.localizedDescription
    }
  }

  // On launch, pick up a session the SDK already has stored. This is why you
  // DON'T re-authenticate every run — the SDK persists the session to the
  // Keychain, so once you're in, you stay in until you sign out (or the
  // simulator is wiped).
  func restore() async {
    await refreshSession()
  }

  // Mirror the current session into the published state — signed-in flag and
  // the user's id for "you" highlighting. One place, so every sign-in path
  // (OTP, Google, launch restore) stays consistent.
  private func refreshSession() async {
    if let session = try? await supabase.auth.session {
      userId = session.user.id.uuidString.lowercased()
      isSignedIn = true
    } else {
      userId = nil
      isSignedIn = false
    }
  }

  func signOut() async {
    try? await supabase.auth.signOut()
    userId = nil
    isSignedIn = false
    awaitingCode = false
  }
}
