import { NextResponse } from 'next/server'
import type { Notam } from '@/lib/types'

const DEMO_NOTAMS: Notam[] = [
  { id: 'NOTAM-001', type: 'MILITARY', lat: 48.8, lon: 14.2, radiusNm: 50, ceiling: 18000, validUntil: '2026-05-01T00:00:00Z', description: 'LARGE SCALE NATO EXERCISE STEADFAST DEFENDER' },
  { id: 'NOTAM-002', type: 'TFR', lat: 38.9, lon: -77.0, radiusNm: 30, ceiling: 18000, validUntil: '2026-04-30T00:00:00Z', description: 'PRESIDENTIAL TFR ACTIVE — WASHINGTON DC' },
  { id: 'NOTAM-003', type: 'EXERCISE', lat: 57.5, lon: 10.0, radiusNm: 80, ceiling: 25000, validUntil: '2026-04-28T00:00:00Z', description: 'DANISH-GERMAN AIR EXERCISE BALTIC TIGER' },
  { id: 'NOTAM-004', type: 'AIRSPACE', lat: 34.2, lon: 35.9, radiusNm: 40, ceiling: 30000, validUntil: '2026-04-26T06:00:00Z', description: 'RESTRICTED AIRSPACE — ACTIVE CONFLICT ZONE' },
  { id: 'NOTAM-005', type: 'MILITARY', lat: 25.2, lon: 55.4, radiusNm: 60, ceiling: 40000, validUntil: '2026-04-27T18:00:00Z', description: 'UAE AIR FORCE EXERCISE FALCON SHIELD' },
  { id: 'NOTAM-006', type: 'EXERCISE', lat: 65.0, lon: 25.0, radiusNm: 120, ceiling: 45000, validUntil: '2026-04-30T00:00:00Z', description: 'FINNISH-SWEDISH AIR DEFENSE EXERCISE ARKTIS' },
  { id: 'NOTAM-007', type: 'TFR', lat: 51.5, lon: -0.1, radiusNm: 12, ceiling: 10000, validUntil: '2026-04-25T20:00:00Z', description: 'VIP MOVEMENT — LONDON HEATHROW RESTRICTION' },
  { id: 'NOTAM-008', type: 'MILITARY', lat: 36.2, lon: 129.2, radiusNm: 70, ceiling: 60000, validUntil: '2026-04-28T00:00:00Z', description: 'US-SOUTH KOREA COMBINED ARMS LIVE FIRE EXERCISE' },
]

export async function GET() {
  return NextResponse.json({ notams: DEMO_NOTAMS })
}
