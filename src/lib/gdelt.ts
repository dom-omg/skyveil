import https from 'https'
import type { ConflictEvent } from './types'

const GDELT_BASE = 'https://api.gdeltproject.org/api/v2/doc/doc'

interface GdeltArticle {
  url: string
  title: string
  seendate: string
  domain: string
  sourcecountry: string
}

interface GdeltResponse {
  articles?: GdeltArticle[]
}

const CONFLICT_QUERIES = [
  'military airstrike conflict',
  'naval warship deployment',
  'missile strike attack',
  'military offensive operation',
]

function parseGdeltDate(raw: string): string {
  try {
    const s = raw.replace('T', '').replace('Z', '')
    const y = s.slice(0, 4), mo = s.slice(4, 6), d = s.slice(6, 8)
    const h = s.slice(8, 10), m = s.slice(10, 12)
    return `${y}-${mo}-${d}T${h}:${m}:00Z`
  } catch {
    return new Date().toISOString()
  }
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'intel-dashboard/1.0' },
    }, res => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(10_000, () => { req.destroy(); reject(new Error('GDELT timeout')) })
  })
}

export async function fetchConflictEvents(): Promise<ConflictEvent[]> {
  const query = CONFLICT_QUERIES[Math.floor(Math.random() * CONFLICT_QUERIES.length)]

  const params = new URLSearchParams({
    query,
    mode: 'artlist',
    maxrecords: '25',
    timespan: '24H',
    format: 'json',
  })

  try {
    const raw = await httpsGet(`${GDELT_BASE}?${params}`)
    const data: GdeltResponse = JSON.parse(raw)
    if (!data.articles) return []

    return data.articles.map((a, i) => ({
      id: `gdelt-${i}-${Date.now()}`,
      title: a.title,
      url: a.url,
      source: a.domain,
      publishedAt: parseGdeltDate(a.seendate),
      domain: a.sourcecountry ?? '',
      tone: 0,
    }))
  } catch {
    return []
  }
}
