import type { Aircraft } from './types'

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export interface OrbitAircraft {
  aircraft: Aircraft
  centerLat: number
  centerLon: number
  radiusKm: number
}

export function detectOrbits(
  aircraft: Aircraft[],
  history: Map<string, { lat: number; lon: number }[]>
): OrbitAircraft[] {
  const orbits: OrbitAircraft[] = []

  for (const a of aircraft) {
    if (a.onGround) continue
    const pts = history.get(a.icao24) ?? []
    if (pts.length < 10) continue

    const centerLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length
    const centerLon = pts.reduce((s, p) => s + p.lon, 0) / pts.length

    // Max radius from centroid
    const maxR = Math.max(...pts.map(p => haversine(centerLat, centerLon, p.lat, p.lon)))

    // Max step distance between consecutive points (filters straight-line transit)
    let totalHeadingChange = 0
    for (let i = 1; i < pts.length - 1; i++) {
      const h1 = Math.atan2(pts[i].lon - pts[i - 1].lon, pts[i].lat - pts[i - 1].lat) * (180 / Math.PI)
      const h2 = Math.atan2(pts[i + 1].lon - pts[i].lon, pts[i + 1].lat - pts[i].lat) * (180 / Math.PI)
      totalHeadingChange += Math.abs(h2 - h1)
    }

    // ISR orbit: confined area + consistent turning
    if (maxR < 120 && totalHeadingChange > 60) {
      orbits.push({ aircraft: a, centerLat, centerLon, radiusKm: Math.round(maxR) })
    }
  }

  return orbits
}
