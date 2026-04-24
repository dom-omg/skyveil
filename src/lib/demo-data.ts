import type { Aircraft } from './types'

const R = 6371

function advancePos(lat: number, lon: number, heading: number, velocityMs: number, dtSec: number) {
  const distKm = (velocityMs * dtSec) / 1000
  const hdgRad = (heading * Math.PI) / 180
  const dLat = (distKm / R) * (180 / Math.PI) * Math.cos(hdgRad)
  const dLon = (distKm / R) * (180 / Math.PI) * Math.sin(hdgRad) / Math.cos((lat * Math.PI) / 180)
  return { lat: lat + dLat, lon: lon + dLon }
}

interface BaseAC {
  icao24: string; callsign: string; country: string
  lat: number; lon: number; heading: number
  velocity: number; altitude: number
  squawk: string | null
  orbitStep?: number // if set: heading increments this many degrees per cycle
}

const BASE: BaseAC[] = [
  // ── ISR ORBIT ── JSTARS over Eastern Europe (heading rotates +10°/cycle)
  { icao24: 'ae4456', callsign: 'JSTAR01', country: 'United States', lat: 50.5, lon: 24.0, heading: 0, velocity: 215, altitude: 9800, squawk: null, orbitStep: 10 },

  // ── SQUAWK 7700 MAYDAY ──
  { icao24: 'ae7700', callsign: 'MAYDAY1', country: 'United States', lat: 45.2, lon: 28.8, heading: 270, velocity: 190, altitude: 3800, squawk: '7700' },

  // ── RUSSIAN CLUSTER (4 aircraft within 150km near Kaliningrad) ──
  { icao24: '43c001', callsign: 'RRR7701', country: 'Russia', lat: 54.7, lon: 20.5, heading: 180, velocity: 240, altitude: 10500, squawk: null },
  { icao24: '43c002', callsign: 'RRR7702', country: 'Russia', lat: 55.1, lon: 21.0, heading: 185, velocity: 238, altitude: 10300, squawk: null },
  { icao24: '43c003', callsign: 'RRR7703', country: 'Russia', lat: 54.3, lon: 21.4, heading: 178, velocity: 242, altitude: 10700, squawk: null },
  { icao24: '43c004', callsign: 'RRR7704', country: 'Russia', lat: 55.4, lon: 20.1, heading: 182, velocity: 235, altitude: 10100, squawk: null },

  // ── US FORMATION ── VIPER01/02 over Atlantic (same heading ±3°, within 50km)
  { icao24: 'ae1bc4', callsign: 'VIPER01', country: 'United States', lat: 48.0, lon: -20.0, heading: 90, velocity: 310, altitude: 8000, squawk: null },
  { icao24: 'ae1bc5', callsign: 'VIPER02', country: 'United States', lat: 48.3, lon: -20.5, heading: 92, velocity: 308, altitude: 7950, squawk: null },

  // ── OTHERS ──
  { icao24: 'ae07d8', callsign: 'DUKE11',  country: 'United States', lat: 51.5, lon: -1.2,   heading: 95,  velocity: 230, altitude: 9100,  squawk: null },
  { icao24: 'ae4912', callsign: 'REACH71', country: 'United States', lat: 48.3, lon: 2.1,    heading: 220, velocity: 265, altitude: 11200, squawk: null },
  { icao24: '3f4b22', callsign: 'CTM101',  country: 'France',        lat: 43.6, lon: 1.4,    heading: 175, velocity: 180, altitude: 6200,  squawk: null },
  { icao24: '3c4b77', callsign: 'GAF689',  country: 'Germany',       lat: 50.1, lon: 8.7,    heading: 60,  velocity: 210, altitude: 8400,  squawk: null },
  { icao24: '400fca', callsign: 'RRR7001', country: 'United Kingdom', lat: 53.8, lon: -1.8,   heading: 120, velocity: 200, altitude: 7500,  squawk: null },
  { icao24: '4ca871', callsign: 'IAM301',  country: 'Israel',        lat: 31.8, lon: 34.8,   heading: 340, velocity: 225, altitude: 9800,  squawk: null },
  { icao24: '478042', callsign: 'PLF301',  country: 'Poland',        lat: 52.2, lon: 21.0,   heading: 45,  velocity: 185, altitude: 6800,  squawk: null },
  { icao24: 'ae3301', callsign: 'SNTRY01', country: 'United States', lat: 35.0, lon: -85.3,  heading: 270, velocity: 215, altitude: 9200,  squawk: null },
  { icao24: 'ae4711', callsign: 'GHOST11', country: 'United States', lat: 36.2, lon: -115.0, heading: 90,  velocity: 280, altitude: 13500, squawk: null },
  { icao24: 'b05fa3', callsign: 'CKS101',  country: 'China',         lat: 39.9, lon: 116.4,  heading: 180, velocity: 260, altitude: 11100, squawk: null },
  { icao24: 'b05fa4', callsign: 'CKS102',  country: 'China',         lat: 40.3, lon: 116.8,  heading: 178, velocity: 258, altitude: 10900, squawk: null },
  { icao24: 'ae6601', callsign: 'ATLAS21', country: 'United States', lat: 28.5, lon: -80.6,  heading: 180, velocity: 145, altitude: 2100,  squawk: null },
]

