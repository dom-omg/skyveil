'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import type { Aircraft, ConflictEvent, IntelBrief, Ship, Notam } from '@/lib/types'
import { detectClusters, type Cluster } from '@/lib/cluster'
import { detectFormations, detectSquawkEmergencies, type Formation } from '@/lib/formation'
import { detectOrbits, type OrbitAircraft } from '@/lib/orbit'
import { computeThreat, type ThreatAssessment } from '@/lib/threat'
import { getDemoOrbitSeed, getDemoTrailSeed } from '@/lib/demo-data'
import AircraftPanel from '@/components/AircraftPanel'
import EventsFeed from '@/components/EventsFeed'
import BriefDrawer from '@/components/BriefDrawer'
import LiveATC from '@/components/LiveATC'
import NewsPlayer from '@/components/NewsPlayer'
import type { BriefTarget } from '@/components/Map'

const GlobeMap = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--background)' }}>
      <span className="font-mono text-sm animate-pulse" style={{ color: 'var(--muted)' }}>Initializing globe…</span>
    </div>
  ),
})

type ConnectionState = 'connecting' | 'live' | 'error' | 'reconnecting'

export interface ActivityEvent {
  type: 'CLUSTER' | 'FORMATION' | 'SQUAWK' | 'BRIEF' | 'ANOMALY' | 'ORBIT'
  message: string
  time: Date
  color: string
  lat?: number
  lon?: number
}

const MAX_HISTORY = 5
const SPEED_ANOMALY_THRESHOLD = 60
const MAX_TRAIL_POINTS = 6

function computeIntercept(a: Aircraft, b: Aircraft) {
  const R = 6371
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const dLat = lat2 - lat1
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const ha = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  const distKm = R * 2 * Math.atan2(Math.sqrt(ha), Math.sqrt(1 - ha))
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  const bearingDeg = ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
  const bRad = (bearingDeg * Math.PI) / 180
  const ubx = Math.sin(bRad), uby = Math.cos(bRad)
  const vAx = a.velocity * Math.sin((a.heading * Math.PI) / 180)
  const vAy = a.velocity * Math.cos((a.heading * Math.PI) / 180)
  const vBx = b.velocity * Math.sin((b.heading * Math.PI) / 180)
  const vBy = b.velocity * Math.cos((b.heading * Math.PI) / 180)
  const closingMs = (vAx - vBx) * ubx + (vAy - vBy) * uby
  return {
    distKm: Math.round(distKm),
    bearingDeg: Math.round(bearingDeg),
    closingKmh: Math.round(closingMs * 3.6),
    etaMin: closingMs > 10 ? Math.round((distKm * 1000) / closingMs / 60) : null,
  }
}

