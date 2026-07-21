import Foundation

// The fantasy-team domain models. Field names map to the Postgres columns.
// Wire-format notes, verified against the actual PostgREST JSON:
//   - price_millions is numeric(4,1) and comes back as a JSON NUMBER (10.5),
//     so it decodes straight to Double.
//   - lock_time is timestamptz and comes back as an ISO STRING; we keep it a
//     string and format it at the view edge (dodging JSON date strategies).

struct Round: Codable, Identifiable {
  let id: Int
  let roundNumber: Int
  let country: String?
  let circuitName: String?
  let lockTime: String?

  enum CodingKeys: String, CodingKey {
    case id
    case roundNumber = "round_number"
    case country
    case circuitName = "circuit_name"
    case lockTime = "lock_time"
  }
}

struct DriverName: Codable {
  let fullName: String
  let shortName: String

  enum CodingKeys: String, CodingKey {
    case fullName = "full_name"
    case shortName = "short_name"
  }
}

struct PricedDriver: Codable, Identifiable {
  let driverId: Int
  let price: Double // price_millions, numeric(4,1) → JSON number (e.g. 10.5)
  let drivers: DriverName

  var id: Int { driverId }
  var name: String { drivers.fullName }

  enum CodingKeys: String, CodingKey {
    case driverId = "driver_id"
    case price = "price_millions"
    case drivers
  }
}

struct SavedTeam: Codable {
  let driverIds: [Int]
  let boostDriverId: Int

  enum CodingKeys: String, CodingKey {
    case driverIds = "driver_ids"
    case boostDriverId = "boost_driver_id"
  }
}
