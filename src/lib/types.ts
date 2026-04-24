export interface Aircraft {
  icao24: string
  callsign: string
  country: string
  lat: number
  lon: number
  altitude: number // meters
  velocity: number // m/s
  heading: number // degrees
  onGround: boolean
  isMilitary: boolean
  lastContact: number // unix timestamp
  squawk: string | null
}

export interface ConflictEvent {
  id: string
  title: string
  url: string
  source: string
  publishedAt: string
  domain: string // geo domain tag from GDELT
  lat?: number
  lon?: number
  tone: number // GDELT tone score (negative = hostile)
}

export interface IntelBrief {
  id: string
  region: string
  summary: string
  threatLevel: 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL'
  generatedAt: string
  sources: string[]
}

export interface Ship {
  mmsi: string
  name: string
  country: string
  type: 'carrier' | 'destroyer' | 'frigate' | 'submarine' | 'supply' | 'unknown'
  lat: number
  lon: number
  heading: number
  speed: number // knots
  status: 'underway' | 'anchored' | 'moored'
}

export interface Notam {
  id: string
  type: 'TFR' | 'AIRSPACE' | 'MILITARY' | 'EXERCISE'
  lat: number
  lon: number
  radiusNm: number
  ceiling: number // feet
  validUntil: string // ISO date
  description: string
}

export interface OsintItem {
  id: string
  title: string
  source: string
  url: string
  publishedAt: string
}

// OpenSky raw state vector tuple
export type StateVector = [
  string,        // 0: icao24
  string | null, // 1: callsign
  string,        // 2: origin_country
  number | null, // 3: time_position
  number,        // 4: last_contact
  number | null, // 5: longitude
  number | null, // 6: latitude
  number | null, // 7: baro_altitude
  boolean,       // 8: on_ground
  number | null, // 9: velocity
  number | null, // 10: true_track
  number | null, // 11: vertical_rate
  null,          // 12: sensors (always null for anonymous)
  number | null, // 13: geo_altitude
  string | null, // 14: squawk
  boolean,       // 15: spi
  number,        // 16: position_source
]
