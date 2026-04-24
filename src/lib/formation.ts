import type { Aircraft } from './types'

export interface Formation {
  aircraft: Aircraft[]
  country: string
  heading: number
  lat: number
  lon: number
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function angularDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

export function detectFormations(aircraft: Aircraft[], radiusKm = 80, headingDeg = 15): Formation[] {
  const airborne = aircraft.filter(a => !a.onGround && a.velocity > 30)
  const used = new Set<string>()
  const formations: Formation[] = []

  for (const a of airborne) {
    if (used.has(a.icao24)) continue

    const peers = airborne.filter(b =>
      b.icao24 !== a.icao24 &&
      !used.has(b.icao24) &&
      haversine(a.lat, a.lon, b.lat, b.lon) <= radiusKm &&
      angularDiff(a.heading, b.heading) <= headingDeg
    )

    if (peers.length >= 1) {
      const group = [a, ...peers]
      group.forEach(ac => used.add(ac.icao24))
      formations.push({
        aircraft: group,
        country: a.country,
        heading: group.reduce((s, ac) => s + ac.heading, 0) / group.length,
        lat: group.reduce((s, ac) => s + ac.lat, 0) / group.length,
        lon: group.reduce((s, ac) => s + ac.lon, 0) / group.length,
      })
    }
  }

  return formations
}

export const SQUAWK_EMERGENCIES: Record<string, string> = {
  '7500': 'HIJACK',
  '7600': 'RADIO FAILURE',
  '7700': 'MAYDAY',
}

export function detectSquawkEmergencies(aircraft: Aircraft[]): { aircraft: Aircraft; label: string }[] {
  return aircraft
    .filter(a => a.squawk !== null && a.squawk in SQUAWK_EMERGENCIES)
    .map(a => ({ aircraft: a, label: SQUAWK_EMERGENCIES[a.squawk!] }))
}
