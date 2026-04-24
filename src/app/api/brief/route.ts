import { NextRequest, NextResponse } from 'next/server'
import { generateBrief, filterByRadius } from '@/lib/claude-brief'
import { fetchMilitaryAircraft } from '@/lib/opensky'
import { fetchConflictEvents } from '@/lib/gdelt'
import type { Aircraft, ConflictEvent } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface BriefRequest {
  lat: number
  lon: number
  radiusKm: number
  regionName?: string
  aircraft?: Aircraft[]   // client can pass cached data
  events?: ConflictEvent[]
}

export async function POST(req: NextRequest) {
  try {
    const body: BriefRequest = await req.json()
    const { lat, lon, radiusKm = 500, regionName } = body

    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return NextResponse.json({ error: 'lat and lon required' }, { status: 400 })
    }

    // Use client-provided data if fresh, otherwise re-fetch
    const [allAircraft, allEvents] = await Promise.all([
      body.aircraft && body.aircraft.length > 0
        ? Promise.resolve(body.aircraft)
        : fetchMilitaryAircraft(),
      body.events && body.events.length > 0
        ? Promise.resolve(body.events)
        : fetchConflictEvents(),
    ])

    const nearbyAircraft = filterByRadius(allAircraft, lat, lon, radiusKm)

    const brief = await generateBrief({
      lat,
      lon,
      radiusKm,
      aircraft: nearbyAircraft,
      events: allEvents,
      regionName,
    })

    return NextResponse.json({ brief })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Brief generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
