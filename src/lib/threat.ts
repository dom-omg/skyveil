import type { ConflictEvent, Notam } from './types'
import type { Cluster } from './cluster'
import type { Formation } from './formation'
export interface ThreatPoint {
  lat: number
  lon: number
  weight: number
}

export interface ThreatAssessment {
  score: number
  label: 'MINIMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL'
  color: string
  points: ThreatPoint[]
}

export function computeThreat(
  clusters: Cluster[],
  formations: Formation[],
  squawks: { aircraft: { lat: number; lon: number }; label: string }[],
  events: ConflictEvent[],
  notams: Notam[],
): ThreatAssessment {
  const points: ThreatPoint[] = []
  let score = 0

  for (const sq of squawks) {
    score += 20
    points.push({ lat: sq.aircraft.lat, lon: sq.aircraft.lon, weight: 10 })
  }

  for (const c of clusters) {
    score += Math.min(c.count * 4, 20)
    points.push({ lat: c.lat, lon: c.lon, weight: Math.min(c.count * 2, 8) })
  }

  for (const f of formations) {
    score += 8
    points.push({ lat: f.lat, lon: f.lon, weight: 5 })
  }

  const hotEvents = events.filter(e => e.tone < -5 && e.lat != null && e.lon != null)
  for (const e of hotEvents) {
    score += 2
    points.push({ lat: e.lat!, lon: e.lon!, weight: 3 })
  }

  for (const n of notams) {
    const w = n.type === 'MILITARY' ? 4 : n.type === 'EXERCISE' ? 3 : 2
    score += w
    points.push({ lat: n.lat, lon: n.lon, weight: w })
  }

  score = Math.min(100, Math.round(score))

  const label: ThreatAssessment['label'] =
    score >= 70 ? 'CRITICAL' : score >= 40 ? 'HIGH' : score >= 15 ? 'ELEVATED' : 'MINIMAL'

  const color =
    score >= 70 ? '#ef4444' : score >= 40 ? '#f59e0b' : score >= 15 ? '#facc15' : '#00e676'

  return { score, label, color, points }
}
