'use client'

import { useState, useMemo } from 'react'
import type { Aircraft } from '@/lib/types'
import type { BriefTarget } from './Map'

interface Props {
  aircraft: Aircraft[]
  selected: Aircraft | null
  onSelect: (a: Aircraft) => void
  briefTarget: BriefTarget | null
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
function headingLabel(deg: number): string {
  return COMPASS[Math.round(deg / 45) % 8]
}

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

function altDot(alt: number) {
  const col = alt < 3000 ? '#ef4444' : alt < 8000 ? '#f59e0b' : '#00e676'
  return <span style={{ color: col }}>●</span>
}

type SortKey = 'alt_desc' | 'alt_asc' | 'spd_desc' | 'spd_asc'

const SORT_LABELS: Record<SortKey, string> = {
  alt_desc: 'ALT ↓', alt_asc: 'ALT ↑', spd_desc: 'SPD ↓', spd_asc: 'SPD ↑',
}

function sortFn(key: SortKey) {
  return (a: Aircraft, b: Aircraft) => {
    // Emergencies always first
    const aEmerg = a.squawk && ['7500','7600','7700'].includes(a.squawk) ? 1 : 0
    const bEmerg = b.squawk && ['7500','7600','7700'].includes(b.squawk) ? 1 : 0
    if (aEmerg !== bEmerg) return bEmerg - aEmerg
    if (key === 'alt_desc') return b.altitude - a.altitude
    if (key === 'alt_asc') return a.altitude - b.altitude
    if (key === 'spd_desc') return b.velocity - a.velocity
    return a.velocity - b.velocity
  }
}

export default function AircraftPanel({ aircraft, selected, onSelect, briefTarget }: Props) {
  const [country, setCountry] = useState<string>('ALL')
  const [altMin, setAltMin] = useState(0)
  const [altMax, setAltMax] = useState(15000)
  const [showFilter, setShowFilter] = useState(false)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('alt_desc')

  const countries = useMemo(() => {
    const set = new Set(aircraft.map(a => a.country))
    return ['ALL', ...Array.from(set).sort()]
  }, [aircraft])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return aircraft.filter(a =>
      (country === 'ALL' || a.country === country) &&
      a.altitude >= altMin && a.altitude <= altMax &&
      (q === '' || a.callsign.toLowerCase().includes(q) || a.icao24.toLowerCase().includes(q))
    )
  }, [aircraft, country, altMin, altMax, search])

  const byCountry = useMemo(() => {
    const map = new Map<string, Aircraft[]>()
    for (const a of [...filtered].sort(sortFn(sortKey))) {
      const arr = map.get(a.country) ?? []
      arr.push(a)
      map.set(a.country, arr)
    }
    return map
  }, [filtered, sortKey])

  const distFromTarget = selected && briefTarget
    ? haversine(selected.lat, selected.lon, briefTarget.lat, briefTarget.lon)
    : null

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface)' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full" style={{ background: 'var(--accent)' }} />
              <span className="font-mono text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--foreground)' }}>
                Military AC
              </span>
            </div>
            <button
              onClick={() => setShowFilter(f => !f)}
              className="text-[10px] font-mono px-2 py-0.5 rounded transition-all"
              style={{
                border: `1px solid ${showFilter ? 'var(--accent)' : 'var(--border)'}`,
                color: showFilter ? 'var(--accent)' : 'var(--muted)',
                background: showFilter ? 'rgba(0,230,118,0.06)' : 'transparent',
              }}
            >
              FILTER
            </button>
          </div>
          <div className="flex items-center gap-2 pl-3">
            <span className="font-mono text-xl font-bold" style={{ color: 'var(--accent)' }}>
              {filtered.length}
            </span>
            <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
              / {aircraft.length} tracked
            </span>
          </div>
        </div>

        {/* Sort controls */}
        <div className="px-4 pb-2 flex gap-1">
          {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
            <button key={k} onClick={() => setSortKey(k)}
              className="flex-1 text-[9px] font-mono py-0.5 rounded transition-all"
              style={{
                background: sortKey === k ? 'rgba(0,230,118,0.1)' : 'transparent',
                color: sortKey === k ? 'var(--accent)' : 'var(--muted)',
                border: `1px solid ${sortKey === k ? 'rgba(0,230,118,0.3)' : 'var(--border)'}`,
              }}>
              {SORT_LABELS[k]}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <input
            type="text"
            placeholder="Search callsign / ICAO…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded text-xs font-mono px-3 py-1.5 focus:outline-none"
            style={{
              background: 'rgba(0,0,0,0.4)',
              border: `1px solid ${search ? 'var(--accent)' : 'var(--border)'}`,
              color: 'var(--foreground)',
            }}
          />
        </div>
      </div>

      {/* Filter panel */}
      {showFilter && (
        <div className="px-4 py-3 space-y-3" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.25)' }}>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Country</label>
            <select
              value={country}
              onChange={e => setCountry(e.target.value)}
              className="mt-1 w-full rounded text-xs font-mono px-2 py-1 focus:outline-none"
              style={{ background: '#111113', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            >
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
              Alt: {Math.round(altMin / 1000)}k – {Math.round(altMax / 1000)}km
            </label>
            <div className="flex gap-2 mt-1">
              <input type="range" min={0} max={15000} step={500} value={altMin}
                onChange={e => setAltMin(Math.min(Number(e.target.value), altMax - 500))}
                className="flex-1" style={{ accentColor: 'var(--accent)' }} />
              <input type="range" min={0} max={15000} step={500} value={altMax}
                onChange={e => setAltMax(Math.max(Number(e.target.value), altMin + 500))}
                className="flex-1" style={{ accentColor: 'var(--accent)' }} />
            </div>
          </div>
          <button onClick={() => { setCountry('ALL'); setAltMin(0); setAltMax(15000) }}
            className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>
            ↺ Reset
          </button>
        </div>
      )}

      {/* Aircraft list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-xs px-4 py-8 text-center" style={{ color: 'var(--muted)' }}>
            No aircraft match filters
          </p>
        )}

        {Array.from(byCountry.entries()).map(([ctry, planes]) => (
          <div key={ctry}>
            {/* Country group header */}
            <div className="sticky top-0 px-4 py-1.5 flex items-center justify-between z-10"
              style={{ background: '#0c0c0e', borderBottom: '1px solid var(--border)' }}>
              <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                {ctry}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--muted)' }}>
                {planes.length}
              </span>
            </div>

            {planes.map(a => {
              const isSelected = selected?.icao24 === a.icao24
              const hasEmergency = a.squawk && ['7500', '7600', '7700'].includes(a.squawk)
              return (
                <button
                  key={a.icao24}
                  onClick={() => onSelect(a)}
                  className="w-full text-left px-4 py-2.5 transition-all"
                  style={{
                    borderBottom: '1px solid var(--border)',
                    borderLeft: isSelected ? '2px solid var(--accent)' : hasEmergency ? '2px solid #ef4444' : '2px solid transparent',
                    background: isSelected ? 'rgba(0,230,118,0.04)' : 'transparent',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)' }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {altDot(a.altitude)}
                      <span className="font-mono text-xs truncate" style={{ color: isSelected ? 'var(--accent)' : hasEmergency ? '#ef4444' : 'var(--foreground)' }}>
                        {a.callsign || a.icao24.toUpperCase()}
                      </span>
                      {hasEmergency && (
                        <span className="text-[9px] font-mono px-1 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                          {a.squawk}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] shrink-0" style={{ color: 'var(--muted)' }}>
                      {(Math.round(a.altitude / 100) * 100).toLocaleString()}m
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 pl-3 text-[10px] font-mono" style={{ color: 'var(--muted)' }}>
                    <span>{Math.round(a.velocity * 3.6)} km/h</span>
                    <span>{headingLabel(a.heading)} {a.heading.toFixed(0)}°</span>
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Selected detail */}
      {selected && (
        <div className="shrink-0" style={{ borderTop: '2px solid var(--accent)', background: '#0c0c0e' }}>
          <div className="px-4 pt-3 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-mono text-sm font-bold" style={{ color: 'var(--accent)' }}>
                  {selected.callsign || selected.icao24.toUpperCase()}
                </div>
                <div className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>{selected.country}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                  {Math.round(selected.altitude).toLocaleString()}
                </div>
                <div className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>meters</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 shrink-0">
                <div className="absolute inset-0 rounded-full" style={{ border: '1px solid var(--border)' }} />
                <div className="absolute inset-0 flex items-center justify-center text-lg"
                  style={{ transform: `rotate(${selected.heading}deg)`, color: 'var(--accent)' }}>↑</div>
                <div className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[7px] font-mono" style={{ color: 'var(--muted)' }}>N</div>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] font-mono">
                {[
                  ['HDG', `${headingLabel(selected.heading)} ${selected.heading.toFixed(0)}°`],
                  ['SPD', `${Math.round(selected.velocity * 3.6)} km/h`],
                  ['ICAO', selected.icao24],
                  ['POS', `${selected.lat.toFixed(2)}, ${selected.lon.toFixed(2)}`],
                  ...(distFromTarget !== null ? [['DIST', `${Math.round(distFromTarget)} km`]] : []),
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-1">
                    <span style={{ color: 'var(--muted)' }}>{k}</span>
                    <span style={{ color: 'var(--foreground)' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
