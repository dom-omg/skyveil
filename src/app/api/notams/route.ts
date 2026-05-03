import { NextResponse } from 'next/server'
import type { Notam } from '@/lib/types'

// ---------------------------------------------------------------------------
// Types for external FAA TFR API responses
// ---------------------------------------------------------------------------

interface FaaTfrItem {
  notam_id: string
  facility: string
  state: string
  type: string
  description: string
  mod_date: string
  mod_abs_time: string
  is_new: string
  gid: string
}

interface GeoServerFeature {
  id: string
  geometry: {
    type: string
    coordinates: number[][][]
  }
  properties: {
    GID: number
    CNS_LOCATION_ID: string
    NOTAM_KEY: string
    TITLE: string
    LAST_MODIFICATION_DATETIME: string
    STATE: string
    LEGAL: string
  }
}

interface GeoServerResponse {
  type: string
  features: GeoServerFeature[]
}

// ---------------------------------------------------------------------------
// Fallback data (used if live fetch fails)
// ---------------------------------------------------------------------------

const FALLBACK_NOTAMS: Notam[] = [
  { id: 'NOTAM-001', type: 'MILITARY', lat: 48.8, lon: 14.2, radiusNm: 50, ceiling: 18000, validUntil: '2026-05-01T00:00:00Z', description: 'LARGE SCALE NATO EXERCISE STEADFAST DEFENDER' },
  { id: 'NOTAM-002', type: 'TFR', lat: 38.9, lon: -77.0, radiusNm: 30, ceiling: 18000, validUntil: '2026-04-30T00:00:00Z', description: 'PRESIDENTIAL TFR ACTIVE — WASHINGTON DC' },
  { id: 'NOTAM-003', type: 'EXERCISE', lat: 57.5, lon: 10.0, radiusNm: 80, ceiling: 25000, validUntil: '2026-04-28T00:00:00Z', description: 'DANISH-GERMAN AIR EXERCISE BALTIC TIGER' },
  { id: 'NOTAM-004', type: 'AIRSPACE', lat: 34.2, lon: 35.9, radiusNm: 40, ceiling: 30000, validUntil: '2026-04-26T06:00:00Z', description: 'RESTRICTED AIRSPACE — ACTIVE CONFLICT ZONE' },
  { id: 'NOTAM-005', type: 'MILITARY', lat: 25.2, lon: 55.4, radiusNm: 60, ceiling: 40000, validUntil: '2026-04-27T18:00:00Z', description: 'UAE AIR FORCE EXERCISE FALCON SHIELD' },
  { id: 'NOTAM-006', type: 'EXERCISE', lat: 65.0, lon: 25.0, radiusNm: 120, ceiling: 45000, validUntil: '2026-04-30T00:00:00Z', description: 'FINNISH-SWEDISH AIR DEFENSE EXERCISE ARKTIS' },
  { id: 'NOTAM-007', type: 'TFR', lat: 51.5, lon: -0.1, radiusNm: 12, ceiling: 10000, validUntil: '2026-04-25T20:00:00Z', description: 'VIP MOVEMENT — LONDON HEATHROW RESTRICTION' },
  { id: 'NOTAM-008', type: 'MILITARY', lat: 36.2, lon: 129.2, radiusNm: 70, ceiling: 60000, validUntil: '2026-04-28T00:00:00Z', description: 'US-SOUTH KOREA COMBINED ARMS LIVE FIRE EXERCISE' },
]

// ---------------------------------------------------------------------------
// Module-level cache (15-minute TTL)
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: Notam[]
  fetchedAt: number
}

const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

// Use globalThis to survive hot-reload in dev
const g = globalThis as typeof globalThis & { _notamCache?: CacheEntry }

// ---------------------------------------------------------------------------
// Type mapping: FAA TFR type → Notam type
// ---------------------------------------------------------------------------

function mapFaaType(faaType: string): Notam['type'] | null {
  const t = faaType.toUpperCase()
  if (t.includes('VIP') || t.includes('SECURITY') || t.includes('SPECIAL')) return 'TFR'
  if (t.includes('SPACE') || t.includes('HAZARD') || t.includes('UAS')) return 'AIRSPACE'
  if (t.includes('AIR SHOW') || t.includes('SPORT')) return null // not military-relevant
  return null
}

// ---------------------------------------------------------------------------
// Compute polygon centroid from ring coordinates [lon, lat][]
// ---------------------------------------------------------------------------

