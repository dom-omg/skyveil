import { Aircraft, StateVector } from './types'
import { isMilitaryAircraft } from './military-filter'
import { DEMO_AIRCRAFT } from './demo-data'

const OPENSKY_BASE = 'https://opensky-network.org/api'

interface OpenSkyResponse {
  time: number
  states: StateVector[] | null
}

// globalThis survives Next.js HMR hot reloads — prevents hammering OpenSky on every file save
const g = globalThis as typeof globalThis & {
  _oskyCache: Aircraft[]
  _oskyCacheTime: number
  _oskyRateLimitedUntil: number
}
if (!g._oskyCache) g._oskyCache = []
if (!g._oskyCacheTime) g._oskyCacheTime = 0
if (!g._oskyRateLimitedUntil) g._oskyRateLimitedUntil = 0

export async function fetchAllAircraft(): Promise<Aircraft[]> {
  const res = await fetch(`${OPENSKY_BASE}/states/all`, {
    cache: 'no-store',
    headers: { 'Accept': 'application/json' },
  })

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? 60)
    g._oskyRateLimitedUntil = Date.now() + retryAfter * 1000
    throw new Error(`OpenSky rate limited — retry in ${retryAfter}s`)
  }

  if (!res.ok) throw new Error(`OpenSky API error: ${res.status}`)

  const data: OpenSkyResponse = await res.json()
  if (!data.states) return []

  const aircraft: Aircraft[] = []

  for (const state of data.states) {
    const [icao24, callsign, country, , lastContact, lon, lat, baroAlt, onGround, vel, track, , , , squawk] = state

    if (lat == null || lon == null) continue

    const callsignClean = callsign?.trim() ?? ''

    aircraft.push({
      icao24,
      callsign: callsignClean,
      country,
      lat,
      lon,
      altitude: baroAlt ?? 0,
      velocity: vel ?? 0,
      heading: track ?? 0,
      onGround: onGround ?? false,
      isMilitary: isMilitaryAircraft(callsignClean, icao24, squawk ?? null),
      lastContact,
      squawk: squawk ?? null,
    })
  }

  return aircraft
}

export async function fetchMilitaryAircraft(): Promise<Aircraft[]> {
  const now = Date.now()

  if (now < g._oskyRateLimitedUntil) {
    if (g._oskyCache.length > 0) return g._oskyCache
    const remaining = Math.ceil((g._oskyRateLimitedUntil - now) / 1000)
    throw new Error(`OpenSky rate limited — ${remaining}s remaining`)
  }

  try {
    const all = await fetchAllAircraft()
    g._oskyCache = all.filter(a => a.isMilitary && !a.onGround)
    g._oskyCacheTime = now
    return g._oskyCache
  } catch (err) {
    if (g._oskyCache.length > 0) {
      console.warn('[opensky] fetch failed, serving stale cache from', new Date(g._oskyCacheTime).toISOString(), err)
      return g._oskyCache
    }
    // No cache at all — serve demo data so the UI isn't empty
    console.warn('[opensky] no cache, falling back to demo data:', err)
    return DEMO_AIRCRAFT
  }
}

export function getCacheAge(): number {
  return g._oskyCacheTime ? Date.now() - g._oskyCacheTime : -1
}
