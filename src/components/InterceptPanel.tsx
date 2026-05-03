'use client'

import { useEffect, useState } from 'react'
import type { Aircraft } from '@/lib/types'

interface InterceptData {
  distKm: number
  distNm: number
  closingMs: number   // m/s — positive = converging, negative = diverging
  closingKts: number  // knots
  bearingDeg: number
  bearingLabel: string
  etaSeconds: number | null // null when diverging
  altA: number        // meters
  altB: number        // meters
  altAFt: number      // feet
  altBFt: number      // feet
}

interface Props {
  pair: [Aircraft, Aircraft]
  onClose: () => void
}

// ─── Math ────────────────────────────────────────────────────────────────────

const R = 6371 // Earth radius km

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const COMPASS_16 = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']

function bearingLabel(deg: number): string {
  return COMPASS_16[Math.round(deg / 22.5) % 16]
}

function computeIntercept(a: Aircraft, b: Aircraft): InterceptData {
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const dLat = lat2 - lat1
  const dLon = ((b.lon - a.lon) * Math.PI) / 180

  // Haversine distance
  const ha = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  const distKm = R * 2 * Math.atan2(Math.sqrt(ha), Math.sqrt(1 - ha))

  // Bearing A → B
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  const bearingDeg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360

  // Closing rate — project velocity vectors onto bearing unit vector
  const bRad = (bearingDeg * Math.PI) / 180
  const ubx = Math.sin(bRad)
  const uby = Math.cos(bRad)
  const vAx = a.velocity * Math.sin((a.heading * Math.PI) / 180)
  const vAy = a.velocity * Math.cos((a.heading * Math.PI) / 180)
  const vBx = b.velocity * Math.sin((b.heading * Math.PI) / 180)
  const vBy = b.velocity * Math.cos((b.heading * Math.PI) / 180)
  // Positive = A approaching B along bearing
  const closingMs = (vAx - vBx) * ubx + (vAy - vBy) * uby

  const etaSeconds = closingMs > 1 ? (distKm * 1000) / closingMs : null

  return {
    distKm,
    distNm: distKm / 1.852,
    closingMs,
    closingKts: closingMs * 1.94384,
    bearingDeg,
    bearingLabel: bearingLabel(bearingDeg),
    etaSeconds,
    altA: a.altitude,
    altB: b.altitude,
    altAFt: a.altitude * 3.28084,
    altBFt: b.altitude * 3.28084,
  }
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmtEta(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fmtAlt(meters: number, feet: number): string {
  return `${Math.round(meters).toLocaleString()}m / ${Math.round(feet / 100) * 100}ft`
}

// ─── Row component ────────────────────────────────────────────────────────────

interface RowProps {
  label: string
  value: string
  valueColor?: string
}

function Row({ label, value, valueColor = 'var(--foreground)' }: RowProps) {
  return (
    <>
      <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
        {label}
      </span>
      <span className="font-mono text-[11px] font-bold tabular-nums text-right" style={{ color: valueColor }}>
        {value}
      </span>
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InterceptPanel({ pair, onClose }: Props) {
  const [data, setData] = useState<InterceptData>(() => computeIntercept(pair[0], pair[1]))
  const [tick, setTick] = useState(0)

  // Recompute every second
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Recompute on tick or pair change
  useEffect(() => {
    setData(computeIntercept(pair[0], pair[1]))
  }, [pair, tick])

  const callsignA = pair[0].callsign || pair[0].icao24.toUpperCase()
  const callsignB = pair[1].callsign || pair[1].icao24.toUpperCase()

  const isConverging = data.closingMs > 1
  const isDiverging = !isConverging

  const closingColor = isConverging ? '#ef4444' : '#f59e0b'
  const etaColor = isConverging ? '#ef4444' : '#f59e0b'

  const closingDisplay = isConverging
    ? `+${data.closingMs.toFixed(1)} m/s · ${data.closingKts.toFixed(0)} kts`
    : `${data.closingMs.toFixed(1)} m/s · ${data.closingKts.toFixed(0)} kts`

  return (
    <div
      className="absolute bottom-20 right-4 rounded z-20 select-none"
      style={{
        background: 'rgba(9,9,11,0.97)',
        border: '1px solid rgba(255,102,0,0.45)',
        boxShadow: '0 0 24px rgba(255,102,0,0.08), 0 4px 24px rgba(0,0,0,0.7)',
        minWidth: 280,
        maxWidth: 320,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: '1px solid rgba(255,102,0,0.25)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: '#ff6600', boxShadow: '0 0 6px #ff6600' }}
          />
          <span
            className="font-mono text-[10px] font-bold tracking-widest uppercase"
            style={{ color: '#ff6600' }}
          >
            INTERCEPT CALC
          </span>
        </div>
        <button
          onClick={onClose}
          className="font-mono text-xs transition-opacity hover:opacity-70"
          style={{ color: 'var(--muted)' }}
        >
          [×]
        </button>
      </div>

      {/* Callsigns */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      >
        <span
          className="font-mono text-xs font-bold tracking-wider"
          style={{ color: 'var(--accent)' }}
        >
          {callsignA}
        </span>
        <span className="font-mono text-[9px]" style={{ color: 'rgba(255,102,0,0.5)' }}>
          ⊕
        </span>
        <span
          className="font-mono text-xs font-bold tracking-wider"
          style={{ color: '#ff6600' }}
        >
          {callsignB}
        </span>
      </div>

      {/* Data grid */}
      <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2">
        <Row
          label="Distance"
          value={`${data.distKm.toFixed(1)} km · ${data.distNm.toFixed(1)} nm`}
          valueColor="var(--foreground)"
        />
        <Row
          label="Bearing"
          value={`${Math.round(data.bearingDeg)}° ${data.bearingLabel}`}
          valueColor="var(--foreground)"
        />
        <Row
          label="Closing"
          value={closingDisplay}
          valueColor={closingColor}
        />
        <Row
          label="ETA"
          value={isConverging && data.etaSeconds !== null ? fmtEta(data.etaSeconds) : 'DIVERGING'}
          valueColor={etaColor}
        />
      </div>

      {/* Altitude section */}
      <div
        className="px-4 py-2.5"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
          Altitude
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          <div>
            <div className="font-mono text-[9px] mb-0.5" style={{ color: 'var(--accent)' }}>
              {callsignA}
            </div>
            <div className="font-mono text-[10px] tabular-nums" style={{ color: 'var(--foreground)' }}>
              {fmtAlt(data.altA, data.altAFt)}
            </div>
          </div>
          <div>
            <div className="font-mono text-[9px] mb-0.5" style={{ color: '#ff6600' }}>
              {callsignB}
            </div>
            <div className="font-mono text-[10px] tabular-nums" style={{ color: 'var(--foreground)' }}>
              {fmtAlt(data.altB, data.altBFt)}
            </div>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div
        className="px-4 py-2 flex items-center justify-between"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.3)' }}
      >
        <div className="flex items-center gap-1.5">
          <div
            className="w-1 h-1 rounded-full animate-pulse"
            style={{ background: isDiverging ? '#f59e0b' : '#ef4444' }}
          />
          <span
            className="font-mono text-[9px] uppercase tracking-widest"
            style={{ color: isDiverging ? '#f59e0b' : '#ef4444' }}
          >
            {isDiverging ? 'DIVERGING' : 'CONVERGING'}
          </span>
        </div>
        <span className="font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
          1s refresh · [I] toggle
        </span>
      </div>
    </div>
  )
}
