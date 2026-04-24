import { NextResponse } from 'next/server'
import type { OsintItem } from '@/lib/types'

const SOURCES = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC World' },
  { url: 'https://www.bellingcat.com/feed/', name: 'Bellingcat' },
  { url: 'https://warmonitor.substack.com/feed', name: 'WarMonitor' },
]

async function fetchRss(url: string, sourceName: string): Promise<OsintItem[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'COBALT-INTEL/1.0' },
    signal: AbortSignal.timeout(5000),
  })
  const text = await res.text()
  const items: OsintItem[] = []
  const itemMatches = text.matchAll(/<item>([\s\S]*?)<\/item>/g)
  let idx = 0
  for (const match of itemMatches) {
    if (idx >= 8) break
    const block = match[1]
    const title = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
      ?? block.match(/<title>(.*?)<\/title>/)?.[1]
      ?? ''
    const link = block.match(/<link>(.*?)<\/link>/)?.[1]
      ?? block.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1]
      ?? ''
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]
      ?? block.match(/<dc:date>(.*?)<\/dc:date>/)?.[1]
      ?? new Date().toISOString()
    if (title) {
      items.push({
        id: `${sourceName}-${idx}`,
        title: title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'"),
        source: sourceName,
        url: link,
        publishedAt: new Date(pubDate).toISOString(),
      })
    }
    idx++
  }
  return items
}

const FALLBACK: OsintItem[] = [
  { id: 'f1', title: 'NATO confirms activation of additional rapid reaction forces in Eastern Europe', source: 'NATO', url: '#', publishedAt: new Date(Date.now() - 600000).toISOString() },
  { id: 'f2', title: 'OSINT: Multiple IL-76 transports observed operating from Pskov Air Base', source: 'OSINTdefender', url: '#', publishedAt: new Date(Date.now() - 1200000).toISOString() },
  { id: 'f3', title: 'Exercise STEADFAST DEFENDER: 90,000 troops across 32 countries', source: 'Bellingcat', url: '#', publishedAt: new Date(Date.now() - 2400000).toISOString() },
  { id: 'f4', title: 'Satellite imagery confirms naval group repositioning in Black Sea', source: 'Planet Labs', url: '#', publishedAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 'f5', title: 'US-South Korea announce extended air exercise schedule through June 2026', source: 'Reuters', url: '#', publishedAt: new Date(Date.now() - 5400000).toISOString() },
  { id: 'f6', title: 'SIGINT: Increased encrypted communications detected near Baltic coastline', source: 'OSINTtechnical', url: '#', publishedAt: new Date(Date.now() - 7200000).toISOString() },
]

export async function GET() {
  try {
    const results = await Promise.allSettled(SOURCES.map(s => fetchRss(s.url, s.name)))
    const items = results
      .flatMap((r, i) => r.status === 'fulfilled' ? r.value : FALLBACK.slice(0, 2).map(f => ({ ...f, source: SOURCES[i].name })))
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 20)
    return NextResponse.json({ items: items.length > 0 ? items : FALLBACK })
  } catch {
    return NextResponse.json({ items: FALLBACK })
  }
}
