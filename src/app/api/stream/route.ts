import { fetchMilitaryAircraft, getCacheAge } from '@/lib/opensky'
import { fetchConflictEvents } from '@/lib/gdelt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false

      const send = (event: string, data: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          closed = true
        }
      }

      // Initial load — retry up to 3 times with 5s gap on 429
      let aircraft: import('@/lib/types').Aircraft[] = []
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          aircraft = await fetchMilitaryAircraft()
          break
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'fetch failed'
          if (attempt === 2) {
            send('status', { message: msg, stale: false })
          } else {
            await new Promise(r => setTimeout(r, 5000))
          }
        }
      }

      if (aircraft.length > 0) {
        send('aircraft', { aircraft, timestamp: Date.now(), stale: false })
      }

      // Load events (non-blocking — don't block aircraft on this)
      fetchConflictEvents()
        .then(events => send('events', { events, timestamp: Date.now() }))
        .catch(() => { /* gdelt is optional */ })

      // Refresh aircraft every 30s
      const aircraftInterval = setInterval(async () => {
        try {
          const fresh = await fetchMilitaryAircraft()
          const age = getCacheAge()
          send('aircraft', { aircraft: fresh, timestamp: Date.now(), stale: age > 120_000 })
        } catch {
          // stream stays alive — client keeps last known state
        }
      }, 30_000)

      // Refresh events every 5 min
      const eventsInterval = setInterval(async () => {
        try {
          const events = await fetchConflictEvents()
          send('events', { events, timestamp: Date.now() })
        } catch { /* skip */ }
      }, 300_000)

      // Heartbeat
      const heartbeat = setInterval(() => {
        if (closed) {
          clearInterval(aircraftInterval)
          clearInterval(eventsInterval)
          clearInterval(heartbeat)
          return
        }
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          closed = true
          clearInterval(aircraftInterval)
          clearInterval(eventsInterval)
          clearInterval(heartbeat)
        }
      }, 30_000)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
