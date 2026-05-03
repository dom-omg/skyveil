import { NextRequest, NextResponse } from 'next/server'
import { generateBrief, filterByRadius } from '@/lib/claude-brief'
import { fetchMilitaryAircraft } from '@/lib/opensky'
import { fetchConflictEvents } from '@/lib/gdelt'
import type { Aircraft, ConflictEvent, OsintItem } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const OSINT_SOURCES = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC World' },
  { url: 'https://www.bellingcat.com/feed/', name: 'Bellingcat' },
  { url: 'https://warmonitor.substack.com/feed', name: 'WarMonitor' },
]

async function fetchRssFeed(url: string, sourceName: string): Promise<OsintItem[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'SKYVEIL/1.0' },
    signal: AbortSignal.timeout(4000),
  })
  const text = await res.text()
  const items: OsintItem[] = []
  const itemMatches = text.matchAll(/<item>([\s\S]*?)<\/item>/g)
  let idx = 0
  for (const match of itemMatches) {
    if (idx >= 3) break
    const block = match[1]
    const title = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
      ?? block.match(/<title>(.*?)<\/title>/)?.[1]
      ?? ''
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]
      ?? block.match(/<dc:date>(.*?)<\/dc:date>/)?.[1]
      ?? new Date().toISOString()
    const link = block.match(/<link>(.*?)<\/link>/)?.[1]
      ?? block.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1]
      ?? ''
    if (title) {
      items.push({
        id: `${sourceName}-${idx}`,
        title: title
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#39;/g, "'"),
        source: sourceName,
        url: link,
        publishedAt: new Date(pubDate).toISOString(),
      })
      idx++
    }
  }
  return items
}

async function fetchOsintItems(): Promise<OsintItem[]> {
  try {
    const results = await Promise.allSettled(
      OSINT_SOURCES.map(s => fetchRssFeed(s.url, s.name))
    )
    const items = results
      .flatMap(r => r.status === 'fulfilled' ? r.value : [])
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 6)
    return items
  } catch {
    return []
  }
}

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
    // OSINT RSS feed fetched in parallel — failure is non-blocking
    const [aircraftResult, eventsResult, osintResult] = await Promise.allSettled([
      body.aircraft && body.aircraft.length > 0
        ? Promise.resolve(body.aircraft)
        : fetchMilitaryAircraft(),
      body.events && body.events.length > 0
        ? Promise.resolve(body.events)
        : fetchConflictEvents(),
      fetchOsintItems(),
    ])

    const allAircraft: Aircraft[] = aircraftResult.status === 'fulfilled' ? aircraftResult.value : []
    const allEvents: ConflictEvent[] = eventsResult.status === 'fulfilled' ? eventsResult.value : []
    const osintItems: OsintItem[] = osintResult.status === 'fulfilled' ? osintResult.value : []

    const nearbyAircraft = filterByRadius(allAircraft, lat, lon, radiusKm)

    const brief = await generateBrief({
      lat,
      lon,
      radiusKm,
      aircraft: nearbyAircraft,
      events: allEvents,
      regionName,
      osintItems,
    })

    return NextResponse.json({ brief })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Brief generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
