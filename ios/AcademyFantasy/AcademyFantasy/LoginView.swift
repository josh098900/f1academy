import SwiftUI

struct LoginView: View {
  @EnvironmentObject var auth: AuthManager
  @State private var code = ""

  var body: some View {
    ZStack {
      Theme.Palette.base.ignoresSafeArea()

      VStack(spacing: 18) {
        Text("Academy Fantasy")
          .font(AppFont.display(56))
          .foregroundStyle(Theme.Palette.primary)
          .padding(.bottom, 8)

        // The quick path — one tap, no waiting for an email.
        Button {
          Task { await auth.signInWithGoogle() }
        } label: {
          Text("Continue with Google")
        }
        .buttonStyle(PrimaryButtonStyle())

        Text("or sign in by email")
          .font(AppFont.body(12))
          .foregroundStyle(Theme.Palette.secondary)
          .padding(.top, 4)

        if !auth.awaitingCode {
          field($auth.email, placeholder: "you@email.com")
            .keyboardType(.emailAddress)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
          Button("Send code") { Task { await auth.sendCode() } }
            .buttonStyle(SecondaryButtonStyle())
        } else {
          Text("Code sent to \(auth.email)")
            .font(AppFont.body(12))
            .foregroundStyle(Theme.Palette.secondary)
          field($code, placeholder: "6-digit code")
            .keyboardType(.numberPad)
          Button("Verify") { Task { await auth.verify(code: code) } }
            .buttonStyle(PrimaryButtonStyle())
        }

        if let err = auth.errorText {
          Text(err)
            .font(AppFont.body(12))
            .foregroundStyle(Theme.Palette.danger)
        }
      }
      .padding(28)
    }
  }

  // A dark, hard-edged text field.
  private func field(_ text: Binding<String>, placeholder: String) -> some View {
    TextField(
      "",
      text: text,
      prompt: Text(placeholder).foregroundColor(Theme.Palette.muted)
    )
    .font(AppFont.body(16))
    .foregroundStyle(Theme.Palette.primary)
    .tint(Theme.Palette.accent)
    .padding(12)
    .background(Theme.Palette.surface)
    .overlay(
      RoundedRectangle(cornerRadius: Theme.corner)
        .stroke(Theme.Palette.borderDefault, lineWidth: 1)
    )
  }
}
