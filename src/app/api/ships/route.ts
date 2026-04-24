import { NextResponse } from 'next/server'
import type { Ship } from '@/lib/types'

const DEMO_SHIPS: Ship[] = [
  { mmsi: '338234631', name: 'USS GERALD R FORD', country: 'United States', type: 'carrier', lat: 36.9, lon: -15.2, heading: 120, speed: 18, status: 'underway' },
  { mmsi: '338912401', name: 'USS HARRY S TRUMAN', country: 'United States', type: 'carrier', lat: 32.1, lon: 33.4, heading: 270, speed: 12, status: 'underway' },
  { mmsi: '235009890', name: 'HMS QUEEN ELIZABETH', country: 'United Kingdom', type: 'carrier', lat: 43.8, lon: -9.1, heading: 200, speed: 15, status: 'underway' },
  { mmsi: '636091921', name: 'ADM KUZNETSOV', country: 'Russia', type: 'carrier', lat: 69.1, lon: 33.2, heading: 90, speed: 0, status: 'moored' },
  { mmsi: '338334221', name: 'USS ROSS DDG-71', country: 'United States', type: 'destroyer', lat: 41.6, lon: 29.0, heading: 315, speed: 20, status: 'underway' },
  { mmsi: '338441203', name: 'USS COLE DDG-67', country: 'United States', type: 'destroyer', lat: 22.3, lon: 58.7, heading: 45, speed: 18, status: 'underway' },
  { mmsi: '235099123', name: 'HMS DEFENDER D36', country: 'United Kingdom', type: 'destroyer', lat: 34.7, lon: 36.1, heading: 180, speed: 22, status: 'underway' },
  { mmsi: '244830012', name: 'HNLMS TROMP F803', country: 'Netherlands', type: 'frigate', lat: 36.2, lon: 14.5, heading: 90, speed: 14, status: 'underway' },
  { mmsi: '273431010', name: 'RFS SLAVA', country: 'Russia', type: 'destroyer', lat: 44.6, lon: 33.5, heading: 0, speed: 0, status: 'anchored' },
  { mmsi: '338712409', name: 'USS MICHIGAN SSGN', country: 'United States', type: 'submarine', lat: 35.1, lon: 129.0, heading: 0, speed: 0, status: 'moored' },
  { mmsi: '477190100', name: 'CNSS LIAONING', country: 'China', type: 'carrier', lat: 21.5, lon: 114.2, heading: 150, speed: 16, status: 'underway' },
  { mmsi: '477290100', name: 'CNSS SHANDONG', country: 'China', type: 'carrier', lat: 18.2, lon: 109.5, heading: 200, speed: 14, status: 'underway' },
  { mmsi: '432109870', name: 'JMSDF IZUMO JS-183', country: 'Japan', type: 'carrier', lat: 34.4, lon: 136.9, heading: 60, speed: 18, status: 'underway' },
  { mmsi: '636092300', name: 'RFS MOSKVA', country: 'Russia', type: 'destroyer', lat: 45.2, lon: 30.9, heading: 90, speed: 0, status: 'moored' },
  { mmsi: '338821001', name: 'USNS SUPPLY T-AOE-6', country: 'United States', type: 'supply', lat: 37.5, lon: -12.8, heading: 100, speed: 10, status: 'underway' },
]

export async function GET() {
  return NextResponse.json({ ships: DEMO_SHIPS })
}