// ── globalThis state ──
const g = globalThis as typeof globalThis & {
  _demoPositions: Map<string, { lat: number; lon: number; heading: number }> | undefined
  _demoCycle: number
  _demoLastTime: number
}

function initDemo() {
  g._demoPositions = new Map(BASE.map(a => [a.icao24, { lat: a.lat, lon: a.lon, heading: a.heading }]))
  g._demoCycle = 0
  g._demoLastTime = Date.now()
}

function tickDemo() {
  if (!g._demoPositions) { initDemo(); return }
  const now = Date.now()
  const dt = (now - g._demoLastTime) / 1000
  if (dt < 15) return // min 15s between ticks
  g._demoLastTime = now
  g._demoCycle++

  for (const base of BASE) {
    const pos = g._demoPositions!.get(base.icao24)!
    let { lat, lon, heading } = pos
    if (base.orbitStep) heading = (heading + base.orbitStep) % 360
    const next = advancePos(lat, lon, heading, base.velocity, dt)
    g._demoPositions!.set(base.icao24, { lat: next.lat, lon: next.lon, heading })
  }
}

export function getDemoAircraft(): Aircraft[] {
  if (!g._demoPositions) initDemo()
  tickDemo()
  const now = Date.now() / 1000
  return BASE.map(a => {
    const pos = g._demoPositions!.get(a.icao24)!
    return {
      icao24: a.icao24,
      callsign: a.callsign,
      country: a.country,
      lat: pos.lat,
      lon: pos.lon,
      altitude: a.altitude + Math.sin(Date.now() / 30000 + a.icao24.charCodeAt(0)) * 50,
      velocity: a.velocity + Math.sin(Date.now() / 20000 + a.icao24.charCodeAt(2)) * 5,
      heading: pos.heading,
      onGround: false,
      isMilitary: true,
      lastContact: now,
      squawk: a.squawk,
    }
  })
}

// Pre-seeded circular positions for JSTAR01 orbit — 15 points on a ~37km-radius circle
// Used to initialize orbitHistRef so ISR detection fires immediately
export function getDemoOrbitSeed(): { icao24: string; positions: { lat: number; lon: number }[] } {
  const centerLat = 50.5
  const centerLon = 24.0
  const radiusKm = 37
  const positions = Array.from({ length: 15 }, (_, i) => {
    const angle = (i * 24 * Math.PI) / 180
    const dLat = (radiusKm / R) * (180 / Math.PI) * Math.cos(angle)
    const dLon = (radiusKm / R) * (180 / Math.PI) * Math.sin(angle) / Math.cos((centerLat * Math.PI) / 180)
    return { lat: centerLat + dLat, lon: centerLon + dLon }
  })
  return { icao24: 'ae4456', positions }
}

// Pre-seeded trail for each aircraft (6 backward steps of 30s)
export function getDemoTrailSeed(): Map<string, { lat: number; lon: number }[]> {
  if (!g._demoPositions) initDemo()
  const trails = new Map<string, { lat: number; lon: number }[]>()
  for (const base of BASE) {
    const pos = g._demoPositions!.get(base.icao24)!
    const pts: { lat: number; lon: number }[] = []
    let lat = pos.lat, lon = pos.lon
    for (let i = 5; i >= 0; i--) {
      const backHdg = (pos.heading + 180) % 360
      const prev = advancePos(lat, lon, backHdg, base.velocity, 30 * (i + 1))
      pts.push({ lat: prev.lat, lon: prev.lon })
    }
    pts.push({ lat: pos.lat, lon: pos.lon })
    trails.set(base.icao24, pts)
  }
  return trails
}
