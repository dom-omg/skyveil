import type { Aircraft } from './types'

export interface Cluster {
  country: string
  lat: number
  lon: number
  count: number
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

export function detectClusters(aircraft: Aircraft[], radiusKm = 300, minCount = 3): Cluster[] {
  const airborne = aircraft.filter(a => !a.onGround)

  const byCountry = new Map<string, Aircraft[]>()
  for (const a of airborne) {
    const arr = byCountry.get(a.country) ?? []
    arr.push(a)
    byCountry.set(a.country, arr)
  }

  const clusters: Cluster[] = []

  for (const [country, planes] of byCountry) {
    if (planes.length < minCount) continue

    for (const center of planes) {
      const nearby = planes.filter(
        p => p !== center && haversine(center.lat, center.lon, p.lat, p.lon) <= radiusKm
      )
      if (nearby.length >= minCount - 1) {
        const group = [center, ...nearby]
        const lat = group.reduce((s, p) => s + p.lat, 0) / group.length
        const lon = group.reduce((s, p) => s + p.lon, 0) / group.length
        clusters.push({ country, lat, lon, count: group.length })
        break
      }
    }
  }

  return clusters
}
