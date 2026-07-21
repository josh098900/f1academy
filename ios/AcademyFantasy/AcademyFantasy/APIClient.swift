import Foundation
import Supabase

// The write side of the app.
//
// Reads go direct to Supabase under RLS; anything the client must NOT be
// trusted to do itself — validating and committing the team today, the racing
// and garage writes later — POSTs here, to the Next API. The signed-in user's
// Supabase access token rides along as a Bearer, which the route's
// authenticateBearer() verifies. One place, reused by every future write.
enum APIClient {
  struct APIError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
  }

  // The routes all answer { ok: Bool, error?: String }.
  private struct Reply: Decodable {
    let ok: Bool
    let error: String?
  }

  // POST `body` as JSON to an app API path (e.g. "/api/team"), authenticated
  // as the signed-in user. Returns on success; throws APIError carrying the
  // server's own message otherwise, so the UI can show it verbatim.
  static func post(_ path: String, body: some Encodable) async throws {
    guard let url = URL(string: Config.apiBaseURL.absoluteString + path) else {
      throw APIError(message: "Bad API URL.")
    }
    let token = try await supabase.auth.session.accessToken

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    request.httpBody = try JSONEncoder().encode(body)

    let (data, response) = try await URLSession.shared.data(for: request)
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    let reply = try? JSONDecoder().decode(Reply.self, from: data)
    guard status == 200, reply?.ok == true else {
      throw APIError(message: reply?.error ?? "Request failed (\(status)).")
    }
  }
}
