import { NextResponse } from 'next/server'
import { fetchConflictEvents } from '@/lib/gdelt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const events = await fetchConflictEvents()
    return NextResponse.json({ events, timestamp: Date.now() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
