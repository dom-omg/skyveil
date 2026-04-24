import { NextResponse } from 'next/server'
import { fetchMilitaryAircraft } from '@/lib/opensky'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const aircraft = await fetchMilitaryAircraft()
    return NextResponse.json({ aircraft, timestamp: Date.now() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
