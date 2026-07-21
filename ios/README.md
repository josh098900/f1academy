# Academy Fantasy — iOS

The native iOS client, living in the monorepo alongside the Next web app. Same
Supabase backend, same users, same data — this is just a new window onto it.

## Architecture (decided 2026-07-21)

- **Auth, RLS reads, and realtime** talk to Supabase **directly** via the
  Swift SDK. This is idiomatic and the least code: RLS already protects every
  row, so the app just asks Supabase for what the signed-in user is allowed
  to see.
- **Writes with logic** (save team, settle a race, buy an upgrade, sign a
  driver) go through **the Next.js API** — not direct to Supabase — because
  the anti-cheat lives server-side (the economy RPCs are `service_role` only)
  and the validation lives in the shared `lib/` core. Those API routes don't
  exist yet; they arrive in a later phase. Phase 0 is read-only.

Vercel ignores this folder — it isn't part of the Next build.

## Phase 0 — the vertical slice

**Goal:** log in with a real account and see the live global leaderboard.
One slice that proves the three things that make or break the whole port:
native Supabase auth, one RLS-aware data call, and one SwiftUI screen.

### Prerequisites

- **Xcode 16+** (App Store). First launch installs the iOS platform — let it.
- A free Apple ID is enough to run in the **Simulator** (no paid account
  needed until you put it on a physical phone or the App Store).

### One backend prep step — the email OTP code

Phase 0 signs in with a **6-digit email code** (no deep-linking needed yet).
For the code to appear in the email, the template must include the token:

1. Supabase dashboard → **Authentication → Email Templates → Magic Link**.
2. Make sure the body contains `{{ .Token }}` somewhere, e.g.
   `Your code is: {{ .Token }}`. (The existing magic-link URL can stay.)
3. Save.

> ⚠️ Gotcha from the web setup: toggling custom SMTP **resets** these
> templates. If you ever re-toggle SMTP, re-add `{{ .Token }}`.

### Xcode setup, step by step

1. **Create the project.** Xcode → File → New → Project → iOS → **App** →
   Next.
   - Product Name: `AcademyFantasy`
   - Interface: **SwiftUI**, Language: **Swift**
   - Storage: **None**, tests: your call.
   - **Save location: this `ios/` folder.** Xcode creates
     `ios/AcademyFantasy/AcademyFantasy.xcodeproj` and a source group.
2. **Set the deployment target** to **iOS 16.0** (project → target → General →
   Minimum Deployments).
3. **Add the Supabase SDK.** File → Add Package Dependencies → paste
   `https://github.com/supabase/supabase-swift` → Dependency Rule: Up to Next
   Major → Add Package → tick the **Supabase** product → Add.
4. **Create the source files.** In the Project navigator, right-click the
   `AcademyFantasy` group → New File → Swift File, once per file below, and
   paste the contents. (Creating them in Xcode keeps the project file in sync.)
   - `Config.swift` — copy `ios/Config.example.swift`, fill in your URL +
     publishable key. (This file is gitignored.)
   - `AuthManager.swift`
   - `LoginView.swift`
   - `LeaderboardView.swift`
   - `ContentView.swift`
   - Replace the generated `AcademyFantasyApp.swift` body with the one below.
5. **Run** (⌘R) on an iPhone simulator. Enter your account email → Send code →
   type the code from the email → the leaderboard appears.

### What "done" looks like

You sign in as yourself and see the same ranked board the website shows,
pulled live through RLS. That's the pipe proven end to end — every later
screen is repetition of this shape.

---

## Phase 0 source

### `AcademyFantasyApp.swift`

```swift
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
```

### `AuthManager.swift`

```swift
import Combine
import Supabase
import SwiftUI

// Holds the session and drives the OTP flow. @MainActor so the @Published
// changes land on the main thread for SwiftUI. `ObservableObject`/`@Published`
// are Combine types — import it explicitly (SwiftUI doesn't always re-export
// Combine in this toolchain).
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
```

### `ContentView.swift`

```swift
import SwiftUI

struct ContentView: View {
  @EnvironmentObject var auth: AuthManager
  var body: some View {
    Group {
      if auth.isSignedIn {
        LeaderboardView()
      } else {
        LoginView()
      }
    }
    .task { await auth.restore() }
  }
}
```

### `LoginView.swift`

```swift
import SwiftUI

struct LoginView: View {
  @EnvironmentObject var auth: AuthManager
  @State private var code = ""

  var body: some View {
    VStack(spacing: 16) {
      Text("Academy Fantasy").font(.largeTitle.bold())

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
```

### `LeaderboardView.swift`

```swift
import Supabase
import SwiftUI

// The RPC's return shape, one row per player. bigint columns arrive as JSON
// numbers; Int decodes them fine at this scale.
struct LeaderboardRow: Codable, Identifiable {
  let rank: Int
  let userId: String
  let displayName: String?
  let total: Int
  let roundsPlayed: Int

  var id: String { userId }

  enum CodingKeys: String, CodingKey {
    case rank
    case userId = "user_id"
    case displayName = "display_name"
    case total
    case roundsPlayed = "rounds_played"
  }
}

struct LeaderboardView: View {
  @EnvironmentObject var auth: AuthManager
  @State private var rows: [LeaderboardRow] = []
  @State private var loading = true
  @State private var errorText: String?

  var body: some View {
    NavigationStack {
      List(rows) { row in
        HStack {
          Text("\(row.rank)")
            .frame(width: 32, alignment: .leading)
            .foregroundStyle(.secondary)
          Text(row.displayName ?? "—")
          Spacer()
          Text("\(row.total)").monospacedDigit().bold()
        }
      }
      .overlay { if loading { ProgressView() } }
      .navigationTitle("Leaderboard")
      .toolbar {
        Button("Sign out") { Task { await auth.signOut() } }
      }
      .task { await load() }
      .refreshable { await load() }
    }
  }

  // The authenticated RPC call. The SDK attaches the session's JWT, so the
  // `authenticated`-only grant is satisfied and RLS/SECURITY DEFINER do the
  // rest — the same board the website renders.
  func load() async {
    loading = true
    defer { loading = false }
    do {
      rows = try await supabase
        .rpc("global_leaderboard", params: ["p_limit": 100])
        .execute()
        .value
    } catch {
      errorText = error.localizedDescription
    }
  }
}
```