function centroid(coords: number[][][]): { lat: number; lon: number } | null {
  const ring = coords[0]
  if (!ring || ring.length === 0) return null
  let sumLon = 0
  let sumLat = 0
  for (const point of ring) {
    sumLon += point[0] ?? 0
    sumLat += point[1] ?? 0
  }
  return {
    lat: parseFloat((sumLat / ring.length).toFixed(4)),
    lon: parseFloat((sumLon / ring.length).toFixed(4)),
  }
}

// ---------------------------------------------------------------------------
// Parse FAA mod_abs_time "YYYYMMDDHHII" → ISO string
// ---------------------------------------------------------------------------

function parseFaaDate(modAbsTime: string): string {
  // Format: "202605021737"  = 2026-05-02T17:37:00Z
  const s = modAbsTime.padEnd(12, '0')
  const year = s.slice(0, 4)
  const month = s.slice(4, 6)
  const day = s.slice(6, 8)
  const hour = s.slice(8, 10)
  const min = s.slice(10, 12)
  return `${year}-${month}-${day}T${hour}:${min}:00Z`
}

// ---------------------------------------------------------------------------
// Fetch live NOTAMs from FAA TFR API
// ---------------------------------------------------------------------------

async function fetchLiveNotams(): Promise<Notam[]> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10_000)

  try {
    // 1. Fetch TFR list (metadata: id, type, description, date)
    const [listRes, geoRes] = await Promise.all([
      fetch('https://tfr.faa.gov/tfrapi/getTfrList', {
        signal: controller.signal,
        headers: { 'User-Agent': 'Skyveil/1.0 (OSINT console)' },
      }),
      fetch(
        'https://tfr.faa.gov/geoserver/TFR/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=TFR:V_TFR_LOC&maxFeatures=300&outputFormat=application/json',
        {
          signal: controller.signal,
          headers: { 'User-Agent': 'Skyveil/1.0 (OSINT console)' },
        },
      ),
    ])

    if (!listRes.ok || !geoRes.ok) {
      throw new Error(`FAA API error — list:${listRes.status} geo:${geoRes.status}`)
    }

    const tfrList: FaaTfrItem[] = await listRes.json()
    const geoData: GeoServerResponse = await geoRes.json()

    // 2. Build centroid lookup: notam_id → {lat, lon}
    //    GeoServer NOTAM_KEY format: "6/6432-1-FDC-F" — base id is before first "-"
    const coordMap = new Map<string, { lat: number; lon: number }>()
    for (const feature of geoData.features) {
      const key = feature.properties.NOTAM_KEY.split('-')[0] // "6/6432"
      if (key && !coordMap.has(key) && feature.geometry?.coordinates) {
        const c = centroid(feature.geometry.coordinates)
        if (c) coordMap.set(key, c)
      }
    }

    // 3. Map, filter, limit
    const results: Notam[] = []

    for (const item of tfrList) {
      if (results.length >= 20) break

      const notamType = mapFaaType(item.type)
      if (!notamType) continue // skip non-military-relevant types

      const coords = coordMap.get(item.notam_id)
      // Require coordinates — without a location the entry is useless on a map
      if (!coords) continue

      const desc = item.description.slice(0, 150)

      results.push({
        id: item.notam_id,
        type: notamType,
        lat: coords.lat,
        lon: coords.lon,
        radiusNm: 25, // TFR list doesn't expose radius — default display value
        ceiling: 18000, // TFR list doesn't expose ceiling — default display value
        validUntil: parseFaaDate(item.mod_abs_time),
        description: desc,
      })
    }

    return results
  } finally {
    clearTimeout(timeoutId)
  }
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET() {
  // Serve from cache if still fresh
  const now = Date.now()
  if (g._notamCache && now - g._notamCache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ notams: g._notamCache.data })
  }

  try {
    const notams = await fetchLiveNotams()

    if (notams.length === 0) {
      // Empty result — unlikely but fall back gracefully
      return NextResponse.json({ notams: FALLBACK_NOTAMS })
    }

    g._notamCache = { data: notams, fetchedAt: now }
    return NextResponse.json({ notams })
  } catch (err) {
    console.error('[/api/notams] Live fetch failed — using fallback:', err)

    // Return stale cache if available, otherwise hardcoded fallback
    if (g._notamCache) {
      return NextResponse.json({ notams: g._notamCache.data })
    }

    return NextResponse.json({ notams: FALLBACK_NOTAMS })
  }
}
