import type { Aircraft } from './types'

// Seed data — realistic military callsigns/positions — used when OpenSky is rate-limited and cache is empty
export const DEMO_AIRCRAFT: Aircraft[] = [
  { icao24: 'ae07d8', callsign: 'DUKE11', country: 'United States', lat: 51.5, lon: -1.2, altitude: 9100, velocity: 230, heading: 95, onGround: false, isMilitary: true, lastContact: Date.now() / 1000, squawk: null },
  { icao24: 'ae4912', callsign: 'REACH71', country: 'United States', lat: 48.3, lon: 2.1, altitude: 11200, velocity: 265, heading: 220, onGround: false, isMilitary: true, lastContact: Date.now() / 1000, squawk: null },
  { icao24: 'ae5c3a', callsign: 'ROCKY21', country: 'United States', lat: 52.8, lon: 13.4, altitude: 7800, velocity: 195, heading: 315, onGround: false, isMilitary: true, lastContact: Date.now() / 1000, squawk: null },
  { icao24: '3f4b22', callsign: 'CTM1011', country: 'France', lat: 43.6, lon: 1.4, altitude: 6200, velocity: 180, heading: 175, onGround: false, isMilitary: true, lastContact: Date.now() / 1000, squawk: null },
  { icao24: '3c4b77', callsign: 'GAF689', country: 'Germany', lat: 50.1, lon: 8.7, altitude: 8400, velocity: 210, heading: 60, onGround: false, isMilitary: true, lastContact: Date.now() / 1000, squawk: null },
  { icao24: '43c0a1', callsign: 'RRR7701', country: 'Russia', lat: 55.7, lon: 37.6, altitude: 10500, velocity: 240, heading: 270, onGround: false, isMilitary: true, lastContact: Date.now() / 1000, squawk: null },
  { icao24: '43c1b2', callsign: 'RFF5502', country: 'Russia', lat: 56.2, lon: 38.1, altitude: 10300, velocity: 238, heading: 268, onGround: false, isMilitary: true, lastContact: Date.now() / 1000, squawk: null },
  { icao24: 'ae1bc4', callsign: 'VIPER01', country: 'United States', lat: 37.1, lon: -76.4, altitude: 4500, velocity: 310, heading: 30, onGround: false, isMilitary: true, lastContact: Date.now() / 1000, squawk: null },
  { icao24: 'ae1bc5', callsign: 'VIPER02', country: 'United States', lat: 37.3, lon: -76.2, altitude: 4400, velocity: 308, heading: 32, onGround: false, isMilitary: true, lastContact: Date.now() / 1000, squawk: null },
  { icao24: '400fca', callsign: 'RRR7001', country: 'United Kingdom', lat: 53.8, lon: -1.8, altitude: 7500, velocity: 200, heading: 120, onGround: false, isMilitary: true, lastContact: Date.now() / 1000, squawk: null },
  { icao24: '4ca871', callsign: 'IAM301', country: 'Israel', lat: 31.8, lon: 34.8, altitude: 9800, velocity: 225, heading: 340, onGround: false, isMilitary: true, lastContact: Date.now() / 1000, squawk: null },
  { icao24: 'b05fa3', callsign: 'CKS1101', country: 'China', lat: 39.9, lon: 116.4, altitude: 11100, velocity: 260, heading: 180, onGround: false, isMilitary: true, lastContact: Date.now() / 1000, squawk: null },
  { icao24: 'ae3301', callsign: 'SNTRY01', country: 'United States', lat: 35.0, lon: -85.3, altitude: 9200, velocity: 215, heading: 270, onGround: false, isMilitary: true, lastContact: Date.now() / 1000, squawk: null },
  { icao24: '33f9aa', callsign: 'FAF5501', country: 'France', lat: 44.8, lon: -0.5, altitude: 5100, velocity: 170, heading: 200, onGround: false, isMilitary: true, lastContact: Date.now() / 1000, squawk: null },
  { icao24: 'ae4711', callsign: 'GHOST11', country: 'United States', lat: 36.2, lon: -115.0, altitude: 13500, velocity: 280, heading: 90, onGround: false, isMilitary: true, lastContact: Date.now() / 1000, squawk: null },
  { icao24: '478042', callsign: 'PLF301', country: 'Poland', lat: 52.2, lon: 21.0, altitude: 6800, velocity: 185, heading: 45, onGround: false, isMilitary: true, lastContact: Date.now() / 1000, squawk: null },
  { icao24: '4b1814', callsign: 'SUI401', country: 'Switzerland', lat: 47.3, lon: 7.5, altitude: 7200, velocity: 190, heading: 310, onGround: false, isMilitary: true, lastContact: Date.now() / 1000, squawk: null },
  { icao24: 'ae6601', callsign: 'ATLAS21', country: 'United States', lat: 28.5, lon: -80.6, altitude: 2100, velocity: 145, heading: 180, onGround: false, isMilitary: true, lastContact: Date.now() / 1000, squawk: null },
  { icao24: '43c4d5', callsign: 'RMM4401', country: 'Russia', lat: 59.9, lon: 30.3, altitude: 8900, velocity: 220, heading: 90, onGround: false, isMilitary: true, lastContact: Date.now() / 1000, squawk: null },
  { icao24: 'a835af', callsign: 'EXEC1F', country: 'United States', lat: 38.9, lon: -77.0, altitude: 3200, velocity: 160, heading: 210, onGround: false, isMilitary: true, lastContact: Date.now() / 1000, squawk: null },
]
