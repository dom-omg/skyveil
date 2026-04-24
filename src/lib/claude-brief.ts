import Anthropic from '@anthropic-ai/sdk'
import type { Aircraft, ConflictEvent, IntelBrief } from './types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Haversine distance in km
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

export function filterByRadius(
  aircraft: Aircraft[],
  lat: number,
  lon: number,
  radiusKm: number
): Aircraft[] {
  return aircraft.filter(a => haversine(lat, lon, a.lat, a.lon) <= radiusKm)
}

// System prompt — kept long enough to hit the 1024-token caching threshold
const SYSTEM_PROMPT = `You are SKYVEIL, a military intelligence analyst trained on open-source data. You produce structured tactical briefs from real-time ADS-B aircraft telemetry and open-source news intelligence (OSINT).

Your briefs follow NATO INTSUM format adapted for OSINT use:

THREAT ASSESSMENT LEVELS:
- LOW: Routine military activity, no anomalies
- ELEVATED: Unusual concentration or pattern; monitor
- HIGH: Active operational signatures or confirmed strikes in area
- CRITICAL: Multi-domain activity, imminent or ongoing kinetic action

ANALYSIS RULES:
1. Only state what the data shows. Never speculate beyond what is observable.
2. Callsigns and aircraft types are classified as UNKNOWN unless publicly documented.
3. Altitude, speed, and heading data are from ADS-B and may have ±30m / ±5kt error margins.
4. GDELT articles are unverified open-source. Treat as signals, not confirmed facts.
5. Geographic clustering of military aircraft is an anomaly worth flagging.
6. If fewer than 3 aircraft or 2 events are present, assess as LOW unless content is directly kinetic.
7. Always include a CONFIDENCE score: HIGH (multiple corroborating sources), MEDIUM (single source), LOW (sparse data).

OUTPUT FORMAT (strict JSON, no markdown, no prose outside the JSON):
{
  "threatLevel": "LOW" | "ELEVATED" | "HIGH" | "CRITICAL",
  "headline": "one-line tactical summary under 80 chars",
  "summary": "2-4 sentence analytical summary of the situation",
  "keyObservations": ["observation 1", "observation 2", ...],
  "entities": ["callsign or org or country mentioned"],
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "dataQuality": "brief note on data completeness"
}

Produce exactly one JSON object. No commentary before or after.`

interface BriefInput {
  lat: number
  lon: number
  radiusKm: number
  aircraft: Aircraft[]
  events: ConflictEvent[]
  regionName?: string
}

export async function generateBrief(input: BriefInput): Promise<IntelBrief> {
  const { lat, lon, radiusKm, aircraft, events, regionName } = input

  const aircraftBlock = aircraft.length === 0
    ? 'No military aircraft detected in sector.'
    : aircraft.map(a =>
        `- ${a.callsign || a.icao24.toUpperCase()} | ${a.country} | ${Math.round(a.altitude)}m | ${Math.round(a.velocity * 3.6)}km/h | hdg ${a.heading.toFixed(0)}° | pos ${a.lat.toFixed(2)},${a.lon.toFixed(2)}`
      ).join('\n')

  const eventsBlock = events.length === 0
    ? 'No relevant OSINT events in feed.'
    : events.slice(0, 15).map(e =>
        `- [${e.source}] ${e.title} (${e.publishedAt.slice(0, 10)})`
      ).join('\n')

  const userMessage = `SECTOR BRIEF REQUEST
Region: ${regionName ?? `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`}
Center: ${lat.toFixed(4)}, ${lon.toFixed(4)}
Radius: ${radiusKm}km
Timestamp: ${new Date().toISOString()}

--- ADS-B MILITARY AIRCRAFT (${aircraft.length} tracks) ---
${aircraftBlock}

--- OSINT FEED (${events.length} articles, 24h window) ---
${eventsBlock}

Generate SKYVEIL brief.`

  let response: Awaited<ReturnType<typeof client.messages.create>>
  try {
    response = await client.messages.create({
      model: process.env.ANTHROPIC_DEFAULT_SONNET_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    })
  } catch (err) {
    const status = (err as Record<string, unknown>)?.status as number | undefined
    if (status === 429) throw new Error('API rate limited — wait 60s and retry')
    throw err
  }

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''

  let parsed: {
    threatLevel: string
    headline: string
    summary: string
    keyObservations: string[]
    entities: string[]
    confidence: string
    dataQuality: string
  }

  try {
    // Strip any accidental markdown fences
    const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
    parsed = JSON.parse(clean)
  } catch {
    throw new Error(`Claude returned non-JSON: ${raw.slice(0, 200)}`)
  }

  const validLevels = ['LOW', 'ELEVATED', 'HIGH', 'CRITICAL'] as const
  type ThreatLevel = typeof validLevels[number]
  const threatLevel: ThreatLevel = validLevels.includes(parsed.threatLevel as ThreatLevel)
    ? (parsed.threatLevel as ThreatLevel)
    : 'LOW'

  return {
    id: `brief-${Date.now()}`,
    region: regionName ?? `${lat.toFixed(2)}°N ${lon.toFixed(2)}°E`,
    summary: `**${parsed.headline}**\n\n${parsed.summary}\n\n**Key observations:**\n${parsed.keyObservations.map(o => `• ${o}`).join('\n')}\n\n**Confidence:** ${parsed.confidence} | **Data quality:** ${parsed.dataQuality}`,
    threatLevel,
    generatedAt: new Date().toISOString(),
    sources: events.slice(0, 5).map(e => e.source),
  }
}
