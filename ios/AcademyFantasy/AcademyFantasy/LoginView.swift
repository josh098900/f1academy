//
//  LoginView.swift
//  AcademyFantasy
//
//  Created by Joshua Mathers on 21/07/2026.
//

import SwiftUI

struct LoginView: View {
  @EnvironmentObject var auth: AuthManager
  @State private var code = ""

  var body: some View {
    VStack(spacing: 16) {
      Text("Academy Fantasy").font(.largeTitle.bold())

      // The quick path — one tap, no waiting for an email.
      Button {
        Task { await auth.signInWithGoogle() }
      } label: {
        Text("Continue with Google").frame(maxWidth: .infinity)
      }
      .buttonStyle(.borderedProminent)
      .controlSize(.large)

      Text("or sign in by email")
        .font(.footnote)
        .foregroundStyle(.secondary)
        .padding(.top, 8)

      if !auth.awaitingCode {
        TextField("you@email.com", text: $auth.email)
          .textFieldStyle(.roundedBorder)
          .keyboardType(.emailAddress)
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
        Button("Send code") { Task { await auth.sendCode() } }
          .buttonStyle(.borderedProminent)
      } else {
        Text("Code sent to \(auth.email)").font(.footnote).foregroundStyle(.secondary)
        TextField("6-digit code", text: $code)
          .textFieldStyle(.roundedBorder)
          .keyboardType(.numberPad)
        Button("Verify") { Task { await auth.verify(code: code) } }
          .buttonStyle(.borderedProminent)
      }

      if let err = auth.errorText {
        Text(err).foregroundStyle(.red).font(.footnote)
      }
    }
    .padding()
  }
}
