import Foundation
import Supabase

// Copy this file to `Config.swift` (which is gitignored) and fill in the two
// values from your Supabase dashboard → Project Settings → API:
//
//   - Project URL          → supabaseURL
//   - Publishable/anon key → supabaseAnonKey
//
// The anon key is PUBLIC by design — it ships in every web browser too, and
// RLS is what actually protects the data. We gitignore Config.swift only to
// keep the repo clean and mirror the web app's .env.local pattern.

enum Config {
  static let supabaseURL = URL(string: "https://YOUR-PROJECT.supabase.co")!
  static let supabaseAnonKey = "<YOUR_SUPABASE_ANON_KEY>"

  // Base URL of the Next.js app, for the write API (POST /api/team, etc.).
  // Your production URL; point at a LAN address to test a local dev server
  // from a real device (`localhost` won't resolve from the phone).
  static let apiBaseURL = URL(string: "https://YOUR-APP.vercel.app")!
}

// One shared client for the whole app. Direct-to-Supabase for auth, RLS reads
// and realtime; writes-with-logic will go through the Next API later.
let supabase = SupabaseClient(
  supabaseURL: Config.supabaseURL,
  supabaseKey: Config.supabaseAnonKey
)
