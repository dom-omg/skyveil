'use client'

import { useEffect, useRef, useState } from 'react'
import type { Aircraft, Ship, Notam } from '@/lib/types'
import type { Cluster } from '@/lib/cluster'
import type { Formation } from '@/lib/formation'

export interface BriefTarget {
  lat: number
  lon: number
  radiusKm: number
}

interface Props {
  aircraft: Aircraft[]
  ships: Ship[]
  notams: Notam[]
  clusters: Cluster[]
  formations: Formation[]
  trails: Map<string, { lat: number; lon: number }[]>
  focusAircraft: Aircraft | null
  onAircraftSelect: (a: Aircraft) => void
  onBriefRequest: (target: BriefTarget) => void
  briefTarget: BriefTarget | null
}

const BRIEF_RADIUS_KM = 500

const GLOBE_TEXTURES = [
  { label: 'NIGHT', url: 'https://unpkg.com/three-globe/example/img/earth-night.jpg' },
  { label: 'DAY', url: 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg' },
  { label: 'TOPO', url: 'https://unpkg.com/three-globe/example/img/earth-topology.png' },
]

function altColor(altM: number): string {
  if (altM < 3000) return '#ff4444'
  if (altM < 8000) return '#f59e0b'
  return '#00e676'
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GeoFeature = { properties: { ADMIN?: string; NAME?: string } }
type ArcDatum = { sLat: number; sLng: number; eLat: number; eLng: number; col: string; isTrail: boolean }

function shipColor(type: Ship['type']): string {
  switch (type) {
    case 'carrier': return '#00b4ff'
    case 'destroyer': return '#4dd0e1'
    case 'submarine': return '#7986cb'
    case 'frigate': return '#26c6da'
    case 'supply': return '#80cbc4'
    default: return '#546e7a'
  }
}

export default function MapComponent({
  aircraft, ships, notams, clusters, formations, trails, focusAircraft,
  onAircraftSelect, onBriefRequest, briefTarget,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null)
  const onBriefRef = useRef(onBriefRequest)
  const onSelectRef = useRef(onAircraftSelect)
  const aircraftMapRef = useRef<Map<string, Aircraft>>(new Map())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countriesRef = useRef<any[]>([])
  const [textureIdx, setTextureIdx] = useState(0)

  useEffect(() => { onBriefRef.current = onBriefRequest }, [onBriefRequest])
  useEffect(() => { onSelectRef.current = onAircraftSelect }, [onAircraftSelect])
  useEffect(() => {
    aircraftMapRef.current = new Map(aircraft.map(a => [a.icao24, a]))
  }, [aircraft])

  // Init globe
  useEffect(() => {
    if (!containerRef.current || globeRef.current) return

    import('globe.gl').then(mod => {
      if (!containerRef.current || globeRef.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Globe = (mod as any).default ?? mod
      const globe = Globe()(containerRef.current)

      globe
        .globeImageUrl(GLOBE_TEXTURES[0].url)
        .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
        .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
        .showAtmosphere(true)
        .atmosphereColor('#003300')
        .atmosphereAltitude(0.12)
        .width(containerRef.current.clientWidth)
        .height(containerRef.current.clientHeight)

      globe.controls().autoRotate = true
      globe.controls().autoRotateSpeed = 0.2
      globe.controls().enableDamping = true

      globe.onGlobeRightClick((coords: { lat: number; lng: number } | null) => {
        if (!coords) return
        onBriefRef.current({ lat: coords.lat, lon: coords.lng, radiusKm: BRIEF_RADIUS_KM })
      })

      // Stop auto-rotate when user interacts
      globe.controls().addEventListener('start', () => {
        globe.controls().autoRotate = false
      })

      // Points
      globe
        .pointsData([])
        .pointLat((a: Aircraft) => a.lat)
        .pointLng((a: Aircraft) => a.lon)
        .pointColor((a: Aircraft) => altColor(a.altitude))
        .pointAltitude(0.005)
        .pointRadius((a: Aircraft) => a.squawk && ['7500','7600','7700'].includes(a.squawk) ? 0.7 : 0.35)
        .pointsTransitionDuration(900)
        .pointLabel((a: Aircraft) => `
          <div style="background:rgba(9,9,11,0.97);border:1px solid rgba(0,230,118,0.25);border-radius:4px;padding:8px 12px;font-family:monospace;font-size:12px;color:#e2e8e2;min-width:165px;">
            <div style="font-weight:700;color:#fff;margin-bottom:3px">${a.callsign || a.icao24.toUpperCase()}${a.squawk && ['7500','7600','7700'].includes(a.squawk) ? ` <span style="color:#ef4444">⚠ ${a.squawk}</span>` : ''}</div>
            <div style="color:#4a5248;font-size:11px">${a.country}</div>
            <div style="margin-top:5px;display:flex;gap:10px">
              <span style="color:${altColor(a.altitude)}">${Math.round(a.altitude)}m</span>
              <span style="color:#e2e8e2">${Math.round(a.velocity * 3.6)}km/h</span>
              <span style="color:#e2e8e2">${a.heading.toFixed(0)}°</span>
            </div>
            <div style="margin-top:6px;color:#4a5248;font-size:10px">Click → select + brief</div>
          </div>
        `)
        .onPointClick((a: Aircraft) => {
          const cur = aircraftMapRef.current.get(a.icao24) ?? a
          onSelectRef.current(cur)
          onBriefRef.current({ lat: cur.lat, lon: cur.lon, radiusKm: BRIEF_RADIUS_KM })
        })

      // Arcs — velocity vectors + trails (combined, differentiated by isTrail flag)
      globe
        .arcsData([])
        .arcStartLat((d: ArcDatum) => d.sLat)
        .arcStartLng((d: ArcDatum) => d.sLng)
        .arcEndLat((d: ArcDatum) => d.eLat)
        .arcEndLng((d: ArcDatum) => d.eLng)
        .arcColor((d: ArcDatum) => d.col)
        .arcStroke((d: ArcDatum) => d.isTrail ? 0.2 : 0.4)
        .arcDashLength((d: ArcDatum) => d.isTrail ? 1 : 0.5)
        .arcDashGap((d: ArcDatum) => d.isTrail ? 0 : 0.15)
        .arcDashAnimateTime((d: ArcDatum) => d.isTrail ? 0 : 1800)
        .arcAltitude((d: ArcDatum) => d.isTrail ? 0.001 : undefined)
        .arcsTransitionDuration(0)

      // Labels
      globe
        .labelsData([])
        .labelLat((d: { lat: number }) => d.lat)
        .labelLng((d: { lng: number }) => d.lng)
        .labelText((d: { text: string }) => d.text)
        .labelColor((d: { col: string }) => d.col)
        .labelSize(1.2)
        .labelDotRadius(0.6)
        .labelAltitude(0.02)
        .labelResolution(3)

      // Ships custom HTML layer
      globe
        .htmlElementsData([])
        .htmlLat((d: Ship) => d.lat)
        .htmlLng((d: Ship) => d.lon)
        .htmlAltitude(0.005)
        .htmlElement((d: Ship) => {
          const el = document.createElement('div')
          const col = shipColor(d.type)
          el.innerHTML = `<div title="${d.name}" style="width:8px;height:8px;border-radius:2px;background:${col};box-shadow:0 0 6px ${col};transform:rotate(45deg);cursor:pointer;opacity:0.9;border:1px solid ${col}88;"></div>`
          el.addEventListener('click', () => {
            onBriefRef.current({ lat: d.lat, lon: d.lon, radiusKm: 300 })
          })
          return el
        })

      // Country polygons
      fetch('https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
        .then(r => r.json())
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((data: { features: any[] }) => {
          countriesRef.current = data.features
          globe
            .polygonsData(data.features)
            .polygonCapColor(() => 'rgba(0,230,118,0.02)')
            .polygonSideColor(() => 'rgba(0,230,118,0.03)')
            .polygonStrokeColor(() => 'rgba(255,255,255,0.08)')
            .polygonAltitude(0.001)
            .polygonLabel((d: GeoFeature) => d.properties.ADMIN ?? d.properties.NAME ?? '')
        })
        .catch(() => { /* offline or blocked */ })

      globeRef.current = globe

      const ro = new ResizeObserver(() => {
        if (!containerRef.current || !globeRef.current) return
        globeRef.current.width(containerRef.current.clientWidth).height(containerRef.current.clientHeight)
      })
      ro.observe(containerRef.current)
    })

    return () => { globeRef.current = null }
  }, [])

  // Texture toggle
  useEffect(() => {
    if (!globeRef.current) return
    globeRef.current.globeImageUrl(GLOBE_TEXTURES[textureIdx].url)
  }, [textureIdx])

  // Aircraft points
  useEffect(() => {
    if (!globeRef.current) return
    globeRef.current.pointsData(aircraft)
  }, [aircraft])

  // Arcs: velocity vectors + trails combined
  useEffect(() => {
    if (!globeRef.current) return

    const acMap = aircraftMapRef.current

    // Trail arcs — fading path history
    const trailArcs: ArcDatum[] = []
    for (const [icao24, positions] of trails) {
      if (positions.length < 2) continue
      const ac = acMap.get(icao24)
      const baseHex = altColor(ac?.altitude ?? 5000)
      for (let i = 0; i < positions.length - 1; i++) {
        const opacity = 0.06 + (i / (positions.length - 1)) * 0.2
        trailArcs.push({
          sLat: positions[i].lat, sLng: positions[i].lon,
          eLat: positions[i + 1].lat, eLng: positions[i + 1].lon,
          col: hexToRgba(baseHex, opacity),
          isTrail: true,
        })
      }
    }

    // Velocity projection arcs
    const velArcs: ArcDatum[] = aircraft.slice(0, 200).map(a => {
      const distDeg = (a.velocity * 3.6 / 6) / 111
      const hdgRad = (a.heading * Math.PI) / 180
      return {
        sLat: a.lat, sLng: a.lon,
        eLat: a.lat + Math.cos(hdgRad) * distDeg,
        eLng: a.lon + Math.sin(hdgRad) * distDeg,
        col: altColor(a.altitude),
        isTrail: false,
      }
    })

    globeRef.current.arcsData([...trailArcs, ...velArcs])
  }, [aircraft, trails])

  // Ships
  useEffect(() => {
    if (!globeRef.current) return
    globeRef.current.htmlElementsData(ships)
  }, [ships])

  // Labels — clusters, formations, brief target, NOTAMs
  useEffect(() => {
    if (!globeRef.current) return
    const labels = [
      ...clusters.map(c => ({ lat: c.lat, lng: c.lon, text: `⚠ ${c.country} ×${c.count}`, col: '#ef4444' })),
      ...formations.map(f => ({ lat: f.lat, lng: f.lon, text: `◈ FORMATION ×${f.aircraft.length}`, col: '#f59e0b' })),
      ...(briefTarget ? [{ lat: briefTarget.lat, lng: briefTarget.lon, text: '◎ BRIEF SECTOR', col: '#00e676' }] : []),
      ...notams.map(n => ({ lat: n.lat, lng: n.lon, text: `▣ ${n.type} ${n.id.replace('NOTAM-', '')}`, col: '#fb923c' })),
    ]
    globeRef.current.labelsData(labels)
  }, [clusters, formations, briefTarget, notams])

  // Country tint by aircraft density
  useEffect(() => {
    if (!globeRef.current || countriesRef.current.length === 0) return
    const counts = new Map<string, number>()
    for (const a of aircraft) {
      counts.set(a.country.toLowerCase(), (counts.get(a.country.toLowerCase()) ?? 0) + 1)
    }
    globeRef.current.polygonCapColor((d: GeoFeature) => {
      const count = counts.get((d.properties.ADMIN ?? d.properties.NAME ?? '').toLowerCase()) ?? 0
      if (count === 0) return 'rgba(0,230,118,0.02)'
      if (count < 3) return 'rgba(0,230,118,0.06)'
      if (count < 8) return 'rgba(0,230,118,0.11)'
      return 'rgba(0,230,118,0.18)'
    })
  }, [aircraft])

  // Focus globe on selected aircraft — smooth pan
  useEffect(() => {
    if (!globeRef.current || !focusAircraft) return
    globeRef.current.pointOfView({ lat: focusAircraft.lat, lng: focusAircraft.lon, altitude: 1.8 }, 800)
  }, [focusAircraft])

  return (
    <div className="relative w-full h-full" style={{ background: '#000' }}>
      <div ref={containerRef} className="w-full h-full" />

      {/* Hint */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1.5 font-mono text-xs pointer-events-none"
        style={{ background: 'rgba(9,9,11,0.8)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
        Click → brief · Right-click → sector · B → centroid
      </div>

      {/* Texture toggle */}
      <div className="absolute top-3 left-3 flex gap-1">
        {GLOBE_TEXTURES.map((t, i) => (
          <button key={t.label} onClick={() => setTextureIdx(i)}
            className="text-[10px] font-mono px-2 py-1 rounded transition-colors"
            style={{
              border: '1px solid var(--border)',
              background: textureIdx === i ? 'rgba(0,230,118,0.1)' : 'rgba(9,9,11,0.8)',
              color: textureIdx === i ? 'var(--accent)' : 'var(--muted)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="absolute top-12 right-3 rounded-lg px-3 py-2 font-mono text-xs backdrop-blur space-y-1.5"
        style={{ background: 'rgba(9,9,11,0.9)', border: '1px solid var(--border)' }}>
        <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>AIR Alt</div>
        {[['#00e676', '>8 000m'], ['#f59e0b', '3–8 km'], ['#ff4444', '<3 000m']].map(([col, lbl]) => (
          <div key={lbl} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: col, boxShadow: `0 0 5px ${col}` }} />
            <span style={{ color: 'var(--muted)' }}>{lbl}</span>
          </div>
        ))}
        <div className="mt-1.5 pt-1.5 text-[10px] uppercase tracking-widest" style={{ borderTop: '1px solid var(--border)', color: 'var(--muted)' }}>Naval</div>
        {[['#00b4ff', 'Carrier'], ['#4dd0e1', 'Destroyer'], ['#7986cb', 'Sub']].map(([col, lbl]) => (
          <div key={lbl} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded" style={{ background: col, boxShadow: `0 0 4px ${col}`, transform: 'rotate(45deg)' }} />
            <span style={{ color: 'var(--muted)' }}>{lbl}</span>
          </div>
        ))}
        <div className="mt-1 pt-1 text-[10px]" style={{ borderTop: '1px solid var(--border)', color: 'var(--muted)' }}>
          ▣ NOTAM · — trails · → speed
        </div>
      </div>
    </div>
  )
}