export default function Dashboard() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([])
  const [events, setEvents] = useState<ConflictEvent[]>([])
  const [selected, setSelected] = useState<Aircraft | null>(null)
  const [status, setStatus] = useState<ConnectionState>('connecting')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isDemo, setIsDemo] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [interceptMode, setInterceptMode] = useState(false)
  const [interceptTarget, setInterceptTarget] = useState<Aircraft | null>(null)

  // Brief state
  const [briefTarget, setBriefTarget] = useState<BriefTarget | null>(null)
  const [brief, setBrief] = useState<IntelBrief | null>(null)
  const [briefHistory, setBriefHistory] = useState<IntelBrief[]>([])
  const [briefLoading, setBriefLoading] = useState(false)
  const [briefError, setBriefError] = useState<string | null>(null)

  // Alert dismissal
  const [clusterAlertDismissed, setClusterAlertDismissed] = useState(false)
  const [squawkAlertDismissed, setSquawkAlertDismissed] = useState(false)
  const [formationAlertDismissed, setFormationAlertDismissed] = useState(false)

  // Flight trails
  const trailsHistRef = useRef<Map<string, { lat: number; lon: number }[]>>(new Map())
  const [trails, setTrails] = useState<Map<string, { lat: number; lon: number }[]>>(new Map())

  // Activity log
  const [activityLog, setActivityLog] = useState<ActivityEvent[]>([])
  const prevClustersRef = useRef<Cluster[]>([])
  const prevFormationsRef = useRef<Formation[]>([])
  const prevSquawksRef = useRef<string[]>([])

  // Ships + NOTAMs
  const [ships, setShips] = useState<Ship[]>([])
  const [notams, setNotams] = useState<Notam[]>([])

  // Orbit history — 20 points per aircraft for ISR detection
  const orbitHistRef = useRef<Map<string, { lat: number; lon: number }[]>>(new Map())
  const demoSeededRef = useRef(false)

  // Speed anomalies
  const prevVelocityRef = useRef<Map<string, number>>(new Map())
  const [speedAnomalies, setSpeedAnomalies] = useState<{ callsign: string; delta: number }[]>([])

  const esRef = useRef<EventSource | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aircraftRef = useRef<Aircraft[]>([])
  const eventsRef = useRef<ConflictEvent[]>([])

  useEffect(() => { aircraftRef.current = aircraft }, [aircraft])
  useEffect(() => { eventsRef.current = events }, [events])

  // Fetch ships and NOTAMs once on mount
  useEffect(() => {
    fetch('/api/ships').then(r => r.json()).then((d: { ships: Ship[] }) => setShips(d.ships)).catch(() => {})
    fetch('/api/notams').then(r => r.json()).then((d: { notams: Notam[] }) => setNotams(d.notams)).catch(() => {})
  }, [])

  const clusters: Cluster[] = useMemo(() => detectClusters(aircraft), [aircraft])
  const formations: Formation[] = useMemo(() => detectFormations(aircraft), [aircraft])
  const squawkAlerts = useMemo(() => detectSquawkEmergencies(aircraft), [aircraft])
  const orbits: OrbitAircraft[] = useMemo(() => detectOrbits(aircraft, orbitHistRef.current), [aircraft])
  const threat: ThreatAssessment = useMemo(
    () => computeThreat(clusters, formations, squawkAlerts, events, notams),
    [clusters, formations, squawkAlerts, events, notams]
  )

  const handleSelect = useCallback((ac: Aircraft) => {
    if (interceptMode && selected && ac.icao24 !== selected.icao24) {
      setInterceptTarget(ac)
      setInterceptMode(false)
    } else {
      setSelected(ac)
      setInterceptTarget(null)
    }
  }, [interceptMode, selected])

  const interceptPair = useMemo(() => {
    if (!selected || !interceptTarget) return undefined
    const a = aircraft.find(ac => ac.icao24 === selected.icao24) ?? selected
    const b = aircraft.find(ac => ac.icao24 === interceptTarget.icao24) ?? interceptTarget
    return [a, b] as [Aircraft, Aircraft]
  }, [selected, interceptTarget, aircraft])

  // Trail history — accumulate position on every aircraft update
  useEffect(() => {
    const hist = trailsHistRef.current
    const orbitHist = orbitHistRef.current
    for (const a of aircraft) {
      const pts = hist.get(a.icao24) ?? []
      const last = pts[pts.length - 1]
      if (!last || last.lat !== a.lat || last.lon !== a.lon) {
        pts.push({ lat: a.lat, lon: a.lon })
        if (pts.length > MAX_TRAIL_POINTS) pts.shift()
        hist.set(a.icao24, pts)
        // Orbit history keeps 20 points
        const oPts = orbitHist.get(a.icao24) ?? []
        oPts.push({ lat: a.lat, lon: a.lon })
        if (oPts.length > 20) oPts.shift()
        orbitHist.set(a.icao24, oPts)
      }
    }
    setTrails(new Map(hist))
  }, [aircraft])

  // Activity log — detect NEW events each cycle
  useEffect(() => {
    const newEvents: ActivityEvent[] = []
    const prevClusterKeys = new Set(prevClustersRef.current.map(c => `${c.country}-${c.count}`))
    clusters
      .filter(c => !prevClusterKeys.has(`${c.country}-${c.count}`))
      .forEach(c => newEvents.push({ type: 'CLUSTER', message: `Cluster — ${c.country} ×${c.count} aircraft`, time: new Date(), color: '#ef4444', lat: c.lat, lon: c.lon }))
    prevClustersRef.current = clusters
  }, [clusters])

  useEffect(() => {
    const newEvents: ActivityEvent[] = []
    const prevFormKeys = new Set(prevFormationsRef.current.map(f => `${f.country}-${f.aircraft.length}`))
    formations
      .filter(f => !prevFormKeys.has(`${f.country}-${f.aircraft.length}`))
      .forEach(f => newEvents.push({ type: 'FORMATION', message: `Formation — ${f.country} ×${f.aircraft.length} · hdg ${Math.round(f.heading)}°`, time: new Date(), color: '#f59e0b', lat: f.lat, lon: f.lon }))
    if (newEvents.length > 0) setActivityLog(l => [...newEvents, ...l].slice(0, 50))
    prevFormationsRef.current = formations
  }, [formations])

  useEffect(() => {
    const newEvents: ActivityEvent[] = []
    const prevIcaos = new Set(prevSquawksRef.current)
    squawkAlerts
      .filter(s => !prevIcaos.has(s.aircraft.icao24))
      .forEach(s => newEvents.push({ type: 'SQUAWK', message: `${s.label} — ${s.aircraft.callsign || s.aircraft.icao24.toUpperCase()} (${s.aircraft.squawk})`, time: new Date(), color: '#ef4444', lat: s.aircraft.lat, lon: s.aircraft.lon }))
    if (newEvents.length > 0) setActivityLog(l => [...newEvents, ...l].slice(0, 50))
    prevSquawksRef.current = squawkAlerts.map(s => s.aircraft.icao24)
  }, [squawkAlerts])

  // Orbit detection → activity log
  const prevOrbitsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const prev = prevOrbitsRef.current
    const newOrbits = orbits.filter(o => !prev.has(o.aircraft.icao24))
    if (newOrbits.length > 0) {
      setActivityLog(l => [
        ...newOrbits.map(o => ({
          type: 'ORBIT' as const,
          message: `ISR Pattern — ${o.aircraft.callsign || o.aircraft.icao24.toUpperCase()} orbiting ~${o.radiusKm}km radius`,
          time: new Date(),
          color: '#a855f7',
          lat: o.centerLat,
          lon: o.centerLon,
        })),
        ...l,
      ].slice(0, 50))
    }
    prevOrbitsRef.current = new Set(orbits.map(o => o.aircraft.icao24))
  }, [orbits])

  // Speed anomaly detection
  useEffect(() => {
    const prev = prevVelocityRef.current
    const anomalies = aircraft
      .filter(a => {
        const p = prev.get(a.icao24)
        return p !== undefined && Math.abs(a.velocity - p) > SPEED_ANOMALY_THRESHOLD
      })
      .map(a => ({
        callsign: a.callsign || a.icao24.toUpperCase(),
        delta: Math.round((a.velocity - (prev.get(a.icao24) ?? a.velocity)) * 3.6),
      }))
    if (anomalies.length > 0) {
      setSpeedAnomalies(anomalies.slice(0, 3))
      setActivityLog(l => [
        ...anomalies.slice(0, 2).map(a => ({
          type: 'ANOMALY' as const,
          message: `Speed Δ — ${a.callsign} ${a.delta > 0 ? '+' : ''}${a.delta} km/h`,
          time: new Date(),
          color: '#00e676',
        })),
        ...l,
      ].slice(0, 50))
    }
    for (const a of aircraft) prev.set(a.icao24, a.velocity)
  }, [aircraft])

  const connect = useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null }
    setStatus('connecting')
    const es = new EventSource('/api/stream')
    esRef.current = es

    es.addEventListener('aircraft', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { aircraft: Aircraft[]; stale?: boolean; demo?: boolean }
        setAircraft(data.aircraft)
        setLastUpdate(new Date())
        setIsDemo(!!data.demo)
        setStatus(data.stale ? 'reconnecting' : 'live')
        if (data.demo && !demoSeededRef.current) {
          demoSeededRef.current = true
          const orbitSeed = getDemoOrbitSeed()
          orbitHistRef.current.set(orbitSeed.icao24, orbitSeed.positions)
          const trailSeed = getDemoTrailSeed()
          for (const [icao24, pts] of trailSeed) {
            trailsHistRef.current.set(icao24, pts)
          }
        }
      } catch { /* malformed */ }
    })

    es.addEventListener('events', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { events: ConflictEvent[] }
        setEvents(data.events)
      } catch { /* malformed */ }
    })

    es.addEventListener('status', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { message: string }
        console.warn('[stream]', data.message)
        setStatus('error')
      } catch { /* malformed */ }
    })

    es.onerror = () => {
      es.close()
      esRef.current = null
      setStatus('reconnecting')
      retryRef.current = setTimeout(() => connect(), 15_000)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      esRef.current?.close()
      if (retryRef.current) clearTimeout(retryRef.current)
    }
  }, [connect])

  const handleBriefRequest = useCallback(async (target: BriefTarget) => {
    setBriefTarget(target)
    setBriefError(null)
    setBriefLoading(true)
    setBrief(prev => {
      if (prev) setBriefHistory(h => [prev, ...h].slice(0, MAX_HISTORY))
      return null
    })
    try {
      const res = await fetch('/api/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...target, aircraft: aircraftRef.current, events: eventsRef.current }),
      })
      const data = await res.json() as { brief?: IntelBrief; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Brief generation failed')
      setBrief(data.brief ?? null)
      if (data.brief) {
        setActivityLog(l => [{
          type: 'BRIEF' as const,
          message: `Brief — ${data.brief!.region} [${data.brief!.threatLevel}]`,
          time: new Date(),
          color: '#00e676',
        }, ...l].slice(0, 50))
      }
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setBriefLoading(false)
    }
  }, [])

  const closeBrief = useCallback(() => {
    setBrief(null)
    setBriefError(null)
    setBriefTarget(null)
    setBriefLoading(false)
  }, [])

  const briefCentroid = useCallback(() => {
    const ac = aircraftRef.current.filter(a => !a.onGround)
    if (ac.length === 0) return
    const lat = ac.reduce((s, a) => s + a.lat, 0) / ac.length
    const lon = ac.reduce((s, a) => s + a.lon, 0) / ac.length
    handleBriefRequest({ lat, lon, radiusKm: 500 })
  }, [handleBriefRequest])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'Escape') {
        closeBrief()
        setInterceptMode(false)
        setInterceptTarget(null)
        setFullscreen(false)
      }
      if (e.key === 'b' || e.key === 'B') briefCentroid()
      if (e.key === 'f' || e.key === 'F') setFullscreen(v => !v)
      if (e.key === 'i' || e.key === 'I') {
        if (selected) setInterceptMode(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [closeBrief, briefCentroid, selected])

  const topCluster = clusters[0] ?? null
  const topSquawk = squawkAlerts[0] ?? null
  const topFormation = formations[0] ?? null

  const statusColor = status === 'live' ? 'var(--accent)' : status === 'reconnecting' ? '#f59e0b' : 'var(--threat)'

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 z-10 shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'rgba(9,9,11,0.95)', backdropFilter: 'blur(8px)' }}>
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />
          <span className="font-mono text-sm font-bold tracking-widest uppercase" style={{ color: 'var(--foreground)' }}>
            SKYVEIL
          </span>
          {/* Threat score */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{
              background: `${threat.color}14`,
              border: `1px solid ${threat.color}40`,
              transition: 'all 0.6s ease',
            }}>
            <div className="w-1.5 h-1.5 rounded-full"
              style={{ background: threat.color, boxShadow: `0 0 6px ${threat.color}`, animation: threat.score >= 40 ? 'pulse 1.5s infinite' : 'none' }} />
            <span className="font-mono text-xs font-bold tabular-nums" style={{ color: threat.color }}>{threat.score}</span>
            <span className="font-mono text-[9px] tracking-widest" style={{ color: threat.color }}>{threat.label}</span>
          </div>
          {isDemo && (
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded tracking-widest"
              style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
              DEMO
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          {squawkAlerts.length > 0 && (
            <span className="animate-pulse font-bold" style={{ color: '#ef4444' }}>
              ⚡ {squawkAlerts.length} EMERGENCY
            </span>
          )}
          {formations.length > 0 && (
            <span style={{ color: '#f59e0b' }}>◈ {formations.length} formation{formations.length > 1 ? 's' : ''}</span>
          )}
          {clusters.length > 0 && (
            <span style={{ color: 'var(--threat)' }}>⚠ {clusters.length} cluster{clusters.length > 1 ? 's' : ''}</span>
          )}
          {orbits.length > 0 && (
            <span style={{ color: '#a855f7' }}>⊙ {orbits.length} ISR</span>
          )}
          <span style={{ color: statusColor }}>● {status.toUpperCase()}</span>
          {lastUpdate && <span style={{ color: 'var(--muted)' }}>{lastUpdate.toLocaleTimeString()}</span>}
          <span style={{ color: 'var(--muted)' }}>{aircraft.length} AC · {ships.length} NAV · {events.length} EVT</span>
        </div>
      </header>

      {/* Priority banners */}
      {topSquawk && !squawkAlertDismissed && (
        <div className="shrink-0 px-6 py-2 flex items-center justify-between animate-pulse"
          style={{ borderBottom: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)' }}>
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#ef4444' }} />
            <span style={{ color: '#fca5a5', fontWeight: 700 }}>⚡ SQUAWK {topSquawk.aircraft.squawk} — {topSquawk.label}</span>
            <span style={{ color: '#fca5a5' }}>{topSquawk.aircraft.callsign || topSquawk.aircraft.icao24.toUpperCase()} · {topSquawk.aircraft.country}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleBriefRequest({ lat: topSquawk.aircraft.lat, lon: topSquawk.aircraft.lon, radiusKm: 300 })}
              className="text-xs font-mono px-3 py-1 rounded"
              style={{ border: '1px solid rgba(239,68,68,0.5)', color: '#fca5a5', background: 'rgba(239,68,68,0.12)' }}>
              Brief →
            </button>
            <button onClick={() => setSquawkAlertDismissed(true)} className="font-mono text-xs" style={{ color: 'var(--muted)' }}>[×]</button>
          </div>
        </div>
      )}

      {topFormation && !formationAlertDismissed && !topSquawk && (
        <div className="shrink-0 px-6 py-2 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.05)' }}>
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#f59e0b' }} />
            <span style={{ color: '#fcd34d' }}>FORMATION — {topFormation.country} ×{topFormation.aircraft.length} · hdg {Math.round(topFormation.heading)}°</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleBriefRequest({ lat: topFormation.lat, lon: topFormation.lon, radiusKm: 300 })}
              className="text-xs font-mono px-3 py-1 rounded"
              style={{ border: '1px solid rgba(245,158,11,0.4)', color: '#fcd34d', background: 'rgba(245,158,11,0.08)' }}>
              Brief →
            </button>
            <button onClick={() => setFormationAlertDismissed(true)} className="font-mono text-xs" style={{ color: 'var(--muted)' }}>[×]</button>
          </div>
        </div>
      )}

      {topCluster && !clusterAlertDismissed && !topSquawk && !topFormation && (
        <div className="shrink-0 px-6 py-2 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)' }}>
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--threat)' }} />
            <span style={{ color: '#fca5a5' }}>CLUSTER — {topCluster.country} · {topCluster.count} aircraft within 300km</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleBriefRequest({ lat: topCluster.lat, lon: topCluster.lon, radiusKm: 500 })}
              className="text-xs font-mono px-3 py-1 rounded"
              style={{ border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', background: 'rgba(239,68,68,0.08)' }}>
              Generate brief →
            </button>
            <button onClick={() => setClusterAlertDismissed(true)} className="font-mono text-xs" style={{ color: 'var(--muted)' }}>[×]</button>
          </div>
        </div>
      )}

      {speedAnomalies.length > 0 && (
        <div className="shrink-0 px-6 py-1.5 flex items-center gap-4"
          style={{ borderBottom: '1px solid rgba(0,230,118,0.1)', background: 'rgba(0,230,118,0.03)' }}>
          <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Speed Δ</span>
          {speedAnomalies.map((a, i) => (
            <span key={i} className="text-[10px] font-mono" style={{ color: 'var(--accent)' }}>
              {a.callsign} {a.delta > 0 ? '+' : ''}{a.delta} km/h
            </span>
          ))}
        </div>
      )}

      {/* Layout */}
      <div className="flex flex-1 overflow-hidden">
        <aside className={`w-72 shrink-0 flex flex-col overflow-hidden${fullscreen ? ' hidden' : ''}`} style={{ borderRight: '1px solid var(--border)' }}>
          <div className="flex-1 overflow-hidden flex flex-col">
            <AircraftPanel
              aircraft={aircraft}
              selected={selected}
              onSelect={handleSelect}
              briefTarget={briefTarget}
            />
          </div>
          <LiveATC selected={selected} />
        </aside>

        <main className="flex-1 relative overflow-hidden">
          <GlobeMap
            aircraft={aircraft}
            ships={ships}
            notams={notams}
            clusters={clusters}
            formations={formations}
            orbits={orbits}
            threatPoints={threat.points}
            trails={trails}
            focusAircraft={selected}
            onAircraftSelect={handleSelect}
            onBriefRequest={handleBriefRequest}
            briefTarget={briefTarget}
            interceptPair={interceptPair}
          />
          <NewsPlayer />

          {/* Intercept mode banner */}
          {interceptMode && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 px-4 py-2 rounded font-mono text-xs animate-pulse pointer-events-none z-10"
              style={{ background: 'rgba(255,102,0,0.15)', border: '1px solid rgba(255,102,0,0.5)', color: '#ff6600' }}>
              ⊕ INTERCEPT MODE — click target aircraft
            </div>
          )}

          {/* Intercept result panel */}
          {interceptPair && (() => {
            const ic = computeIntercept(interceptPair[0], interceptPair[1])
            return (
              <div className="absolute bottom-36 left-1/2 -translate-x-1/2 rounded px-4 py-3 font-mono text-xs z-10"
                style={{ background: 'rgba(9,9,11,0.97)', border: '1px solid rgba(255,102,0,0.4)', minWidth: 260 }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-widest" style={{ color: '#ff6600' }}>⊕ INTERCEPT CALC</span>
                  <button onClick={() => { setInterceptTarget(null); setInterceptMode(false) }}
                    className="font-mono text-xs" style={{ color: 'var(--muted)' }}>[×]</button>
                </div>
                <div className="flex gap-4 mb-2">
                  <span style={{ color: 'var(--accent)' }}>{interceptPair[0].callsign || interceptPair[0].icao24.toUpperCase()}</span>
                  <span style={{ color: 'var(--muted)' }}>→</span>
                  <span style={{ color: '#ff6600' }}>{interceptPair[1].callsign || interceptPair[1].icao24.toUpperCase()}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  <span style={{ color: 'var(--muted)' }}>Distance</span>
                  <span style={{ color: 'var(--foreground)', fontWeight: 700 }}>{ic.distKm} km</span>
                  <span style={{ color: 'var(--muted)' }}>Bearing</span>
                  <span style={{ color: 'var(--foreground)', fontWeight: 700 }}>{ic.bearingDeg}°</span>
                  <span style={{ color: 'var(--muted)' }}>Closing</span>
                  <span style={{ color: ic.closingKmh > 0 ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>
                    {ic.closingKmh > 0 ? `${ic.closingKmh} km/h` : 'DIVERGING'}
                  </span>
                  <span style={{ color: 'var(--muted)' }}>ETA</span>
                  <span style={{ color: '#ef4444', fontWeight: 700 }}>
                    {ic.etaMin !== null ? `${ic.etaMin} min` : '—'}
                  </span>
                </div>
              </div>
            )
          })()}

          {/* Fullscreen exit hint */}
          {fullscreen && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded font-mono text-[10px] pointer-events-none"
              style={{ background: 'rgba(9,9,11,0.7)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
              F / ESC → exit fullscreen
            </div>
          )}

          <div className="absolute bottom-4 left-4 rounded px-3 py-2 font-mono text-xs pointer-events-none"
            style={{ background: 'rgba(9,9,11,0.85)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
            <div>Airborne <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{aircraft.filter(a => !a.onGround).length}</span></div>
            <div>Naval <span style={{ color: '#00b4ff', fontWeight: 700 }}>{ships.length}</span></div>
            <div>NOTAMs <span style={{ color: '#fb923c', fontWeight: 700 }}>{notams.length}</span></div>
            <div>Formations <span style={{ color: formations.length > 0 ? '#f59e0b' : 'var(--muted)', fontWeight: 700 }}>{formations.length}</span></div>
            <div>Clusters <span style={{ color: clusters.length > 0 ? 'var(--threat)' : 'var(--muted)', fontWeight: 700 }}>{clusters.length}</span></div>
          </div>
          <BriefDrawer brief={brief} history={briefHistory} loading={briefLoading} error={briefError} onClose={closeBrief} />
        </main>

        <aside className={`w-80 shrink-0 flex flex-col overflow-hidden${fullscreen ? ' hidden' : ''}`} style={{ borderLeft: '1px solid var(--border)' }}>
          <EventsFeed events={events} activities={activityLog} />
        </aside>
      </div>
    </div>
  )
}
